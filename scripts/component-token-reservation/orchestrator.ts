import { CanonicalGapError } from '../canonical-gap/types';
import { resolveComponentProductionEligibility } from '../component-production/production-eligibility';
import { reservationRequestFromManagedIssue } from './managed-issue';
import {
  COMPONENT_TOKEN_RESERVATION_REGISTRY,
  reserveComponentTokenFamily,
  type ComponentTokenReservationEntryV1,
} from './resolver';
import type {
  ComponentTokenReservationGitHubClient,
  ReservationPullRequest,
} from './github';

export const COMPONENT_TOKEN_RESERVATION_PR_MARKER_PREFIX =
  'vellira-component-token-reservation-pr:v1:';
export const COMPONENT_TOKEN_RESERVATION_BRANCH_PREFIX =
  'component-token-reservation/';
const SOURCE_SCOPED_BRANCH_SEPARATOR = '--';

export type StaleReservationPullRequestV1 = {
  number: number;
  url: string;
  state: 'open' | 'closed';
  sourceRevision: string;
  branch: string;
};

export type ComponentTokenReservationRunResultV1 = {
  schemaVersion: '1';
  mode: 'plan' | 'apply';
  status: 'ok';
  sourceRevision: string;
  requestId: string;
  managedIssue: { number: number; url: string };
  action:
    | 'planned'
    | 'create-pr'
    | 'linked-existing'
    | 'no-op'
    | 'superseded-and-created'
    | 'superseded-and-linked-existing'
    | 'superseded-and-no-op';
  targetEntry: ComponentTokenReservationEntryV1;
  reservationPr: {
    number: number;
    state: 'open' | 'closed';
    url: string;
    branch: string;
    headSha: string;
  } | null;
  staleReservationPrs: readonly StaleReservationPullRequestV1[];
  eligibility: ReturnType<typeof resolveComponentProductionEligibility> | null;
  mutationOccurred: boolean;
};

