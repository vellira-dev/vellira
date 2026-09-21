import { describe, expect, it, vi } from 'vitest';

import { createComponentTokenReservationGitHubClient } from './github';

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('component-token reservation GitHub candidate authority', () => {
  it('reads immutable compare ancestry, commits, and complete changed paths', async () => {
    const source = 'a'.repeat(40);
    const head = 'b'.repeat(40);
    const fetchImpl = vi.fn<
      (input: unknown, init?: RequestInit) => Promise<Response>
    >(async () =>
      jsonResponse({
        status: 'ahead',
        ahead_by: 1,
        behind_by: 0,
        total_commits: 1,
        merge_base_commit: { sha: source },
        commits: [{ sha: head, parents: [{ sha: source }] }],
        files: [
          {
            filename: 'packages/metadata/src/tokenLifecycle.ts',
            status: 'modified',
          },
        ],
      })
    );
    const client = createComponentTokenReservationGitHubClient({
      repository: 'vellira-dev/vellira',
      token: 'workflow-token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(client.compareCandidate(source, head)).resolves.toEqual({
      status: 'ahead',
      aheadBy: 1,
      behindBy: 0,
      totalCommits: 1,
      mergeBaseSha: source,
      commits: [{ sha: head, parentShas: [source] }],
      files: [
        {
          path: 'packages/metadata/src/tokenLifecycle.ts',
          status: 'modified',
          previousPath: null,
        },
      ],
    });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      `https://api.github.com/repos/vellira-dev/vellira/compare/${source}...${head}`
    );
  });

  it('rejects non-immutable compare identities before GitHub access', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const client = createComponentTokenReservationGitHubClient({
      repository: 'vellira-dev/vellira',
      token: 'workflow-token',
      fetchImpl,
    });
    await expect(
      client.compareCandidate('main', 'feature-branch')
    ).rejects.toThrow(/exact revisions/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
