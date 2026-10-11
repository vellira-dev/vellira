import { describe, expect, it } from 'vitest';

import type {
  AppliedVelliraUiUsageException,
  VelliraUiUsageFinding,
  VelliraUiUsageReport,
} from '../checks/vellira-ui-usage/types';
import { canonicalGapIssueForRequest } from './orchestrator';
import { reconcileCanonicalGapUiExceptions } from './reconcile-exceptions';
import {
  CanonicalGapError,
  parseCanonicalGapRequest,
  type CanonicalGapIssueClient,
  type CanonicalGapManagedIssue,
} from './types';

const SHA = 'a'.repeat(40);
const FILE = 'apps/website/src/product-app/AuthSurface.module.css';

const request = parseCanonicalGapRequest({
  schemaVersion: '1',
  requestId: 'canonical-gap-approved-white',
  kind: 'token',
  canonicalTarget: '#fff',
  requestedIntent: 'resolve canonical token for #fff',
  consumer: FILE,
  launchCritical: false,
  source: {
    ruleId: 'vellira-ui.noncanonical-token-value',
    path: FILE,
    line: 142,
    column: 15,
    detected: '#fff',
  },
});

function managed(
  overrides: Partial<CanonicalGapManagedIssue> = {}
): CanonicalGapManagedIssue {
  const issue = canonicalGapIssueForRequest(request);
  return {
    number: 1576,
    requestId: request.requestId,
    state: 'open',
    url: 'issue:1576',
    ...issue,
    ...overrides,
  };
}

function approved(
  overrides: Partial<AppliedVelliraUiUsageException> = {}
): AppliedVelliraUiUsageException {
  return {
    ruleId: 'vellira-ui.noncanonical-token-value',
    path: FILE,
    line: 142,
    column: 15,
    detected: '#fff',
    category: 'architectural-exception',
    reason: 'This is an approved external brand artwork boundary.',
    issue: '#1569',
    ...overrides,
  };
}

function report(
  exceptions: AppliedVelliraUiUsageException[] = [approved()],
  findings: VelliraUiUsageFinding[] = []
): VelliraUiUsageReport {
  return {
    schemaVersion: '1',
    mode: 'audit',
    exceptions,
    findings,
    summary: {
      filesScanned: 400,
      findings: findings.length,
      blockingFindings: findings.filter(({ blocking }) => blocking).length,
      exceptionsApplied: exceptions.length,
    },
  };
}

function rawFinding(
  overrides: Partial<VelliraUiUsageFinding> = {}
): VelliraUiUsageFinding {
  return {
    ruleId: 'vellira-ui.noncanonical-token-value',
    path: 'apps/website/src/other.css',
    line: 10,
    column: 6,
    detected: '#fff',
    severity: 'error',
    blocking: true,
    nextAction: 'request-missing-resource',
    message: 'unresolved raw token value',
    ...overrides,
  };
}

class Client implements CanonicalGapIssueClient {
  issues: CanonicalGapManagedIssue[] = [managed()];
  closed: number[] = [];
  notes: string[] = [];

  async listManagedIssues() {
    return [...this.issues];
  }

  async ensureLabels() {}

  async createIssue(): Promise<CanonicalGapManagedIssue> {
    throw new Error('Reconciliation must never create work');
  }

  async closeManagedIssue(issue: CanonicalGapManagedIssue, note: string) {
    this.closed.push(issue.number);
    this.notes.push(note);
    this.issues = this.issues.map((current) =>
      current.number === issue.number
        ? { ...current, state: 'closed' as const }
        : current
    );
  }
}

