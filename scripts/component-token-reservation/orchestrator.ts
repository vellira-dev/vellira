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

export type ComponentTokenReservationRunResultV1 = {
  schemaVersion: '1';
  mode: 'plan' | 'apply';
  status: 'ok';
  sourceRevision: string;
  requestId: string;
  managedIssue: { number: number; url: string };
  action: 'planned' | 'create-pr' | 'linked-existing' | 'no-op';
  targetEntry: ComponentTokenReservationEntryV1;
  reservationPr: {
    number: number;
    state: 'open' | 'closed';
    url: string;
    branch: string;
  } | null;
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
  const branch = reservationBranch(request.requestId);
  const pulls = await params.client.listPullRequests(branch);
  if (pulls.length > 1) {
    throw new CanonicalGapError(
      `Multiple reservation PRs exist for request "${request.requestId}".`
    );
  }

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

  if (pulls[0]) {
    validateExistingPullRequest({
      pull: pulls[0],
      repository: params.repository,
      baseBranch: repository.defaultBranch,
      branch,
      requestId: request.requestId,
      sourceRevision: params.sourceRevision,
    });
    const branchFile = await params.client.getFile(
      COMPONENT_TOKEN_RESERVATION_REGISTRY,
      branch
    );
    if (branchFile.content !== mutation.nextSource) {
      throw new CanonicalGapError(
        'Existing reservation PR does not contain the deterministic registry mutation.'
      );
    }
    return result({
      params,
      requestId: request.requestId,
      issue,
      action: 'linked-existing',
      entry: mutation.entry,
      pull: pulls[0],
      branch,
      eligibility: null,
      mutationOccurred: false,
    });
  }

  if (mutation.action === 'no-op') {
    const eligibility = assertReservedEligibility(
      resolveComponentProductionEligibility(
        request.productionSeed!,
        params.root
      )
    );
    return result({
      params,
      requestId: request.requestId,
      issue,
      action: 'no-op',
      entry: mutation.entry,
      pull: null,
      branch,
      eligibility,
      mutationOccurred: false,
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
  } else {
    const branchFile = await params.client.getFile(
      COMPONENT_TOKEN_RESERVATION_REGISTRY,
      branch
    );
    if (branchFile.content !== applied.nextSource) {
      throw new CanonicalGapError(
        `Deterministic reservation branch "${branch}" already exists with different content.`
      );
    }
  }

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
  });
  return result({
    params,
    requestId: request.requestId,
    issue,
    action: 'create-pr',
    entry: applied.entry,
    pull,
    branch,
    eligibility,
    mutationOccurred: true,
  });
}

export function reservationBranch(requestId: string) {
  if (!/^[a-z0-9][a-z0-9._:-]{0,159}$/.test(requestId)) {
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
}) {
  const expectedMarker = reservationPullRequestMarker(params);
  if (
    params.pull.body.split(expectedMarker).length !== 2 ||
    params.pull.headRef !== params.branch ||
    params.pull.baseRef !== params.baseBranch ||
    params.pull.headRepository !== params.repository ||
    params.pull.baseRepository !== params.repository
  ) {
    throw new CanonicalGapError(
      'Existing reservation PR does not match deterministic same-repository authority.'
    );
  }
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
        }
      : null,
    eligibility: params.eligibility,
    mutationOccurred: params.mutationOccurred,
  };
}
