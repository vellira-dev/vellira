import {
  CanonicalGapError,
  extractCanonicalGapRequestId,
  type CanonicalGapManagedIssue,
} from '../canonical-gap/types';
import { trustedGitHubNextPagePath } from '../canonical-gap/github-pagination';
import { parseTrustedGitHubRepository } from '../canonical-gap/github-repository';

export type ReservationPullRequest = {
  number: number;
  state: 'open' | 'closed';
  url: string;
  title: string;
  body: string;
  headRef: string;
  headRepository: string;
  baseRef: string;
  baseRepository: string;
};

export type ReservationRepository = {
  defaultBranch: string;
};

export type ReservationFile = {
  sha: string;
  content: string;
};

export interface ComponentTokenReservationGitHubClient {
  getRepository(): Promise<ReservationRepository>;
  getBranchSha(branch: string): Promise<string | null>;
  getIssue(number: number): Promise<CanonicalGapManagedIssue>;
  listManagedIssues(): Promise<readonly CanonicalGapManagedIssue[]>;
  listPullRequests(
    headBranch: string
  ): Promise<readonly ReservationPullRequest[]>;
  getFile(filePath: string, revision: string): Promise<ReservationFile>;
  createBranch(branch: string, sourceRevision: string): Promise<void>;
  updateFile(params: {
    filePath: string;
    branch: string;
    fileSha: string;
    content: string;
    message: string;
  }): Promise<void>;
  createPullRequest(params: {
    title: string;
    body: string;
    headBranch: string;
    baseBranch: string;
  }): Promise<ReservationPullRequest>;
}

type GitHubIssue = {
  number: number;
  state: 'open' | 'closed';
  html_url: string;
  title: string;
  body: string | null;
  labels: Array<string | { name?: string | null }>;
  pull_request?: unknown;
};

type GitHubPull = {
  number: number;
  state: 'open' | 'closed';
  html_url: string;
  title: string;
  body: string | null;
  head: { ref: string; repo: { full_name: string } | null };
  base: { ref: string; repo: { full_name: string } | null };
};

