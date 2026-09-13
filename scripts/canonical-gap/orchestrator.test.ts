import { describe, expect, it } from 'vitest';

import {
  applyCanonicalGaps,
  canonicalGapIssueForRequest,
  planCanonicalGaps,
  runCanonicalGapPlan,
} from './orchestrator';
import {
  CanonicalGapError,
  canonicalGapIssueMarker,
  extractCanonicalGapRequestId,
  parseCanonicalGapRequest,
  type CanonicalGapIssueClient,
  type CanonicalGapIssueMutationInput,
  type CanonicalGapLabelDefinition,
  type CanonicalGapManagedIssue,
  type CanonicalGapRequestV1,
} from './types';

function request(
  overrides: Partial<CanonicalGapRequestV1> = {}
): CanonicalGapRequestV1 {
  return parseCanonicalGapRequest({
    schemaVersion: '1',
    requestId: 'canonical-gap-test-1',
    kind: 'token',
    canonicalTarget: '--font-family-mono',
    requestedIntent: 'canonical mono font family',
    consumer: 'apps/website/src/example.css',
    launchCritical: false,
    ...overrides,
  });
}

class FakeClient implements CanonicalGapIssueClient {
  issues: CanonicalGapManagedIssue[];
  created = 0;
  ensuredLabels: CanonicalGapLabelDefinition[] = [];

  constructor(issues: CanonicalGapManagedIssue[] = []) {
    this.issues = [...issues];
  }

  async listManagedIssues() {
    return [...this.issues];
  }

  async ensureLabels(labels: readonly CanonicalGapLabelDefinition[]) {
    this.ensuredLabels.push(...labels);
  }

  async createIssue(input: CanonicalGapIssueMutationInput) {
    this.created += 1;
    const requestId = extractCanonicalGapRequestId(input.body);
    if (!requestId) throw new Error('missing marker');
    const issue: CanonicalGapManagedIssue = {
      number: 100 + this.created,
      state: 'open',
      url: `issue:${100 + this.created}`,
      requestId,
      title: input.title,
      body: input.body,
      labels: [...input.labels],
    };
    this.issues.push(issue);
    return issue;
  }
}

describe('canonical gap planning', () => {
  it('plans creation without mutations', async () => {
    const client = new FakeClient();
    const plan = await planCanonicalGaps([request()], client);
    const run = await runCanonicalGapPlan([request()], client);

    expect(plan[0]).toMatchObject({
      action: 'create-issue',
      request: { requestId: 'canonical-gap-test-1' },
    });
    expect(run.mode).toBe('plan');
    expect(run.results[0]).toMatchObject({
      action: 'planned-create',
      issue: null,
      routing: { status: 'planned' },
    });
    expect(client.created).toBe(0);
    expect(client.ensuredLabels).toEqual([]);
  });

  it.each(['open', 'closed'] as const)(
    'reports a matching %s issue truthfully in the exported plan interface',
    async (state) => {
      const desired = canonicalGapIssueForRequest(request());
      const client = new FakeClient([
        {
          ...desired,
          number: 42,
          state,
          url: 'issue:42',
          requestId: request().requestId,
        },
      ]);
      const result = await runCanonicalGapPlan([request()], client);
      expect(result.results[0]).toMatchObject({
        action: state === 'open' ? 'linked-existing' : 'historical',
        issue: { number: 42, state },
        routing: { status: state === 'open' ? 'existing' : 'historical' },
      });
      expect(client.created).toBe(0);
      expect(client.ensuredLabels).toEqual([]);
    }
  );

  it('rejects duplicate managed identities', async () => {
    const duplicate = (number: number): CanonicalGapManagedIssue => ({
      number,
      state: 'open',
      url: `issue:${number}`,
      requestId: 'canonical-gap-test-1',
      title: 'duplicate',
      body: canonicalGapIssueMarker('canonical-gap-test-1'),
      labels: [],
    });
    const client = new FakeClient([duplicate(1), duplicate(2)]);

    await expect(planCanonicalGaps([request()], client)).rejects.toBeInstanceOf(
      CanonicalGapError
    );
  });
});

describe('canonical gap apply', () => {
  it('links an existing open work item by marker', async () => {
    const desired = canonicalGapIssueForRequest(request());
    const client = new FakeClient([
      {
        number: 934,
        state: 'open',
        url: 'issue:934',
        requestId: 'canonical-gap-test-1',
        title: 'edited title',
        body: `edited prose\n${canonicalGapIssueMarker('canonical-gap-test-1')}`,
        labels: desired.labels,
      },
    ]);

    const result = await applyCanonicalGaps([request()], client);
    expect(client.created).toBe(0);
    expect(result.results[0]).toMatchObject({
      action: 'linked-existing',
      issue: { number: 934, state: 'open' },
    });
  });

  it('keeps a completed match historical', async () => {
    const client = new FakeClient([
      {
        number: 80,
        state: 'closed',
        url: 'issue:80',
        requestId: 'canonical-gap-test-1',
        title: 'historical',
        body: canonicalGapIssueMarker('canonical-gap-test-1'),
        labels: [],
      },
    ]);

    const result = await applyCanonicalGaps([request()], client);
    expect(client.created).toBe(0);
    expect(result.results[0]).toMatchObject({
      action: 'historical',
      issue: { number: 80, state: 'closed' },
    });
  });

  it('creates once and links the same work item on rerun', async () => {
    const client = new FakeClient();
    const launchRequest = request({ launchCritical: true });

    const first = await applyCanonicalGaps([launchRequest], client);
    const second = await applyCanonicalGaps([launchRequest], client);

    expect(client.created).toBe(1);
    expect(first.results[0]).toMatchObject({ action: 'created' });
    expect(second.results[0]).toMatchObject({ action: 'linked-existing' });
    expect(client.ensuredLabels.map(({ name }) => name).sort()).toEqual([
      'canonical-gap',
      'canonical-gap:ready',
      'design-resource-gap',
      'launch-blocker',
      'launch-critical-path',
    ]);
  });
});