describe('approved canonical UI exception reconciliation', () => {
  it('plans exact approved exception closure without mutating', async () => {
    const client = new Client();
    const result = await reconcileCanonicalGapUiExceptions(report(), client, {
      apply: false,
    });
    expect(result).toMatchObject({
      mode: 'plan',
      status: 'ok',
      inspectedOpenIssues: 1,
      appliedExceptions: 1,
      results: [
        {
          issueNumber: 1576,
          action: 'planned-close',
          exception: { detected: '#fff', reviewedBy: '#1569' },
        },
      ],
    });
    expect(client.closed).toEqual([]);
  });

  it('closes the confirmed managed issue once, with precise source evidence', async () => {
    const client = new Client();
    const first = await reconcileCanonicalGapUiExceptions(report(), client, {
      apply: true,
      sourceSha: SHA,
    });
    const replay = await reconcileCanonicalGapUiExceptions(report(), client, {
      apply: true,
      sourceSha: SHA,
    });
    expect(first.results[0].action).toBe('closed');
    expect(replay).toMatchObject({ status: 'no-work', results: [] });
    expect(client.closed).toEqual([1576]);
    expect(client.notes[0]).toContain('#1569');
    expect(client.notes[0]).toContain('142:15');
    expect(client.notes[0]).toContain(SHA);
    expect(client.notes[0]).toContain('NOT by the creation');
  });

  it('preserves a target still reported from another consumer', async () => {
    const client = new Client();
    const result = await reconcileCanonicalGapUiExceptions(
      report([approved()], [rawFinding()]),
      client,
      { apply: true, sourceSha: SHA }
    );
    expect(result.status).toBe('no-work');
    expect(client.closed).toEqual([]);
  });

  it.each([
    { path: 'apps/website/src/other.css' },
    { line: 141 },
    { column: 16 },
    { detected: '#000' },
    { ruleId: 'vellira-ui.noncanonical-icon' as const },
    { category: 'framework-infrastructure' as const },
  ])('requires exact provenance, not only visual similarity: %j', async (change) => {
    const client = new Client();
    const result = await reconcileCanonicalGapUiExceptions(
      report([approved(change)]),
      client,
      { apply: true, sourceSha: SHA }
    );
    expect(result.status).toBe('no-work');
    expect(client.closed).toEqual([]);
  });

  it.each([
    { state: 'closed' as const },
    { labels: ['canonical-gap', 'design-resource-gap'] },
    { labels: ['canonical-gap', 'canonical-gap:ready', 'design-resource-gap', 'launch-blocker'] },
    { labels: [] },
    { body: '<!-- vellira-canonical-gap:v1:canonical-gap-approved-white -->' },
  ])('never mutates closed, human-routed or marker-only work: %j', async (change) => {
    const client = new Client();
    client.issues = [managed(change)];
    const result = await reconcileCanonicalGapUiExceptions(report(), client, {
      apply: true,
      sourceSha: SHA,
    });
    expect(result.status).toBe('no-work');
    expect(client.closed).toEqual([]);
  });

  it('never infers completion from a clean scan without approved exceptions', async () => {
    const client = new Client();
    const result = await reconcileCanonicalGapUiExceptions(
      report([], []),
      client,
      { apply: true, sourceSha: SHA }
    );
    expect(result.status).toBe('no-work');
    expect(client.closed).toEqual([]);
  });

  it('fails closed on an incomplete report rather than treating absence as proof', async () => {
    const client = new Client();
    const incomplete = report();
    incomplete.summary.filesScanned = 0;
    await expect(
      reconcileCanonicalGapUiExceptions(incomplete, client, {
        apply: true,
        sourceSha: SHA,
      })
    ).rejects.toBeInstanceOf(CanonicalGapError);
    expect(client.closed).toEqual([]);
  });

  it('rejects apply without a closure client or exact SHA', async () => {
    const client = new Client();
    await expect(
      reconcileCanonicalGapUiExceptions(report(), client, {
        apply: true,
        sourceSha: 'not-a-revision',
      })
    ).rejects.toThrow(/exact source SHA/);
    client.closeManagedIssue = undefined as never;
    await expect(
      reconcileCanonicalGapUiExceptions(report(), client, {
        apply: true,
        sourceSha: SHA,
      })
    ).rejects.toThrow(/authenticated issue closure/);
    expect(client.closed).toEqual([]);
  });
});
