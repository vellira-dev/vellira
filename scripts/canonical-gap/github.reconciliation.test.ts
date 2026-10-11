import { describe, expect, it, vi } from 'vitest';

import { createGitHubCanonicalGapClient } from './github';
import { canonicalGapIssueForRequest } from './orchestrator';
import {
  parseCanonicalGapRequest,
  type CanonicalGapManagedIssue,
} from './types';

function issue(): CanonicalGapManagedIssue {
  const request = parseCanonicalGapRequest({
    schemaVersion: '1',
    requestId: 'canonical-gap-approved-white',
    kind: 'token',
    canonicalTarget: '#fff',
    requestedIntent: 'approved external provider color',
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
  return {
    ...canonicalGapIssueForRequest(request),
    number: 1576,
    state: 'open',
    requestId: request.requestId,
    url: 'https://github.com/vellira-dev/vellira/issues/1576',
  };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function transport(
  original: CanonicalGapManagedIssue,
  options: {
    assignees?: unknown[];
    body?: string;
    comments?: string[];
    failFirstPatch?: boolean;
  } = {}
) {
  const notes = [...(options.comments ?? [])];
  const methods: string[] = [];
  let patches = 0;
  const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
    const address = String(url);
    const method = init?.method ?? 'GET';
    methods.push(method + ' ' + address);
    if (address.endsWith('/comments')) {
      if (method === 'GET') {
        return jsonResponse(notes.map((body) => ({ body })));
      }
      const body = JSON.parse(String(init?.body)) as { body: string };
      notes.push(body.body);
      return jsonResponse({ id: 100 });
    }
    if (method === 'PATCH') {
      patches += 1;
      if (options.failFirstPatch && patches === 1) {
        throw new Error('lost response before confirmed close');
      }
      expect(JSON.parse(String(init?.body))).toEqual({
        state: 'closed',
        state_reason: 'not_planned',
      });
      return jsonResponse({ state: 'closed' });
    }
    return jsonResponse({
      number: original.number,
      state: original.state,
      title: original.title,
      body: options.body ?? original.body,
      html_url: original.url,
      labels: original.labels.map((name) => ({ name })),
      assignees: options.assignees ?? [],
    });
  });
  return { fetchImpl, notes, methods };
}

describe('canonical gap exact managed issue closure transport', () => {
  it('checks current identity and discussion before comment and not-planned PATCH', async () => {
    const original = issue();
    const t = transport(original);
    const client = createGitHubCanonicalGapClient({
      repository: 'vellira-dev/vellira',
      token: 'example-token',
      fetchImpl: t.fetchImpl,
    });
    await client.closeManagedIssue?.(original, 'Reviewed exception #1569');
    expect(t.notes).toEqual(['Reviewed exception #1569']);
    expect(t.methods.map((method) => method.split(' ')[0])).toEqual([
      'GET',
      'GET',
      'POST',
      'PATCH',
    ]);
  });

  it.each([
    { body: 'removed trusted authority' },
    { assignees: [{ login: 'human' }] },
    { comments: ['human review is in progress'] },
  ])('refuses drift and human work before any issue mutation: %j', async (options) => {
    const original = issue();
    const t = transport(original, options);
    const client = createGitHubCanonicalGapClient({
      repository: 'vellira-dev/vellira',
      token: 'example-token',
      fetchImpl: t.fetchImpl,
    });
    await expect(
      client.closeManagedIssue?.(original, 'Reviewed exception #1569')
    ).rejects.toThrow(/changed|assigned|discussion/);
    expect(t.methods.every((method) => method.startsWith('GET'))).toBe(true);
  });

  it('does not duplicate an exact note after an interrupted closure', async () => {
    const original = issue();
    const t = transport(original, { failFirstPatch: true });
    const client = createGitHubCanonicalGapClient({
      repository: 'vellira-dev/vellira',
      token: 'example-token',
      fetchImpl: t.fetchImpl,
    });
    await expect(
      client.closeManagedIssue?.(original, 'Reviewed exception #1569')
    ).rejects.toThrow(/lost response/);
    await client.closeManagedIssue?.(original, 'Reviewed exception #1569');
    expect(t.notes).toEqual(['Reviewed exception #1569']);
    expect(t.methods.filter((method) => method.startsWith('POST'))).toHaveLength(
      1
    );
    expect(t.methods.filter((method) => method.startsWith('PATCH'))).toHaveLength(
      2
    );
  });

  it('does not reach GitHub API without an explicit mutation token', async () => {
    const original = issue();
    const t = transport(original);
    const client = createGitHubCanonicalGapClient({
      repository: 'vellira-dev/vellira',
      fetchImpl: t.fetchImpl,
    });
    await expect(
      client.closeManagedIssue?.(original, 'Reviewed exception #1569')
    ).rejects.toThrow(/GITHUB_TOKEN/);
    expect(t.methods).toEqual([]);
  });
});
