import { expect, it, vi } from 'vitest';

import { runCanonicalGapCli } from './cli';
import {
  extractCanonicalGapRequestId,
  type CanonicalGapIssueClient,
  type CanonicalGapIssueMutationInput,
  type CanonicalGapManagedIssue,
} from './types';

class CliClient implements CanonicalGapIssueClient {
  issues: CanonicalGapManagedIssue[] = [];
  creates = 0;

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