export function createComponentTokenReservationGitHubClient(options: {
  repository: string;
  token: string;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
}): ComponentTokenReservationGitHubClient {
  const { owner, repo } = parseTrustedGitHubRepository(options.repository);
  if (!options.token.trim()) {
    throw new CanonicalGapError(
      'GITHUB_TOKEN is required for component-token reservation GitHub access.'
    );
  }
  const apiBaseUrl = options.apiBaseUrl ?? 'https://api.github.com';
  const fetchImpl = options.fetchImpl ?? fetch;
  const repositoryPath = `/repos/${owner}/${repo}`;

  async function response<T>(
    requestPath: string,
    init: RequestInit = {}
  ): Promise<{ body: T; link: string | null; status: number }> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/vnd.github+json');
    headers.set('X-GitHub-Api-Version', '2022-11-28');
    headers.set('Authorization', `Bearer ${options.token}`);
    if (init.body) headers.set('Content-Type', 'application/json');
    const result = await fetchImpl(`${apiBaseUrl}${requestPath}`, {
      ...init,
      headers,
    });
    if (!result.ok) {
      const detail = await result.text();
      throw new CanonicalGapError(
        `GitHub API ${result.status} for ${requestPath}: ${detail.slice(0, 500)}`
      );
    }
    return {
      body:
        result.status === 204 ? (undefined as T) : ((await result.json()) as T),
      link: result.headers.get('link'),
      status: result.status,
    };
  }

  async function request<T>(requestPath: string, init: RequestInit = {}) {
    return (await response<T>(requestPath, init)).body;
  }

  async function listAll<T>(requestPath: string) {
    const result: T[] = [];
    let next: string | null = `${requestPath}${
      requestPath.includes('?') ? '&' : '?'
    }per_page=100`;
    while (next) {
      const page = await response<T[]>(next);
      result.push(...page.body);
      next = trustedGitHubNextPagePath(page.link, apiBaseUrl);
    }
    return result;
  }

  return {
    async getRepository() {
      const value = await request<{ default_branch: string }>(repositoryPath);
      if (!value.default_branch) {
        throw new CanonicalGapError('GitHub repository has no default branch.');
      }
      return { defaultBranch: value.default_branch };
    },

    async getBranchSha(branch) {
      const requestPath = `${repositoryPath}/git/ref/heads/${encodePath(branch)}`;
      const headers = new Headers({
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${options.token}`,
      });
      const result = await fetchImpl(`${apiBaseUrl}${requestPath}`, {
        headers,
      });
      if (result.status === 404) return null;
      if (!result.ok) {
        throw new CanonicalGapError(
          `GitHub API ${result.status} for ${requestPath}: ${(await result.text()).slice(0, 500)}`
        );
      }
      const value = (await result.json()) as { object?: { sha?: string } };
      return value.object?.sha ?? null;
    },

    async getIssue(number) {
      const issue = await request<GitHubIssue>(
        `${repositoryPath}/issues/${number}`
      );
      if (issue.pull_request) {
        throw new CanonicalGapError(
          `#${number} is a pull request, not a managed reservation issue.`
        );
      }
      return normalizeIssue(issue);
    },

    async listManagedIssues() {
      return (await listAll<GitHubIssue>(`${repositoryPath}/issues?state=all`))
        .filter((issue) => !issue.pull_request)
        .flatMap((issue) =>
          extractCanonicalGapRequestId(issue.body ?? '')
            ? [normalizeIssue(issue)]
            : []
        )
        .sort((left, right) => left.number - right.number);
    },

    async listPullRequests(headBranch) {
      const query = new URLSearchParams({
        state: 'all',
        head: `${owner}:${headBranch}`,
      });
      return (
        await listAll<GitHubPull>(`${repositoryPath}/pulls?${query}`)
      ).map(normalizePull);
    },

    async getFile(filePath, revision) {
      const query = new URLSearchParams({ ref: revision });
      const value = await request<{
        type: string;
        sha: string;
        encoding: string;
        content: string;
      }>(`${repositoryPath}/contents/${encodePath(filePath)}?${query}`);
      if (value.type !== 'file' || value.encoding !== 'base64') {
        throw new CanonicalGapError(
          `Unexpected GitHub content response for ${filePath}.`
        );
      }
      return {
        sha: value.sha,
        content: Buffer.from(
          value.content.replace(/\s/g, ''),
          'base64'
        ).toString('utf8'),
      };
    },

    async createBranch(branch, sourceRevision) {
      await request(`${repositoryPath}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha: sourceRevision,
        }),
      });
    },

    async updateFile(params) {
      await request(
        `${repositoryPath}/contents/${encodePath(params.filePath)}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            message: params.message,
            content: Buffer.from(params.content, 'utf8').toString('base64'),
            sha: params.fileSha,
            branch: params.branch,
          }),
        }
      );
    },

    async createPullRequest(params) {
      return normalizePull(
        await request<GitHubPull>(`${repositoryPath}/pulls`, {
          method: 'POST',
          body: JSON.stringify({
            title: params.title,
            body: params.body,
            head: params.headBranch,
            base: params.baseBranch,
          }),
        })
      );
    },
  };

  function normalizeIssue(issue: GitHubIssue): CanonicalGapManagedIssue {
    const body = issue.body ?? '';
    const requestId = extractCanonicalGapRequestId(body);
    if (!requestId) {
      throw new CanonicalGapError(
        `Issue #${issue.number} is not a managed canonical-gap issue.`
      );
    }
    return {
      number: issue.number,
      state: issue.state,
      url: issue.html_url,
      requestId,
      title: issue.title,
      body,
      labels: issue.labels
        .map((label) => (typeof label === 'string' ? label : label.name))
        .filter((label): label is string => Boolean(label))
        .sort(),
    };
  }

  function normalizePull(pull: GitHubPull): ReservationPullRequest {
    return {
      number: pull.number,
      state: pull.state,
      url: pull.html_url,
      title: pull.title,
      body: pull.body ?? '',
      headRef: pull.head.ref,
      headRepository: pull.head.repo?.full_name ?? '',
      baseRef: pull.base.ref,
      baseRepository: pull.base.repo?.full_name ?? '',
    };
  }
}

function encodePath(value: string) {
  return value.split('/').map(encodeURIComponent).join('/');
}
