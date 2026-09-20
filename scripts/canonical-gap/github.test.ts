import { describe, expect, it, vi } from 'vitest';

import { createGitHubCanonicalGapClient } from './github';
import {
  applyCanonicalGaps,
  canonicalGapIssueForRequest,
} from './orchestrator';
import { canonicalGapIssueMarker, parseCanonicalGapRequest } from './types';

function jsonResponse(value: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('canonical gap GitHub client', () => {
  it('discovers managed issues by the hidden request marker', async () => {
    const fetchImpl = vi.fn<
      (input: unknown, init?: RequestInit) => Promise<Response>
    >(async () =>
      jsonResponse([
        {
          number: 42,
          state: 'open',
          title: 'edited title',
          body: `edited\n${canonicalGapIssueMarker('canonical-gap-test-1')}`,
          html_url: 'issue:42',
          labels: [{ name: 'canonical-gap' }],
        },
        {
          number: 43,
          state: 'open',
          title: 'ordinary issue',
          body: 'no managed marker',
          html_url: 'issue:43',
          labels: [],
        },
      ])
    );
    const client = createGitHubCanonicalGapClient({
      repository: 'vellira-dev/vellira',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(client.listManagedIssues()).resolves.toMatchObject([
      {
        number: 42,
        requestId: 'canonical-gap-test-1',
        labels: ['canonical-gap'],
      },
    ]);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      '/issues?state=all&per_page=100'
    );
  });

  it('requires explicit authentication before any mutation', async () => {
    const client = createGitHubCanonicalGapClient({
      repository: 'vellira-dev/vellira',
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    await expect(
      client.createIssue({
        title: 'test',
        body: canonicalGapIssueMarker('canonical-gap-test-1'),
        labels: [],
      })
    ).rejects.toThrow(/GITHUB_TOKEN is required/);
  });

  it.each([
    'owner/repo?query=1',
    'owner/repo#fragment',
    'owner/..',
    'owner/repo%2Fissues',
    'owner/repo\\other',
    '../repo',
    'owner/repo/extra',
  ])('rejects an unsafe repository identity: %s', (repository) => {
    expect(() => createGitHubCanonicalGapClient({ repository })).toThrow(
      /owner\/name/
    );
  });

  it('paginates across all states, retains closed matches, and excludes pull requests', async () => {
    const ordinary = {
      number: 1,
      state: 'open',
      title: 'ordinary',
      body: '',
      html_url: 'issue:1',
      labels: [],
    };
    const fetchImpl = vi
      .fn<(input: unknown, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        jsonResponse(
          Array.from({ length: 100 }, (_, index) => ({
            ...ordinary,
            number: index + 1,
          })),
          200,
          {
            Link: '<https://api.github.com/repos/vellira-dev/vellira/issues?state=all&per_page=100&after=cursor-100>; rel="next"',
          }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            ...ordinary,
            number: 101,
            state: 'closed',
            body: canonicalGapIssueMarker('historical-resource'),
          },
          {
            ...ordinary,
            number: 102,
            pull_request: {},
            body: canonicalGapIssueMarker('not-an-issue'),
          },
        ])
      );
    const client = createGitHubCanonicalGapClient({
      repository: 'vellira-dev/vellira',
      fetchImpl,
    });
    expect(await client.listManagedIssues()).toMatchObject([
      { number: 101, state: 'closed', requestId: 'historical-resource' },
    ]);
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      'https://api.github.com/repos/vellira-dev/vellira/issues?state=all&per_page=100',
      'https://api.github.com/repos/vellira-dev/vellira/issues?state=all&per_page=100&after=cursor-100',
    ]);
  });

  it('finds a committed marker after losing the POST response without retrying create', async () => {
    const request = parseCanonicalGapRequest({
      schemaVersion: '1',
      requestId: 'uncertain-response',
      kind: 'token',
      canonicalTarget: '--missing-token',
      requestedIntent: 'canonical token',
      consumer: 'apps/example.tsx',
      launchCritical: false,
    });
    const desired = canonicalGapIssueForRequest(request);
    const committed: unknown[] = [];
    let posts = 0;
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts += 1;
        const body = JSON.parse(String(init.body));
        expect(Object.keys(body).sort()).toEqual(['body', 'labels', 'title']);
        committed.push({
          ...body,
          number: 42,
          state: 'open',
          html_url: 'issue:42',
        });
        throw new Error('connection lost after create');
      }
      return jsonResponse(committed);
    });
    const client = createGitHubCanonicalGapClient({
      repository: 'vellira-dev/vellira',
      token: 'explicit-test-auth',
      fetchImpl,
    });
    await expect(
      client.createIssue({ ...desired, ...{ assignees: ['injected'] } })
    ).rejects.toThrow(/connection lost/);
    const retried = await applyCanonicalGaps([request], client);
    expect(posts).toBe(1);
    expect(retried.results[0]).toMatchObject({
      action: 'linked-existing',
      issue: { number: 42 },
    });
    expect(JSON.stringify(retried)).not.toContain('explicit-test-auth');
  });
});
