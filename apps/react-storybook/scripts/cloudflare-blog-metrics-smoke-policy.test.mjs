import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BLOG_METRICS_PUBLICATION_MODE_STAGING_CANDIDATE,
  BLOG_METRICS_PUBLICATION_MODE_STRICT,
  buildBlogMetricsBatchPath,
  candidateOnlyBlogSlugs,
  classifyBlogMetricsAggregateResponse,
  isBrowserResource404ConsoleError,
  reconcileHandledBlogMetrics404ConsoleDiagnostics,
  parseBlogMetricsErrorCode,
  parseBlogPublicationManifest,
  resolveBlogMetricsPublicationMode,
} from './cloudflare-blog-metrics-smoke-policy.mjs';

test('publication mode defaults to strict and rejects unknown values', () => {
  assert.equal(
    resolveBlogMetricsPublicationMode(undefined),
    BLOG_METRICS_PUBLICATION_MODE_STRICT
  );
  assert.equal(
    resolveBlogMetricsPublicationMode('staging-candidate'),
    BLOG_METRICS_PUBLICATION_MODE_STAGING_CANDIDATE
  );
  assert.throws(
    () => resolveBlogMetricsPublicationMode('permissive'),
    /Unsupported blog metrics publication mode/
  );
});

test('manifest parsing is deterministic and fail-closed', () => {
  assert.deepEqual(
    parseBlogPublicationManifest({
      schemaVersion: 1,
      slugs: ['two-runtimes', 'ai-ui-consistency'],
    }),
    ['ai-ui-consistency', 'two-runtimes']
  );
  assert.throws(
    () =>
      parseBlogPublicationManifest({
        schemaVersion: 1,
        slugs: ['two-runtimes', 'two-runtimes'],
      }),
    /duplicate slug/
  );
  assert.throws(
    () => parseBlogPublicationManifest({ schemaVersion: 2, slugs: [] }),
    /invalid schema/
  );
});

test('staging accepts only proven candidate-only publication lag', () => {
  const candidateOnly = candidateOnlyBlogSlugs(
    ['ai-ui-consistency', 'two-runtimes'],
    ['two-runtimes']
  );
  assert.deepEqual(candidateOnly, ['ai-ui-consistency']);

  assert.equal(
    classifyBlogMetricsAggregateResponse({
      mode: BLOG_METRICS_PUBLICATION_MODE_STAGING_CANDIDATE,
      status: 404,
      errorCode: 'article_not_found',
      attempt: 1,
      maxAttempts: 1,
      candidateOnlySlugs: candidateOnly,
    }),
    'expected-catalog-lag'
  );

  assert.equal(
    classifyBlogMetricsAggregateResponse({
      mode: BLOG_METRICS_PUBLICATION_MODE_STAGING_CANDIDATE,
      status: 404,
      errorCode: 'article_not_found',
      attempt: 1,
      maxAttempts: 1,
      candidateOnlySlugs: [],
    }),
    'fail'
  );

  assert.equal(
    classifyBlogMetricsAggregateResponse({
      mode: BLOG_METRICS_PUBLICATION_MODE_STAGING_CANDIDATE,
      status: 503,
      errorCode: 'metrics_unavailable',
      attempt: 1,
      maxAttempts: 1,
      candidateOnlySlugs: ['ai-ui-consistency'],
    }),
    'fail'
  );
});

test('strict production retries only publication lag and never accepts it', () => {
  assert.equal(
    classifyBlogMetricsAggregateResponse({
      mode: BLOG_METRICS_PUBLICATION_MODE_STRICT,
      status: 404,
      errorCode: 'article_not_found',
      attempt: 1,
      maxAttempts: 6,
    }),
    'retry'
  );
  assert.equal(
    classifyBlogMetricsAggregateResponse({
      mode: BLOG_METRICS_PUBLICATION_MODE_STRICT,
      status: 404,
      errorCode: 'article_not_found',
      attempt: 6,
      maxAttempts: 6,
    }),
    'fail'
  );
  assert.equal(
    classifyBlogMetricsAggregateResponse({
      mode: BLOG_METRICS_PUBLICATION_MODE_STRICT,
      status: 200,
      errorCode: null,
      attempt: 1,
      maxAttempts: 6,
    }),
    'ready'
  );
});

test('error envelope and batch path helpers preserve proxy contract', () => {
  assert.equal(
    parseBlogMetricsErrorCode({
      error: {
        code: 'article_not_found',
        message: 'Article not found.',
        requestId: 'request',
      },
    }),
    'article_not_found'
  );
  assert.equal(parseBlogMetricsErrorCode({ error: 'bad' }), null);
  assert.equal(
    buildBlogMetricsBatchPath(['two-runtimes', 'ai-ui-consistency']),
    '/api/blog-metrics/metrics?slug=two-runtimes&slug=ai-ui-consistency'
  );
});

test('handled aggregate 404s consume only matching browser resource noise', () => {
  assert.equal(
    isBrowserResource404ConsoleError(
      'Failed to load resource: the server responded with a status of 404 ()'
    ),
    true
  );
  assert.equal(
    isBrowserResource404ConsoleError(
      'Failed to load resource: the server responded with a status of 404 (Not Found)'
    ),
    true
  );
  assert.equal(
    isBrowserResource404ConsoleError(
      'Failed to load resource: the server responded with a status of 503 (Service Unavailable)'
    ),
    false
  );
  assert.equal(
    isBrowserResource404ConsoleError('application console failure'),
    false
  );

  assert.deepEqual(
    reconcileHandledBlogMetrics404ConsoleDiagnostics(
      ['console-404-a', 'console-404-b'],
      1
    ),
    {
      expected: ['console-404-a'],
      critical: ['console-404-b'],
    }
  );
  assert.deepEqual(
    reconcileHandledBlogMetrics404ConsoleDiagnostics(['console-404-a'], 0),
    {
      expected: [],
      critical: ['console-404-a'],
    }
  );
  assert.throws(
    () =>
      reconcileHandledBlogMetrics404ConsoleDiagnostics(
        ['console-404-a'],
        -1
      ),
    /non-negative integer/
  );
});
