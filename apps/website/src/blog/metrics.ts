export interface BlogMetrics {
  slug: string;
  views: number;
  likes: number;
}

export interface BlogLikeState {
  slug: string;
  liked: boolean;
}

export interface BlogMetricsWriteResponse {
  metrics: BlogMetrics;
}

export interface BlogLikeWriteResponse extends BlogMetricsWriteResponse {
  liked: boolean;
  changed: boolean;
}

export type BlogMetricsBySlug = Record<string, BlogMetrics>;

const BLOG_METRICS_PROXY_BASE_PATH = '/api/blog-metrics';

interface BlogMetricsRequestOptions {
  retries?: number;
}

function createBlogMetricsProxyPath(path: string): string {
  return `${BLOG_METRICS_PROXY_BASE_PATH}/${path.replace(/^\/+/, '')}`;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseBlogMetrics(value: unknown): BlogMetrics {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as BlogMetrics).slug !== 'string' ||
    !isNonNegativeInteger((value as BlogMetrics).views) ||
    !isNonNegativeInteger((value as BlogMetrics).likes)
  ) {
    throw new Error('Invalid blog metrics response');
  }

  return {
    slug: (value as BlogMetrics).slug,
    views: (value as BlogMetrics).views,
    likes: (value as BlogMetrics).likes,
  };
}

function parseBlogLikeState(value: unknown): BlogLikeState {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as BlogLikeState).slug !== 'string' ||
    typeof (value as BlogLikeState).liked !== 'boolean'
  ) {
    throw new Error('Invalid blog like response');
  }

  return {
    slug: (value as BlogLikeState).slug,
    liked: (value as BlogLikeState).liked,
  };
}

function parseBlogMetricsWriteResponse(
  value: unknown
): BlogMetricsWriteResponse {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid blog metrics write response');
  }

  return {
    metrics: parseBlogMetrics((value as BlogMetricsWriteResponse).metrics),
  };
}

function parseBlogLikeWriteResponse(value: unknown): BlogLikeWriteResponse {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as BlogLikeWriteResponse).liked !== 'boolean' ||
    typeof (value as BlogLikeWriteResponse).changed !== 'boolean'
  ) {
    throw new Error('Invalid blog like write response');
  }

  return {
    ...parseBlogMetricsWriteResponse(value),
    liked: (value as BlogLikeWriteResponse).liked,
    changed: (value as BlogLikeWriteResponse).changed,
  };
}

async function requestBlogMetricsJson(
  url: string | URL,
  init: RequestInit = {},
  options: BlogMetricsRequestOptions = {}
): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= (options.retries ?? 0); attempt += 1) {
    try {
      const response = await fetch(url, init);

      if (!response.ok) {
        throw new Error(`Blog metrics request failed with ${response.status}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function fetchBlogMetrics(slug: string): Promise<BlogMetrics> {
  const url = createBlogMetricsProxyPath(
    `metrics/${encodeURIComponent(slug)}`
  );
  const json = await requestBlogMetricsJson(
    url,
    {
      credentials: 'include',
      cache: 'no-store',
    },
    { retries: 1 }
  );

  return parseBlogMetrics(json);
}

export async function fetchBlogMetricsBatch(
  slugs: readonly string[]
): Promise<BlogMetricsBySlug> {
  const uniqueSlugs = Array.from(new Set(slugs));

  if (uniqueSlugs.length === 0) {
    return {};
  }

  const searchParams = new URLSearchParams();

  for (const slug of uniqueSlugs) {
    searchParams.append('slug', slug);
  }

  const url = `${createBlogMetricsProxyPath('metrics')}?${searchParams.toString()}`;
  const json = await requestBlogMetricsJson(
    url,
    {
      credentials: 'include',
      cache: 'no-store',
    },
    { retries: 1 }
  );

  if (
    typeof json !== 'object' ||
    json === null ||
    !Array.isArray((json as { items?: unknown }).items)
  ) {
    throw new Error('Invalid blog metrics batch response');
  }

  const metricsBySlug: BlogMetricsBySlug = {};

  for (const item of (json as { items: unknown[] }).items) {
    const metrics = parseBlogMetrics(item);
    metricsBySlug[metrics.slug] = metrics;
  }

  return metricsBySlug;
}

export async function registerBlogArticleView(
  slug: string
): Promise<BlogMetricsWriteResponse> {
  const url = createBlogMetricsProxyPath(
    `articles/${encodeURIComponent(slug)}/views`
  );
  const json = await requestBlogMetricsJson(url, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });

  return parseBlogMetricsWriteResponse(json);
}

export async function fetchBlogArticleLike(
  slug: string
): Promise<BlogLikeState> {
  const url = createBlogMetricsProxyPath(
    `articles/${encodeURIComponent(slug)}/like`
  );
  const json = await requestBlogMetricsJson(
    url,
    {
      credentials: 'include',
      cache: 'no-store',
    },
    { retries: 1 }
  );

  return parseBlogLikeState(json);
}

export async function likeBlogArticle(
  slug: string
): Promise<BlogLikeWriteResponse> {
  const url = createBlogMetricsProxyPath(
    `articles/${encodeURIComponent(slug)}/like`
  );
  const json = await requestBlogMetricsJson(url, {
    method: 'PUT',
    credentials: 'include',
    cache: 'no-store',
  });

  return parseBlogLikeWriteResponse(json);
}

export async function unlikeBlogArticle(
  slug: string
): Promise<BlogLikeWriteResponse> {
  const url = createBlogMetricsProxyPath(
    `articles/${encodeURIComponent(slug)}/like`
  );
  const json = await requestBlogMetricsJson(url, {
    method: 'DELETE',
    credentials: 'include',
    cache: 'no-store',
  });

  return parseBlogLikeWriteResponse(json);
}
