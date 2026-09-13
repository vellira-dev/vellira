import { expect, it } from 'vitest';

import { applyCanonicalGaps } from './orchestrator';
import {
  extractCanonicalGapRequestId,
  parseCanonicalGapRequest,
  type CanonicalGapIssueClient,
  type CanonicalGapIssueMutationInput,
  type CanonicalGapManagedIssue,
} from './types';

it('links the first issue after an uncertain create response instead of duplicating it', async () => {
  const issues: CanonicalGapManagedIssue[] = [];
  let createCalls = 0;
  let loseFirstResponse = true;

  const client: CanonicalGapIssueClient = {
    async listManagedIssues() {
      return [...issues];
    },
    async ensureLabels() {},
    async createIssue(input: CanonicalGapIssueMutationInput) {
      createCalls += 1;
      const requestId = extractCanonicalGapRequestId(input.body);
      if (!requestId) throw new Error('missing canonical gap marker');
      const issue: CanonicalGapManagedIssue = {
        number: 1200,
        state: 'open',
        url: 'issue:1200',
        requestId,
        title: input.title,
        body: input.body,
        labels: [...input.labels],
      };
      issues.push(issue);
      if (loseFirstResponse) {
        loseFirstResponse = false;
        throw new Error('synthetic response loss');
      }
      return issue;
    },
  };

  const request = parseCanonicalGapRequest({
    schemaVersion: '1',
    requestId: 'canonical-gap-retry-1',
    kind: 'icon',
    canonicalTarget: 'StatusIcon',
    requestedIntent: 'status indication',
    consumer: 'apps/website/src/example.tsx',
    launchCritical: false,
  });

  await expect(applyCanonicalGaps([request], client)).rejects.toThrow(
    /synthetic response loss/
  );

  const retry = await applyCanonicalGaps([request], client);
  expect(createCalls).toBe(1);
  expect(retry.results[0]).toMatchObject({
    action: 'linked-existing',
    issue: { number: 1200 },
  });
});
