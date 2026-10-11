import { expect, it, vi } from 'vitest';

import type { VelliraUiUsageReport } from '../checks/vellira-ui-usage/types';
import { runCanonicalGapCli } from './cli';
import { canonicalGapIssueForRequest } from './orchestrator';
import {
  extractCanonicalGapRequestId,
  parseCanonicalGapRequest,
  type CanonicalGapIssueClient,
  type CanonicalGapIssueMutationInput,
  type CanonicalGapManagedIssue,
} from './types';

class CliClient implements CanonicalGapIssueClient {
  issues: CanonicalGapManagedIssue[] = [];
  creates = 0;
  closes = 0;

  async listManagedIssues() {
    return [...this.issues];
  }

  async ensureLabels() {}

  async createIssue(input: CanonicalGapIssueMutationInput) {
    this.creates += 1;
    const requestId = extractCanonicalGapRequestId(input.body);
    if (!requestId) throw new Error('missing marker');
    const issue: CanonicalGapManagedIssue = {
      number: 1,
      state: 'open',
      url: 'issue:1',
      requestId,
      title: input.title,
      body: input.body,
      labels: [...input.labels],
    };
    this.issues.push(issue);
    return issue;
  }

  async closeManagedIssue(issue: CanonicalGapManagedIssue) {
    this.closes += 1;
    this.issues = this.issues.map((current) =>
      current.number === issue.number
        ? { ...current, state: 'closed' as const }
        : current
    );
  }
}

const spec = JSON.stringify({
  schemaVersion: '1',
  requestId: 'canonical-gap-cli-1',
  kind: 'icon',
  canonicalTarget: 'StatusIcon',
  requestedIntent: 'status indication',
  consumer: 'apps/website/src/example.tsx',
  launchCritical: false,
});

it('keeps plan mode read-only and machine-readable', async () => {
  const client = new CliClient();
  const output: string[] = [];
  const exitCode = await runCanonicalGapCli(
    ['--repo', 'vellira-dev/vellira', '--spec', 'gap.json'],
    {
      readFile: () => spec,
      createClient: () => client,
      write: (message) => output.push(message),
    }
  );

  expect(exitCode).toBe(0);
  expect(client.creates).toBe(0);
  expect(JSON.parse(output[0])).toMatchObject({
    schemaVersion: '1',
    mode: 'plan',
    requests: 1,
    results: [{ action: 'planned-create', issue: null }],
  });
});

it('apply mode creates once and emits the work-item reference', async () => {
  const client = new CliClient();
  const output: string[] = [];
  const exitCode = await runCanonicalGapCli(
    ['--repo', 'vellira-dev/vellira', '--spec', 'gap.json', '--apply'],
    {
      token: 'test-token',
      readFile: () => spec,
      createClient: () => client,
      write: (message) => output.push(message),
    }
  );

  expect(exitCode).toBe(0);
  expect(client.creates).toBe(1);
  expect(JSON.parse(output[0])).toMatchObject({
    mode: 'apply',
    results: [{ action: 'created', issue: { number: 1 } }],
  });
});

it.each(['open', 'closed'] as const)(
  'CLI plan links a %s issue without POST',
  async (state) => {
    const client = new CliClient();
    client.issues.push({
      number: 42,
      state,
      url: 'issue:42',
      requestId: 'canonical-gap-cli-1',
      title: 'edited title',
      body: '',
      labels: ['canonical-gap'],
    });
    const output: string[] = [];
    const exitCode = await runCanonicalGapCli(
      ['--repo', 'vellira-dev/vellira', '--spec', 'gap.json'],
      {
        readFile: () => spec,
        createClient: () => client,
        write: (text) => output.push(text),
      }
    );
    expect(exitCode).toBe(0);
    expect(JSON.parse(output[0]).results[0]).toMatchObject({
      action: state === 'open' ? 'linked-existing' : 'historical',
      issue: { number: 42 },
    });
    expect(client.creates).toBe(0);
  }
);

it('rejects unauthenticated apply before creating a client, even for no work', async () => {
  const createClient = vi.fn();
  const output = vi.fn();
  const errors = vi.fn();
  const exitCode = await runCanonicalGapCli(
    ['--repo', 'vellira-dev/vellira', '--spec', 'gap.json', '--apply'],
    {
      token: '',
      readFile: () => '{"schemaVersion":"1","requests":[]}',
      createClient,
      write: output,
      writeError: errors,
    }
  );
  expect(exitCode).toBe(2);
  expect(createClient).not.toHaveBeenCalled();
  expect(output).not.toHaveBeenCalled();
  expect(errors).toHaveBeenCalledWith(
    expect.stringContaining('GITHUB_TOKEN is required')
  );
});