export async function runComponentTokenReservation(params: {
  root: string;
  repository: string;
  sourceRevision: string;
  issueNumber: number;
  apply: boolean;
  client: ComponentTokenReservationGitHubClient;
}): Promise<ComponentTokenReservationRunResultV1> {
  if (!Number.isInteger(params.issueNumber) || params.issueNumber < 1) {
    throw new CanonicalGapError(
      'Component-token reservation requires a positive managed issue number.'
    );
  }
  if (!/^[0-9a-f]{40}$/.test(params.sourceRevision)) {
    throw new CanonicalGapError(
      'Component-token reservation requires an exact source revision.'
    );
  }

  const repository = await params.client.getRepository();
  const currentBase = await params.client.getBranchSha(
    repository.defaultBranch
  );
  if (currentBase !== params.sourceRevision) {
    throw new CanonicalGapError(
      `Stale reservation base: ${repository.defaultBranch} is ${String(
        currentBase
      )}, not ${params.sourceRevision}.`
    );
  }

  const [issue, managedIssues] = await Promise.all([
    params.client.getIssue(params.issueNumber),
    params.client.listManagedIssues(),
  ]);
  const request = reservationRequestFromManagedIssue({
    issue,
    managedIssues,
    requireOpen: false,
  });
  const branch = reservationBranch(request.requestId, params.sourceRevision);
  let pulls = await params.client.listPullRequests();
  // Keep compatibility with test/dry-run clients that only implement the
  // historical head-filtered listing contract.
  if (pulls.length === 0) pulls = await params.client.listPullRequests(branch);
  const discovered = discoverReservationPulls({
    pulls,
    requestId: request.requestId,
    sourceRevision: params.sourceRevision,
    repository: params.repository,
    baseBranch: repository.defaultBranch,
  });
  const currentPulls = discovered.filter(({ kind }) => kind === 'current');
  if (currentPulls.length > 1) {
    throw new CanonicalGapError(
      `Multiple current-source reservation PRs exist for request "${request.requestId}".`
    );
  }
  if (currentPulls[0] && currentPulls[0].pull.state !== 'open') {
    throw new CanonicalGapError(
      'The current-source reservation PR is closed; refusing to reopen or replace a human-closed candidate.'
    );
  }
  const staleReservationPrs = discovered
    .filter(({ kind }) => kind === 'stale' || kind === 'legacy')
    .map(({ pull, marker }) => ({
      number: pull.number,
      url: pull.url,
      state: pull.state,
      sourceRevision: marker.sourceRevision,
      branch: pull.headRef,
    }));
  const openStale = discovered.filter(
    ({ kind, pull }) =>
      (kind === 'stale' || kind === 'legacy') && pull.state === 'open'
  );
  const currentPull = currentPulls[0]?.pull;

  const mutation = reserveComponentTokenFamily({
    root: params.root,
    sourceRevision: params.sourceRevision,
    request,
    write: false,
  });
  const baseFile = await params.client.getFile(
    COMPONENT_TOKEN_RESERVATION_REGISTRY,
    params.sourceRevision
  );
  if (baseFile.content !== mutation.previousSource) {
    throw new CanonicalGapError(
      'Local canonical lifecycle authority does not match the exact GitHub base.'
    );
  }

  if (currentPull) {
    validateExistingPullRequest({
      pull: currentPull,
      repository: params.repository,
      baseBranch: repository.defaultBranch,
      branch,
      requestId: request.requestId,
      sourceRevision: params.sourceRevision,
    });
    await verifyExactReservationCandidate({
      client: params.client,
      branch,
      sourceRevision: params.sourceRevision,
      expectedHeadRevision: currentPull.headSha,
      expectedRegistrySource: mutation.nextSource,
    });
    if (params.apply)
      await supersedeStalePullRequests(params.client, openStale);
    return result({
      params,
      requestId: request.requestId,
      issue,
      action:
        openStale.length > 0
          ? 'superseded-and-linked-existing'
          : 'linked-existing',
      entry: mutation.entry,
      pull: currentPull,
      branch,
      eligibility: null,
      mutationOccurred: false,
      staleReservationPrs,
    });
  }

  if (mutation.action === 'no-op') {
    const eligibility = assertReservedEligibility(
      resolveComponentProductionEligibility(
        request.productionSeed!,
        params.root
      )
    );
    if (params.apply)
      await supersedeStalePullRequests(params.client, openStale);
    return result({
      params,
      requestId: request.requestId,
      issue,
      action: openStale.length > 0 ? 'superseded-and-no-op' : 'no-op',
      entry: mutation.entry,
      pull: null,
      branch,
      eligibility,
      mutationOccurred: false,
      staleReservationPrs,
    });
  }

  if (!params.apply) {
    return result({
      params,
      requestId: request.requestId,
      issue,
      action: 'planned',
      entry: mutation.entry,
      pull: null,
      branch,
      eligibility: null,
      mutationOccurred: false,
      staleReservationPrs,
    });
  }

  if (issue.state !== 'open') {
    throw new CanonicalGapError(
      'Reservation issue must be open when first creating a reservation PR.'
    );
  }

  const applied = reserveComponentTokenFamily({
    root: params.root,
    sourceRevision: params.sourceRevision,
    request,
    write: true,
  });
  const eligibility = assertReservedEligibility(
    resolveComponentProductionEligibility(request.productionSeed!, params.root)
  );

  await supersedeStalePullRequests(params.client, openStale);

  const existingBranch = await params.client.getBranchSha(branch);
  if (existingBranch === null) {
    await params.client.createBranch(branch, params.sourceRevision);
    await params.client.updateFile({
      filePath: COMPONENT_TOKEN_RESERVATION_REGISTRY,
      branch,
      fileSha: baseFile.sha,
      content: applied.nextSource,
      message: `chore(tokens): reserve ${request.canonicalTarget} component token family`,
    });
  }

  const candidateHead = await verifyExactReservationCandidate({
    client: params.client,
    branch,
    sourceRevision: params.sourceRevision,
    expectedRegistrySource: applied.nextSource,
  });

  const currentBaseBeforePull = await params.client.getBranchSha(
    repository.defaultBranch
  );
  if (currentBaseBeforePull !== params.sourceRevision) {
    throw new CanonicalGapError(
      'Default branch advanced while resolving the reservation; refusing a stale pull request.'
    );
  }

  const pull = await params.client.createPullRequest({
    title: `chore(tokens): reserve ${request.canonicalTarget} component token family`,
    body: reservationPullRequestBody({
      requestId: request.requestId,
      sourceRevision: params.sourceRevision,
      issueNumber: issue.number,
      issueUrl: issue.url,
    }),
    headBranch: branch,
    baseBranch: repository.defaultBranch,
  });
  validateExistingPullRequest({
    pull,
    repository: params.repository,
    baseBranch: repository.defaultBranch,
    branch,
    requestId: request.requestId,
    sourceRevision: params.sourceRevision,
    expectedHeadRevision: candidateHead,
  });
  await verifyExactReservationCandidate({
    client: params.client,
    branch,
    sourceRevision: params.sourceRevision,
    expectedHeadRevision: pull.headSha,
    expectedRegistrySource: applied.nextSource,
  });
  return result({
    params,
    requestId: request.requestId,
    issue,
    action:
      staleReservationPrs.length > 0 ? 'superseded-and-created' : 'create-pr',
    entry: applied.entry,
    pull,
    branch,
    eligibility,
    mutationOccurred: true,
    staleReservationPrs,
  });
}

