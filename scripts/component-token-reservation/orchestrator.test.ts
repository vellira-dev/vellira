import fs from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { canonicalGapIssueForRequest } from '../canonical-gap/orchestrator';
import type { CanonicalGapManagedIssue } from '../canonical-gap/types';
import type {
  ComponentTokenReservationGitHubClient,
  ReservationComparison,
  ReservationPullRequest,
} from './github';
import {
  reservationBranch,
  reservationPullRequestMarker,
  runComponentTokenReservation,
} from './orchestrator';
import { reserveComponentTokenFamily } from './resolver';
import { genericReservationRequest, temporaryRepository } from './test-helpers';

const dispose: Array<() => void> = [];
afterEach(() => dispose.splice(0).forEach((callback) => callback()));

function fixtureClient(params: {
  sourceRevision: string;
  baseContent: string;
  issue?: CanonicalGapManagedIssue;
}) {
  const request = genericReservationRequest();
  const desired = canonicalGapIssueForRequest(request);
  const issue: CanonicalGapManagedIssue = params.issue ?? {
    number: 1262,
    state: 'open',
    url: 'https://github.com/vellira-dev/vellira/issues/1262',
    requestId: request.requestId,
    title: desired.title,
    body: desired.body,
    labels: desired.labels,
  };
  const branches = new Map<string, string>([['main', params.sourceRevision]]);
  const files = new Map<string, string>([
    [params.sourceRevision, params.baseContent],
    ['main', params.baseContent],
  ]);
  const pulls: ReservationPullRequest[] = [];
  const candidateHead = '1'.repeat(40);
  let comparison = exactComparison(params.sourceRevision, candidateHead);
  const events: string[] = [];
  let createCount = 0;
  const client: ComponentTokenReservationGitHubClient = {
    async getRepository() {
      return { defaultBranch: 'main' };
    },
    async getBranchSha(branch) {
      return branches.get(branch) ?? null;
    },
    async getIssue() {
      return issue;
    },
    async listManagedIssues() {
      return [issue];
    },
    async listPullRequests(headBranch) {
      return pulls.filter(({ headRef }) => headRef === headBranch);
    },
    async getFile(_filePath, revision) {
      const content = files.get(revision);
      if (content === undefined)
        throw new Error(`Missing fixture file ${revision}`);
      return { sha: 'file-sha', content };
    },
    async compareCandidate(sourceRevision, headRevision) {
      events.push(`compare:${sourceRevision}:${headRevision}`);
      return comparison;
    },
    async createBranch(branch, sourceRevision) {
      branches.set(branch, sourceRevision);
      files.set(branch, files.get(sourceRevision)!);
    },
    async updateFile({ branch, content }) {
      branches.set(branch, candidateHead);
      files.set(candidateHead, content);
    },
    async createPullRequest({ title, body, headBranch, baseBranch }) {
      events.push('create-pr');
      createCount += 1;
      const pull: ReservationPullRequest = {
        number: 1400,
        state: 'open',
        url: 'https://github.com/vellira-dev/vellira/pull/1400',
        title,
        body,
        headRef: headBranch,
        headSha: branches.get(headBranch)!,
        headRepository: 'vellira-dev/vellira',
        baseRef: baseBranch,
        baseSha: branches.get(baseBranch)!,
        baseRepository: 'vellira-dev/vellira',
      };
      pulls.push(pull);
      return pull;
    },
  };
  return {
    client,
    files,
    branches,
    pulls,
    issue,
    events,
    installCandidate(options: {
      content: string;
      comparison?: ReservationComparison;
      headRevision?: string;
      withPull?: boolean;
    }) {
      const headRevision = options.headRevision ?? candidateHead;
      const branch = reservationBranch(request.requestId);
      branches.set(branch, headRevision);
      files.set(headRevision, options.content);
      comparison =
        options.comparison ??
        exactComparison(params.sourceRevision, headRevision);
      if (options.withPull !== false) {
        pulls.push({
          number: 1400,
          state: 'open',
          url: 'https://github.com/vellira-dev/vellira/pull/1400',
          title: 'reservation',
          body: reservationPullRequestMarker({
            requestId: request.requestId,
            sourceRevision: params.sourceRevision,
          }),
          headRef: branch,
          headSha: headRevision,
          headRepository: 'vellira-dev/vellira',
          baseRef: 'main',
          baseSha: params.sourceRevision,
          baseRepository: 'vellira-dev/vellira',
        });
      }
    },
    setComparison(value: ReservationComparison) {
      comparison = value;
    },
    get createCount() {
      return createCount;
    },
  };
}

