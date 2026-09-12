import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import './cloudflare-archive-client.test.mjs';
import {
  CANONICAL_REDIRECT_CACHE_CONTROL,
  canonicalHostRedirect,
  createWebsiteWorker,
} from '../cloudflare/cache-policy.mjs';
import {
  readDeploymentConfig,
  validateDeploymentTarget,
} from './cloudflare-target-config.mjs';
import { waitForRuntimeStability } from './cloudflare-runtime-stabilization.mjs';

function runtimeResponse({
  status = 200,
  buildId = 'build-A',
  workerVersion = 'version-A',
  requestId = 'request-A',
} = {}) {
  if (status !== 200) return new Response('not ready', { status });
  return new Response(
    JSON.stringify({ buildId, workerVersion, requestId }),
    {
      headers: {
        'content-type': 'application/json',
        'x-vellira-build-id': buildId,
        'x-vellira-worker-version': workerVersion,
        'x-vellira-request-id': requestId,
      },
    }
  );
}

test('www redirects permanently to the canonical apex and preserves path/query', async () => {
  const request = new Request(
    'https://www.vellira.dev/blog/two-runtimes?source=www&n=1'
  );
  const response = canonicalHostRedirect(request);
  assert.ok(response);
  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get('location'),
    'https://vellira.dev/blog/two-runtimes?source=www&n=1'
  );
  assert.equal(
    response.headers.get('cache-control'),
    CANONICAL_REDIRECT_CACHE_CONTROL
  );
  assert.equal(await response.text(), '');
  assert.equal(
    canonicalHostRedirect(new Request('https://vellira.dev/blog?source=apex')),
    null
  );
  assert.equal(
    canonicalHostRedirect(
      new Request('https://vellira-website.vellira.workers.dev/blog')
    ),
    null
  );
});

test('www redirect happens before OpenNext while retaining deployment identity headers', async () => {
  let handlerCalls = 0;
  const worker = createWebsiteWorker(
    {
      fetch: async () => {
        handlerCalls += 1;
        return new Response('unexpected');
      },
    },
    'build-A',
    () => {}
  );
  const response = await worker.fetch(
    new Request('https://www.vellira.dev/components/button?mode=test'),
    { CF_VERSION_METADATA: { id: 'version-A' } },
    {}
  );
  assert.equal(handlerCalls, 0);
  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get('location'),
    'https://vellira.dev/components/button?mode=test'
  );
  assert.equal(response.headers.get('x-vellira-build-id'), 'build-A');
  assert.equal(response.headers.get('x-vellira-worker-version'), 'version-A');
  assert.ok(response.headers.get('x-vellira-request-id'));
});

test('deployment target contract pins production custom domains and keeps staging isolated', () => {
  const staging = readDeploymentConfig(
    path.resolve(import.meta.dirname, '../wrangler.jsonc')
  );
  const production = readDeploymentConfig(
    path.resolve(import.meta.dirname, '../wrangler.production.jsonc')
  );
  assert.equal(staging.routes?.length ?? 0, 0);
  assert.deepEqual(
    production.routes
      .map(({ pattern, custom_domain }) => ({ pattern, custom_domain }))
      .sort((a, b) => a.pattern.localeCompare(b.pattern)),
    [
      { pattern: 'vellira.dev', custom_domain: true },
      { pattern: 'www.vellira.dev', custom_domain: true },
    ]
  );
  assert.throws(() =>
    validateDeploymentTarget({
      ...production,
      routes: production.routes.slice(0, 1),
    })
  );
  assert.throws(() =>
    validateDeploymentTarget({
      ...production,
      routes: [
        ...production.routes,
        { pattern: 'other.vellira.dev', custom_domain: true },
      ],
    })
  );
  assert.throws(() =>
    validateDeploymentTarget({
      ...production,
      routes: production.routes.map((route, index) =>
        index === 0 ? { ...route, custom_domain: false } : route
      ),
    })
  );
  assert.throws(() =>
    validateDeploymentTarget({
      ...staging,
      routes: [{ pattern: 'vellira.dev', custom_domain: true }],
    })
  );
});

test('runtime stabilization resets on stale/mixed propagation and requires one stable version', async () => {
  const responses = [
    runtimeResponse({ status: 404 }),
    runtimeResponse({ buildId: 'old-build', requestId: 'old-1' }),
    runtimeResponse({ workerVersion: 'version-A', requestId: 'a-1' }),
    runtimeResponse({ workerVersion: 'version-A', requestId: 'a-2' }),
    runtimeResponse({ workerVersion: 'version-B', requestId: 'b-1' }),
    runtimeResponse({ workerVersion: 'version-B', requestId: 'b-2' }),
    runtimeResponse({ workerVersion: 'version-B', requestId: 'b-3' }),
  ];
  let clock = 0;
  const result = await waitForRuntimeStability({
    base: 'https://vellira-website.vellira.workers.dev',
    expectedBuildId: 'build-A',
    consecutiveSuccesses: 3,
    timeoutMs: 10_000,
    intervalMs: 10,
    requestTimeoutMs: 1000,
    fetchImpl: async () => responses.shift() ?? runtimeResponse({ status: 503 }),
    sleepImpl: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    uuid: () => `probe-${clock}-${responses.length}`,
    log: () => {},
  });
  assert.equal(result.buildId, 'build-A');
  assert.equal(result.workerVersion, 'version-B');
  assert.equal(result.consecutiveSuccesses, 3);
  assert.equal(result.attempts, 7);
});

test('runtime stabilization fails closed when the activation never converges', async () => {
  let clock = 0;
  await assert.rejects(
    waitForRuntimeStability({
      base: 'https://vellira-website.vellira.workers.dev',
      expectedBuildId: 'build-A',
      consecutiveSuccesses: 2,
      timeoutMs: 3,
      intervalMs: 1,
      requestTimeoutMs: 1000,
      fetchImpl: async () => runtimeResponse({ status: 404 }),
      sleepImpl: async (ms) => {
        clock += ms;
      },
      now: () => clock,
      uuid: () => `probe-${clock}`,
      log: () => {},
    }),
    /Runtime did not stabilize/
  );
});