export function reservationBranch(requestId: string, sourceRevision?: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,159}$/.test(requestId)) {
    throw new CanonicalGapError('Invalid reservation request identity.');
  }
  if (sourceRevision === undefined) return reservationLegacyBranch(requestId);
  if (!/^[0-9a-f]{40}$/.test(sourceRevision)) {
    throw new CanonicalGapError('Invalid reservation source revision.');
  }
  return `${reservationLegacyBranch(requestId)}${SOURCE_SCOPED_BRANCH_SEPARATOR}${sourceRevision}`;
}

export function reservationLegacyBranch(requestId: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,159}$/.test(requestId)) {
    throw new CanonicalGapError('Invalid reservation request identity.');
  }
  return `${COMPONENT_TOKEN_RESERVATION_BRANCH_PREFIX}${requestId}`;
}

export function reservationPullRequestMarker(params: {
  requestId: string;
  sourceRevision: string;
}) {
  return `<!-- ${COMPONENT_TOKEN_RESERVATION_PR_MARKER_PREFIX}${params.requestId}:${params.sourceRevision} -->`;
}

function parseReservationPullRequestMarker(body: string) {
  const matches = [
    ...body.matchAll(
      /<!-- vellira-component-token-reservation-pr:v1:([a-z0-9][a-z0-9-]{0,159}):([0-9a-f]{40}) -->/g
    ),
  ];
  if (matches.length !== 1) return null;
  const requestId = matches[0]?.[1];
  const sourceRevision = matches[0]?.[2];
  return requestId && sourceRevision ? { requestId, sourceRevision } : null;
}

type DiscoveredReservationPull = {
  pull: ReservationPullRequest;
  marker: { requestId: string; sourceRevision: string };
  kind: 'current' | 'stale' | 'legacy';
};

function discoverReservationPulls(params: {
  pulls: readonly ReservationPullRequest[];
  requestId: string;
  sourceRevision: string;
  repository: string;
  baseBranch: string;
}): DiscoveredReservationPull[] {
  const currentBranch = reservationBranch(
    params.requestId,
    params.sourceRevision
  );
  const legacyBranch = reservationLegacyBranch(params.requestId);
  const sourceScopedPrefix = `${legacyBranch}${SOURCE_SCOPED_BRANCH_SEPARATOR}`;
  const discovered: DiscoveredReservationPull[] = [];
  for (const pull of params.pulls) {
    const marker = parseReservationPullRequestMarker(pull.body);
    const branchMatchesRequest =
      pull.headRef === currentBranch ||
      pull.headRef === legacyBranch ||
      pull.headRef.startsWith(sourceScopedPrefix);
    if (!branchMatchesRequest && marker?.requestId !== params.requestId) {
      continue;
    }
    if (!marker || marker.requestId !== params.requestId) {
      throw new CanonicalGapError(
        'Malformed or ambiguous managed reservation PR identity.'
      );
    }
    if (
      pull.headRepository !== params.repository ||
      pull.baseRepository !== params.repository ||
      pull.baseRef !== params.baseBranch
    ) {
      throw new CanonicalGapError(
        'Managed reservation PR is not bound to the same repository and default branch.'
      );
    }
    if (pull.headRef === currentBranch) {
      if (marker.sourceRevision !== params.sourceRevision) {
        throw new CanonicalGapError(
          'Current-source reservation branch has a mismatched marker revision.'
        );
      }
      discovered.push({ pull, marker, kind: 'current' });
      continue;
    }
    if (pull.headRef === legacyBranch) {
      discovered.push({ pull, marker, kind: 'legacy' });
      continue;
    }
    if (!pull.headRef.startsWith(sourceScopedPrefix)) {
      throw new CanonicalGapError(
        'Managed reservation PR uses an unexpected deterministic branch identity.'
      );
    }
    const branchRevision = pull.headRef.slice(sourceScopedPrefix.length);
    if (
      !/^[0-9a-f]{40}$/.test(branchRevision) ||
      branchRevision !== marker.sourceRevision
    ) {
      throw new CanonicalGapError(
        'Managed reservation PR branch and marker source revisions disagree.'
      );
    }
    if (marker.sourceRevision === params.sourceRevision) {
      throw new CanonicalGapError(
        'Current-source reservation PR does not use the canonical source-scoped branch.'
      );
    }
    discovered.push({ pull, marker, kind: 'stale' });
  }
  return discovered;
}

async function supersedeStalePullRequests(
  client: ComponentTokenReservationGitHubClient,
  stalePulls: readonly DiscoveredReservationPull[]
) {
  for (const stale of stalePulls) {
    if (stale.pull.state === 'open') {
      await client.closePullRequest(stale.pull.number);
    }
  }
}

function reservationPullRequestBody(params: {
  requestId: string;
  sourceRevision: string;
  issueNumber: number;
  issueUrl: string;
}) {
  return `${reservationPullRequestMarker(params)}\n\nResolves the governed component-token reservation from [#${params.issueNumber}](${params.issueUrl}).\n\nThis PR owns only \`unregistered -> reserved\`. Generator V2 remains the sole owner of \`reserved -> current\`.\n`;
}