function exactComparison(
  sourceRevision: string,
  headRevision: string
): ReservationComparison {
  return {
    status: 'ahead',
    aheadBy: 1,
    behindBy: 0,
    totalCommits: 1,
    mergeBaseSha: sourceRevision,
    commits: [{ sha: headRevision, parentShas: [sourceRevision] }],
    files: [
      {
        path: 'packages/metadata/src/tokenLifecycle.ts',
        status: 'modified',
        previousPath: null,
      },
    ],
  };
}

function deterministicCandidate(
  fixture: ReturnType<typeof temporaryRepository>
) {
  return reserveComponentTokenFamily({
    root: fixture.root,
    sourceRevision: fixture.sourceRevision,
    request: genericReservationRequest(),
    write: false,
  }).nextSource;
}

describe('component-token reservation orchestration', () => {
  it('creates one deterministic reservation PR and links it on a clean rerun', async () => {
    const first = temporaryRepository();
    dispose.push(first.dispose);
    const remote = fixtureClient({
      sourceRevision: first.sourceRevision,
      baseContent: fs.readFileSync(first.registry, 'utf8'),
    });
    const created = await runComponentTokenReservation({
      root: first.root,
      repository: 'vellira-dev/vellira',
      sourceRevision: first.sourceRevision,
      issueNumber: 1262,
      apply: true,
      client: remote.client,
    });
    expect(created.action).toBe('create-pr');
    expect(created.mutationOccurred).toBe(true);
    expect(created.eligibility).toMatchObject({
      eligible: true,
      hardInvalid: false,
      reason: 'reserved',
      lifecycleMutationRequired: true,
    });
    expect(remote.createCount).toBe(1);
    expect(
      remote.events.findIndex((event) => event.startsWith('compare:'))
    ).toBeLessThan(remote.events.indexOf('create-pr'));
    expect(created.reservationPr?.branch).toBe(
      reservationBranch(genericReservationRequest().requestId)
    );

    first.restore();
    const linked = await runComponentTokenReservation({
      root: first.root,
      repository: 'vellira-dev/vellira',
      sourceRevision: first.sourceRevision,
      issueNumber: 1262,
      apply: true,
      client: remote.client,
    });
    expect(linked.action).toBe('linked-existing');
    expect(linked.mutationOccurred).toBe(false);
    expect(remote.createCount).toBe(1);
  });

  it('plans without mutation and rejects stale base authority', async () => {
    const fixture = temporaryRepository();
    dispose.push(fixture.dispose);
    const baseContent = fs.readFileSync(fixture.registry, 'utf8');
    const remote = fixtureClient({
      sourceRevision: fixture.sourceRevision,
      baseContent,
    });
    const plan = await runComponentTokenReservation({
      root: fixture.root,
      repository: 'vellira-dev/vellira',
      sourceRevision: fixture.sourceRevision,
      issueNumber: 1262,
      apply: false,
      client: remote.client,
    });
    expect(plan.action).toBe('planned');
    expect(fs.readFileSync(fixture.registry, 'utf8')).toBe(baseContent);

    const stale = fixtureClient({
      sourceRevision: 'f'.repeat(40),
      baseContent,
    });
    await expect(
      runComponentTokenReservation({
        root: fixture.root,
        repository: 'vellira-dev/vellira',
        sourceRevision: fixture.sourceRevision,
        issueNumber: 1262,
        apply: true,
        client: stale.client,
      })
    ).rejects.toThrow(/Stale reservation base/);
  });

  it('rejects a correct registry accompanied by an unrelated file', async () => {
    const fixture = temporaryRepository();
    dispose.push(fixture.dispose);
    const remote = fixtureClient({
      sourceRevision: fixture.sourceRevision,
      baseContent: fs.readFileSync(fixture.registry, 'utf8'),
    });
    const comparison = exactComparison(fixture.sourceRevision, '1'.repeat(40));
    remote.installCandidate({
      content: deterministicCandidate(fixture),
      comparison: {
        ...comparison,
        files: [
          ...comparison.files,
          { path: 'unrelated.txt', status: 'added', previousPath: null },
        ],
      },
    });
    await expect(runApply(fixture, remote.client)).rejects.toThrow(
      /exact deterministic registry-only commit/
    );
  });

  it('rejects an unrelated extra commit even when the final registry bytes match', async () => {
    const fixture = temporaryRepository();
    dispose.push(fixture.dispose);
    const remote = fixtureClient({
      sourceRevision: fixture.sourceRevision,
      baseContent: fs.readFileSync(fixture.registry, 'utf8'),
    });
    const head = '1'.repeat(40);
    const extra = '2'.repeat(40);
    const comparison = exactComparison(fixture.sourceRevision, head);
    remote.installCandidate({
      content: deterministicCandidate(fixture),
      comparison: {
        ...comparison,
        aheadBy: 2,
        totalCommits: 2,
        commits: [
          { sha: extra, parentShas: [fixture.sourceRevision] },
          { sha: head, parentShas: [extra] },
        ],
      },
    });
    await expect(runApply(fixture, remote.client)).rejects.toThrow(
      /exact deterministic registry-only commit/
    );
  });

  it('rejects a stale leftover deterministic branch derived from another source', async () => {
    const fixture = temporaryRepository();
    dispose.push(fixture.dispose);
    const remote = fixtureClient({
      sourceRevision: fixture.sourceRevision,
      baseContent: fs.readFileSync(fixture.registry, 'utf8'),
    });
    const head = '2'.repeat(40);
    const staleSource = '3'.repeat(40);
    remote.installCandidate({
      content: deterministicCandidate(fixture),
      headRevision: head,
      withPull: false,
      comparison: {
        ...exactComparison(staleSource, head),
        mergeBaseSha: staleSource,
      },
    });
    await expect(runApply(fixture, remote.client)).rejects.toThrow(
      /exact deterministic registry-only commit/
    );
    expect(remote.createCount).toBe(0);
  });

  it('rejects a reservation PR tampered after creation', async () => {
    const fixture = temporaryRepository();
    dispose.push(fixture.dispose);
    const remote = fixtureClient({
      sourceRevision: fixture.sourceRevision,
      baseContent: fs.readFileSync(fixture.registry, 'utf8'),
    });
    await runApply(fixture, remote.client);
    fixture.restore();
    const tamperedHead = '4'.repeat(40);
    const branch = reservationBranch(genericReservationRequest().requestId);
    remote.branches.set(branch, tamperedHead);
    remote.pulls[0].headSha = tamperedHead;
    remote.files.set(tamperedHead, deterministicCandidate(fixture));
    const comparison = exactComparison(fixture.sourceRevision, tamperedHead);
    remote.setComparison({
      ...comparison,
      files: [
        ...comparison.files,
        { path: 'tampered.txt', status: 'added', previousPath: null },
      ],
    });
    await expect(runApply(fixture, remote.client)).rejects.toThrow(
      /exact deterministic registry-only commit/
    );
  });

  it('rejects a renamed lifecycle registry', async () => {
    const fixture = temporaryRepository();
    dispose.push(fixture.dispose);
    const remote = fixtureClient({
      sourceRevision: fixture.sourceRevision,
      baseContent: fs.readFileSync(fixture.registry, 'utf8'),
    });
    const head = '1'.repeat(40);
    remote.installCandidate({
      content: deterministicCandidate(fixture),
      comparison: {
        ...exactComparison(fixture.sourceRevision, head),
        files: [
          {
            path: 'packages/metadata/src/tokenLifecycle-renamed.ts',
            status: 'renamed',
            previousPath: 'packages/metadata/src/tokenLifecycle.ts',
          },
        ],
      },
    });
    await expect(runApply(fixture, remote.client)).rejects.toThrow(
      /exact deterministic registry-only commit/
    );
  });

  it.each([
    ['deleted registry', 'packages/metadata/src/tokenLifecycle.ts', 'removed'],
    ['additional file', 'generated/output.ts', 'added'],
  ])('rejects a candidate with a %s', async (_name, path, status) => {
    const fixture = temporaryRepository();
    dispose.push(fixture.dispose);
    const remote = fixtureClient({
      sourceRevision: fixture.sourceRevision,
      baseContent: fs.readFileSync(fixture.registry, 'utf8'),
    });
    const head = '1'.repeat(40);
    remote.installCandidate({
      content: deterministicCandidate(fixture),
      comparison: {
        ...exactComparison(fixture.sourceRevision, head),
        files: [{ path, status, previousPath: null }],
      },
    });
    await expect(runApply(fixture, remote.client)).rejects.toThrow(
      /exact deterministic registry-only commit/
    );
  });
});

function runApply(
  fixture: ReturnType<typeof temporaryRepository>,
  client: ComponentTokenReservationGitHubClient
) {
  return runComponentTokenReservation({
    root: fixture.root,
    repository: 'vellira-dev/vellira',
    sourceRevision: fixture.sourceRevision,
    issueNumber: 1262,
    apply: true,
    client,
  });
}
