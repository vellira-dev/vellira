import fs from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { canonicalGapIssueForRequest } from '../canonical-gap/orchestrator';
import type { CanonicalGapManagedIssue } from '../canonical-gap/types';
import type {
  ComponentTokenReservationGitHubClient,
  ReservationPullRequest,
} from './github';
import {
  reservationBranch,
  runComponentTokenReservation,
} from './orchestrator';
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
    async createBranch(branch, sourceRevision) {
      branches.set(branch, sourceRevision);
      files.set(branch, files.get(sourceRevision)!);
    },
    async updateFile({ branch, content }) {
      files.set(branch, content);
    },
    async createPullRequest({ title, body, headBranch, baseBranch }) {
      createCount += 1;
      const pull: ReservationPullRequest = {
        number: 1400,
        state: 'open',
        url: 'https://github.com/vellira-dev/vellira/pull/1400',
        title,
        body,
        headRef: headBranch,
        headRepository: 'vellira-dev/vellira',
        baseRef: baseBranch,
        baseRepository: 'vellira-dev/vellira',
      };
      pulls.push(pull);
      return pull;
    },
  };
  return {
    client,
    files,
    pulls,
    issue,
    get createCount() {
      return createCount;
    },
  };
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
});