const exceptionRequest = parseCanonicalGapRequest({
  schemaVersion: '1',
  requestId: 'canonical-gap-cli-exception',
  kind: 'token',
  canonicalTarget: '#fff',
  requestedIntent: 'canonical token for provider background',
  consumer: 'apps/website/src/product-app/AuthSurface.module.css',
  launchCritical: false,
  source: {
    ruleId: 'vellira-ui.noncanonical-token-value',
    path: 'apps/website/src/product-app/AuthSurface.module.css',
    line: 142,
    column: 15,
    detected: '#fff',
  },
});

const appliedReport: VelliraUiUsageReport = {
  schemaVersion: '1',
  mode: 'audit',
  findings: [],
  exceptions: [
    {
      ruleId: 'vellira-ui.noncanonical-token-value',
      path: 'apps/website/src/product-app/AuthSurface.module.css',
      line: 142,
      column: 15,
      detected: '#fff',
      category: 'architectural-exception',
      reason: 'Approved external brand-specific artwork',
      issue: '#1569',
    },
  ],
  summary: {
    filesScanned: 425,
    findings: 0,
    blockingFindings: 0,
    exceptionsApplied: 1,
  },
};

it('reconciles only current checker-applied exceptions, preserving dry-run mode', async () => {
  const client = new CliClient();
  client.issues.push({
    ...canonicalGapIssueForRequest(exceptionRequest),
    number: 1576,
    state: 'open',
    url: 'issue:1576',
    requestId: exceptionRequest.requestId,
  });
  const output: string[] = [];
  const scanned = vi.fn(() => appliedReport);
  const exitCode = await runCanonicalGapCli(
    ['--repo', 'vellira-dev/vellira', '--reconcile-exceptions'],
    {
      token: '',
      scanUiUsage: scanned,
      createClient: () => client,
      write: (message) => output.push(message),
    }
  );
  expect(exitCode).toBe(0);
  expect(scanned).toHaveBeenCalledTimes(1);
  expect(JSON.parse(output[0])).toMatchObject({
    mode: 'plan',
    results: [{ issueNumber: 1576, action: 'planned-close' }],
  });
  expect(client.closes).toBe(0);
  expect(client.creates).toBe(0);
});

it('applies a planned exception closure only after a trusted main check', async () => {
  const client = new CliClient();
  client.issues.push({
    ...canonicalGapIssueForRequest(exceptionRequest),
    number: 1576,
    state: 'open',
    url: 'issue:1576',
    requestId: exceptionRequest.requestId,
  });
  const output: string[] = [];
  const validateReconciliationAuthority = vi.fn(() => 'a'.repeat(40));
  const exitCode = await runCanonicalGapCli(
    ['--repo', 'vellira-dev/vellira', '--reconcile-exceptions', '--apply'],
    {
      token: 'test-token',
      scanUiUsage: () => appliedReport,
      validateReconciliationAuthority,
      createClient: () => client,
      write: (message) => output.push(message),
    }
  );
  expect(exitCode).toBe(0);
  expect(validateReconciliationAuthority).toHaveBeenCalledTimes(1);
  expect(client.closes).toBe(1);
  expect(JSON.parse(output[0])).toMatchObject({
    mode: 'apply',
    results: [{ issueNumber: 1576, action: 'closed' }],
  });
});

it('rejects an untrusted exception apply before GitHub mutation', async () => {
  const client = new CliClient();
  const errors: string[] = [];
  const exitCode = await runCanonicalGapCli(
    ['--repo', 'vellira-dev/vellira', '--reconcile-exceptions', '--apply'],
    {
      token: 'test-token',
      scanUiUsage: () => appliedReport,
      createClient: () => client,
      writeError: (message) => errors.push(message),
    }
  );
  expect(exitCode).toBe(2);
  expect(errors.join(' ')).toMatch(/main-branch event/);
  expect(client.closes).toBe(0);
  expect(client.creates).toBe(0);
});

it('rejects combining exception reconciliation with partial report inputs', async () => {
  const errors: string[] = [];
  const exitCode = await runCanonicalGapCli(
    [
      '--repo',
      'vellira-dev/vellira',
      '--reconcile-exceptions',
      '--report',
      'partial.json',
    ],
    { writeError: (message) => errors.push(message) }
  );
  expect(exitCode).toBe(2);
  expect(errors.join(' ')).toMatch(/exactly one source input/);
});