function validateExistingPullRequest(params: {
  pull: ReservationPullRequest;
  repository: string;
  baseBranch: string;
  branch: string;
  requestId: string;
  sourceRevision: string;
  expectedHeadRevision?: string;
}) {
  const expectedMarker = reservationPullRequestMarker(params);
  if (
    params.pull.body.split(expectedMarker).length !== 2 ||
    params.pull.headRef !== params.branch ||
    (params.expectedHeadRevision !== undefined &&
      params.pull.headSha !== params.expectedHeadRevision) ||
    params.pull.baseRef !== params.baseBranch ||
    params.pull.baseSha !== params.sourceRevision ||
    params.pull.headRepository !== params.repository ||
    params.pull.baseRepository !== params.repository
  ) {
    throw new CanonicalGapError(
      'Existing reservation PR does not match deterministic same-repository authority.'
    );
  }
}

async function verifyExactReservationCandidate(params: {
  client: ComponentTokenReservationGitHubClient;
  branch: string;
  sourceRevision: string;
  expectedHeadRevision?: string;
  expectedRegistrySource: string;
}) {
  const headRevision = await params.client.getBranchSha(params.branch);
  if (
    headRevision === null ||
    (params.expectedHeadRevision !== undefined &&
      headRevision !== params.expectedHeadRevision)
  ) {
    throw new CanonicalGapError(
      'Reservation branch head does not match its authorized candidate identity.'
    );
  }
  const comparison = await params.client.compareCandidate(
    params.sourceRevision,
    headRevision
  );
  const commit = comparison.commits[0];
  const file = comparison.files[0];
  if (
    comparison.status !== 'ahead' ||
    comparison.aheadBy !== 1 ||
    comparison.behindBy !== 0 ||
    comparison.totalCommits !== 1 ||
    comparison.mergeBaseSha !== params.sourceRevision ||
    comparison.commits.length !== 1 ||
    commit?.sha !== headRevision ||
    commit.parentShas.length !== 1 ||
    commit.parentShas[0] !== params.sourceRevision ||
    comparison.files.length !== 1 ||
    file?.path !== COMPONENT_TOKEN_RESERVATION_REGISTRY ||
    file.status !== 'modified' ||
    file.previousPath !== null
  ) {
    throw new CanonicalGapError(
      'Reservation candidate is not the exact deterministic registry-only commit derived from the authorized source revision.'
    );
  }
  const registry = await params.client.getFile(
    COMPONENT_TOKEN_RESERVATION_REGISTRY,
    headRevision
  );
  if (registry.content !== params.expectedRegistrySource) {
    throw new CanonicalGapError(
      'Reservation candidate registry bytes do not match the deterministic mutation.'
    );
  }
  return headRevision;
}

function assertReservedEligibility(
  eligibility: ReturnType<typeof resolveComponentProductionEligibility>
) {
  if (
    !eligibility.eligible ||
    eligibility.hardInvalid ||
    eligibility.reason !== 'reserved' ||
    !eligibility.lifecycleMutationRequired ||
    eligibility.registry.entry?.status !== 'reserved' ||
    eligibility.registry.entry.owner !== eligibility.seed.componentName ||
    !eligibility.registry.entry.public
  ) {
    throw new CanonicalGapError(
      'Reservation candidate did not produce canonical reserved eligibility.'
    );
  }
  return eligibility;
}

function result(params: {
  params: { sourceRevision: string; apply: boolean };
  requestId: string;
  issue: { number: number; url: string };
  action: ComponentTokenReservationRunResultV1['action'];
  entry: ComponentTokenReservationEntryV1;
  pull: ReservationPullRequest | null;
  branch: string;
  eligibility: ReturnType<typeof resolveComponentProductionEligibility> | null;
  mutationOccurred: boolean;
  staleReservationPrs: readonly StaleReservationPullRequestV1[];
}): ComponentTokenReservationRunResultV1 {
  return {
    schemaVersion: '1',
    mode: params.params.apply ? 'apply' : 'plan',
    status: 'ok',
    sourceRevision: params.params.sourceRevision,
    requestId: params.requestId,
    managedIssue: {
      number: params.issue.number,
      url: params.issue.url,
    },
    action: params.action,
    targetEntry: params.entry,
    reservationPr: params.pull
      ? {
          number: params.pull.number,
          state: params.pull.state,
          url: params.pull.url,
          branch: params.branch,
          headSha: params.pull.headSha,
        }
      : null,
    eligibility: params.eligibility,
    mutationOccurred: params.mutationOccurred,
    staleReservationPrs: params.staleReservationPrs,
  };
}
