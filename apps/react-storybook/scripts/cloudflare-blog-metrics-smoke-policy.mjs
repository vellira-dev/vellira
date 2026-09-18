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
