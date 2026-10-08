import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cloudflareEdgeReplayHeaders,
  isBrowserResource5xxConsoleError,
  isCloudflareEdgeGeneratedGet5xx,
  reconcileHandledCloudflareEdgeConsoleDiagnostics,
  recoverCloudflareEdgeGet5xx,
} from './cloudflare-edge-recovery.mjs';

test('classifies only Cloudflare edge GET 5xx responses without Vellira execution headers', () => {
  assert.equal(
    isCloudflareEdgeGeneratedGet5xx({
      status: 503,
      method: 'GET',
      headers: { server: 'cloudflare', 'content-type': 'text/html' },
    }),
    true
  );
  assert.equal(
    isCloudflareEdgeGeneratedGet5xx({
      status: 503,
      method: 'POST',
      headers: { server: 'cloudflare' },
    }),
    false
  );
  assert.equal(
    isCloudflareEdgeGeneratedGet5xx({
      status: 404,
      method: 'GET',
      headers: { server: 'cloudflare' },
    }),
    false
  );
  assert.equal(
    isCloudflareEdgeGeneratedGet5xx({
      status: 503,
      method: 'GET',
      headers: {
        server: 'cloudflare',
        'x-vellira-worker-version': 'worker-version',
      },
    }),
    false
  );
});

test('builds a bounded read-only router replay header set', () => {
  assert.deepEqual(
    cloudflareEdgeReplayHeaders({
      Accept: 'text/x-component',
      RSC: '1',
      'Next-Router-Prefetch': '1',
      Cookie: 'secret',
      Authorization: 'secret',
    }),
    {
      'Cache-Control': 'no-cache',
      accept: 'text/x-component',
      rsc: '1',
      'next-router-prefetch': '1',
    }
  );
});

test('reconciles browser 5xx console noise only after a handled edge response', () => {
  const diagnostics = ['first', 'second'];
  assert.deepEqual(
    reconcileHandledCloudflareEdgeConsoleDiagnostics(diagnostics, 1),
    {
      expected: ['first'],
      critical: ['second'],
    }
  );
  assert.equal(
    isBrowserResource5xxConsoleError(
      'Failed to load resource: the server responded with a status of 503 ()'
    ),
    true
  );
  assert.equal(
    isBrowserResource5xxConsoleError(
      'Failed to load resource: the server responded with a status of 404 ()'
    ),
    false
  );
});


function fakeResponse(status, headers = {}) {
  return {
    status: () => status,
    headers: () => headers,
    async dispose() {},
  };
}

test('bounded edge recovery requires exact active build after transient Cloudflare 503', async () => {
  const responses = [
    fakeResponse(503, { server: 'cloudflare' }),
    fakeResponse(200, {
      server: 'cloudflare',
      'x-vellira-build-id': 'build-1',
    }),
  ];
  const result = await recoverCloudflareEdgeGet5xx({
    url: 'https://example.test/blog?_rsc=abc',
    requestHeaders: { RSC: '1' },
    expectedBuildId: 'build-1',
    requestGet: async () => responses.shift(),
    delayMs: 0,
    sleep: async () => {},
  });

  assert.deepEqual(result, {
    recovered: true,
    attempts: 2,
    status: 200,
  });
});

test('edge recovery fails closed for Worker 5xx and wrong-build success', async () => {
  const workerFailure = await recoverCloudflareEdgeGet5xx({
    url: 'https://example.test/blog?_rsc=abc',
    expectedBuildId: 'build-1',
    requestGet: async () =>
      fakeResponse(503, {
        server: 'cloudflare',
        'x-vellira-worker-version': 'worker',
      }),
    delayMs: 0,
  });
  assert.equal(workerFailure.recovered, false);
  assert.equal(workerFailure.reason, 'non-edge-or-build-mismatch');

  const wrongBuild = await recoverCloudflareEdgeGet5xx({
    url: 'https://example.test/blog?_rsc=abc',
    expectedBuildId: 'build-1',
    requestGet: async () =>
      fakeResponse(200, {
        server: 'cloudflare',
        'x-vellira-build-id': 'build-2',
      }),
    delayMs: 0,
  });
  assert.equal(wrongBuild.recovered, false);
  assert.equal(wrongBuild.reason, 'non-edge-or-build-mismatch');
});
