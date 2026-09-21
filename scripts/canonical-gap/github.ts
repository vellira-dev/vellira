import {
  CanonicalGapError,
  extractCanonicalGapRequestId,
  type CanonicalGapIssueClient,
  type CanonicalGapIssueMutationInput,
  type CanonicalGapLabelDefinition,
  type CanonicalGapManagedIssue,
} from './types';
import { trustedGitHubNextPagePath } from './github-pagination';
import { parseTrustedGitHubRepository } from './github-repository';

type GitHubIssueResponse = {
  number: number;
  state: 'open' | 'closed';
  title: string;
  body: string | null;
  html_url: string;
  labels: Array<string | { name?: string | null }>;
  pull_request?: unknown;
};

type GitHubLabelResponse = {
  name: string;
};

export type GitHubCanonicalGapClientOptions = {
  repository: string;
  token?: string;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
};

export function createGitHubCanonicalGapClient(
  options: GitHubCanonicalGapClientOptions
): CanonicalGapIssueClient {
  const { owner, repo } = parseTrustedGitHubRepository(options.repository);
  const apiBaseUrl = options.apiBaseUrl ?? 'https://api.github.com';
  const fetchImpl = options.fetchImpl ?? fetch;

  async function requestResponse<T>(
    requestPath: string,
    init: RequestInit = {},
    requireAuth = false
  ): Promise<{ body: T; link: string | null }> {
    if (requireAuth && !options.token?.trim()) {
      throw new CanonicalGapError(
        'GITHUB_TOKEN is required for canonical gap GitHub mutations.'
      );
    }

    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/vnd.github+json');
    headers.set('X-GitHub-Api-Version', '2022-11-28');
    if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
    if (init.body) headers.set('Content-Type', 'application/json');

    const response = await fetchImpl(`${apiBaseUrl}${requestPath}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new CanonicalGapError(
        `GitHub API ${response.status} for ${requestPath}: ${detail.slice(0, 500)}`
      );
    }

    if (response.status === 204) return { body: undefined as T, link: null };
    return {
      body: (await response.json()) as T,
      link: response.headers.get('link'),
    };
  }

  async function request<T>(
    requestPath: string,
    init: RequestInit = {},
    requireAuth = false
  ): Promise<T> {
    return (await requestResponse<T>(requestPath, init, requireAuth)).body;
  }

  async function listAll<T>(requestPath: string): Promise<T[]> {
    const result: T[] = [];
    let nextPath: string | null = `${requestPath}${
      requestPath.includes('?') ? '&' : '?'
    }per_page=100`;
    while (nextPath) {
      const response = await requestResponse<T[]>(nextPath);
      result.push(...response.body);
      nextPath = trustedGitHubNextPagePath(response.link, apiBaseUrl);
    }
    return result;
  }

  return {
    async listManagedIssues() {
      const issues = await listAll<GitHubIssueResponse>(
        `/repos/${owner}/${repo}/issues?state=all`
      );

      return issues
        .filter((issue) => !issue.pull_request)
        .flatMap((issue): CanonicalGapManagedIssue[] => {
          const body = issue.body ?? '';
          const requestId = extractCanonicalGapRequestId(body);
          if (!requestId) return [];

          return [normalizeIssue(issue, requestId)];
        })
        .sort((left, right) => left.number - right.number);
    },

    async ensureLabels(definitions) {
      const labels = await listAll<GitHubLabelResponse>(
        `/repos/${owner}/${repo}/labels`
      );
      const existing = new Set(labels.map(({ name }) => name));

      for (const definition of [...definitions].sort((left, right) =>
        left.name.localeCompare(right.name)
      )) {
        if (existing.has(definition.name)) continue;
        await createLabel(definition);
        existing.add(definition.name);
      }
    },

    async createIssue(input) {
      const issue = await request<GitHubIssueResponse>(
        `/repos/${owner}/${repo}/issues`,
        {
          method: 'POST',
          body: mutationBody(input),
        },
        true
      );
      const body = issue.body ?? '';
      const requestId = extractCanonicalGapRequestId(body);
      if (!requestId) {
        throw new CanonicalGapError(
          `Created issue #${issue.number} did not preserve its canonical gap marker.`
        );
      }
      return normalizeIssue(issue, requestId);
    },
  };

  async function createLabel(definition: CanonicalGapLabelDefinition) {
    await request(
      `/repos/${owner}/${repo}/labels`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: definition.name,
          color: definition.color,
          description: definition.description,
        }),
      },
      true
    );
  }
}

function normalizeIssue(
  issue: GitHubIssueResponse,
  requestId: string
): CanonicalGapManagedIssue {
  return {
    number: issue.number,
    state: issue.state,
    url: issue.html_url,
    requestId,
    title: issue.title,
    body: issue.body ?? '',
    labels: issue.labels
      .map((label) => (typeof label === 'string' ? label : label.name))
      .filter((label): label is string => Boolean(label))
      .sort(),
  };
}

function mutationBody(input: CanonicalGapIssueMutationInput): string {
  return JSON.stringify({
    title: input.title,
    body: input.body,
    labels: input.labels,
  });
}
