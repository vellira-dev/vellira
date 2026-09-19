const CANONICAL_BLOG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const BLOG_METRICS_PUBLICATION_MODE_STRICT = 'strict';
export const BLOG_METRICS_PUBLICATION_MODE_STAGING_CANDIDATE =
  'staging-candidate';

export function resolveBlogMetricsPublicationMode(rawMode) {
  const mode = rawMode?.trim() || BLOG_METRICS_PUBLICATION_MODE_STRICT;

  if (
    mode !== BLOG_METRICS_PUBLICATION_MODE_STRICT &&
    mode !== BLOG_METRICS_PUBLICATION_MODE_STAGING_CANDIDATE
  ) {
    throw new Error(`Unsupported blog metrics publication mode: ${mode}`);
  }

  return mode;
}

export function parseBlogMetricsErrorCode(payload) {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof payload.error !== 'object' ||
    payload.error === null ||
    typeof payload.error.code !== 'string'
  ) {
    return null;
  }

  return payload.error.code;
}

export function parseBlogPublicationManifest(
  payload,
  label = 'blog publication manifest'
) {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    payload.schemaVersion !== 1 ||
    !Array.isArray(payload.slugs)
  ) {
    throw new Error(`${label} has an invalid schema.`);
  }

  const seen = new Set();
  const slugs = [];

  for (const value of payload.slugs) {
    if (typeof value !== 'string' || !CANONICAL_BLOG_SLUG.test(value)) {
      throw new Error(`${label} contains an invalid canonical slug.`);
    }
    if (seen.has(value)) {
      throw new Error(`${label} contains duplicate slug ${value}.`);
    }

    seen.add(value);
    slugs.push(value);
  }

  return slugs.sort();
}

export function candidateOnlyBlogSlugs(candidateSlugs, productionSlugs) {
  const production = new Set(productionSlugs);
  return candidateSlugs.filter((slug) => !production.has(slug)).sort();
}

export function buildBlogMetricsBatchPath(slugs) {
  if (slugs.length === 0) {
    throw new Error('Blog metrics batch requires at least one published slug.');
  }

  const params = new URLSearchParams();
  for (const slug of slugs) {
    params.append('slug', slug);
  }

  return `/api/blog-metrics/metrics?${params.toString()}`;
}

export function isExpectedStagingCandidateBlogMetricsRequest({
  requestUrl,
  method,
  baseOrigin,
  candidateOnlySlugs = [],
}) {
  if (
    !isPotentialStagingCandidateBlogMetricsRequest({
      requestUrl,
      method,
      baseOrigin,
    }) ||
    candidateOnlySlugs.length === 0
  ) {
    return false;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(requestUrl);
  } catch {
    return false;
  }

  const candidates = new Set(candidateOnlySlugs);
  const normalizedMethod = String(method).toUpperCase();

  if (parsedUrl.pathname === '/api/blog-metrics/metrics') {
    return parsedUrl.searchParams
      .getAll('slug')
      .some((slug) => candidates.has(slug));
  }

  const singleMetricsMatch =
    /^\/api\/blog-metrics\/metrics\/([^/]+)$/.exec(parsedUrl.pathname);
  if (normalizedMethod === 'GET' && singleMetricsMatch) {
    try {
      return candidates.has(decodeURIComponent(singleMetricsMatch[1]));
    } catch {
      return false;
    }
  }

  const articleMatch =
    /^\/api\/blog-metrics\/articles\/([^/]+)\/(views|like)$/.exec(
      parsedUrl.pathname
    );
  if (!articleMatch) {
    return false;
  }

  let slug;
  try {
    slug = decodeURIComponent(articleMatch[1]);
  } catch {
    return false;
  }

  if (!candidates.has(slug)) {
    return false;
  }

  return (
    (articleMatch[2] === 'like' && normalizedMethod === 'GET') ||
    (articleMatch[2] === 'views' && normalizedMethod === 'POST')
  );
}

// This deliberately identifies only requests which may later be accepted after
// a staging-vs-production manifest delta proves their slug candidate-only. It
// is diagnostic retention, not an allowance: callers must still apply
// isExpectedStagingCandidateBlogMetricsRequest before handling the 404.
export function isPotentialStagingCandidateBlogMetricsRequest({
  requestUrl,
  method,
  baseOrigin,
}) {
  let parsedUrl;
  let expectedOrigin;

  try {
    parsedUrl = new URL(requestUrl);
    expectedOrigin = new URL(baseOrigin).origin;
  } catch {
    return false;
  }

  if (parsedUrl.origin !== expectedOrigin) {
    return false;
  }

  const normalizedMethod = String(method).toUpperCase();
  if (
    normalizedMethod === 'GET' &&
    parsedUrl.pathname === '/api/blog-metrics/metrics'
  ) {
    return true;
  }

  if (
    normalizedMethod === 'GET' &&
    /^\/api\/blog-metrics\/metrics\/[^/]+$/.test(parsedUrl.pathname)
  ) {
    return true;
  }

  return (
    (normalizedMethod === 'GET' &&
      /^\/api\/blog-metrics\/articles\/[^/]+\/like$/.test(
        parsedUrl.pathname
      )) ||
    (normalizedMethod === 'POST' &&
      /^\/api\/blog-metrics\/articles\/[^/]+\/views$/.test(
        parsedUrl.pathname
      ))
  );
}

export function classifyBlogMetricsAggregateResponse({
  mode,
  status,
  errorCode,
  attempt,
  maxAttempts,
  candidateOnlySlugs = [],
}) {
  if (status >= 200 && status < 300) {
    return 'ready';
  }

  if (status === 404 && errorCode === 'article_not_found') {
    if (
      mode === BLOG_METRICS_PUBLICATION_MODE_STAGING_CANDIDATE &&
      candidateOnlySlugs.length > 0
    ) {
      return 'expected-catalog-lag';
    }

    if (
      mode === BLOG_METRICS_PUBLICATION_MODE_STRICT &&
      attempt < maxAttempts
    ) {
      return 'retry';
    }
  }

  return 'fail';
}

export function isBrowserResource404ConsoleError(text) {
  return /^Failed to load resource: the server responded with a status of 404(?: \([^)]*\))?$/.test(
    text
  );
}

export function reconcileHandledBlogMetrics404ConsoleDiagnostics(
  diagnostics,
  handledBlogMetrics404Count
) {
  if (
    !Number.isSafeInteger(handledBlogMetrics404Count) ||
    handledBlogMetrics404Count < 0
  ) {
    throw new Error('handledBlogMetrics404Count must be a non-negative integer.');
  }

  const expectedCount = Math.min(
    diagnostics.length,
    handledBlogMetrics404Count
  );

  return {
    expected: diagnostics.slice(0, expectedCount),
    critical: diagnostics.slice(expectedCount),
  };
}
