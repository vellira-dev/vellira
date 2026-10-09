import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchWithCloudflareEdgeRetry } from './cloudflare-edge-fetch.mjs';

function response(status, headers = {}) {
  return new Response(status === 200 ? 'ok' : 'unavailable', {
    status,
    headers,
  });
}

test('edge fetch retries Cloudflare-generated GET 503 and returns recovery', async () => {
  const responses = [
    response(503, { Server: 'cloudflare' }),
    response(200, {
      Server: 'cloudflare',
      'x-vellira-build-id': 'build-1',
    }),
  ];
  let sleeps = 0;

  const result = await fetchWithCloudflareEdgeRetry(
    'https://example.test/runtime',
    {},
    {
      fetchImpl: async () => responses.shift(),
      delayMs: 0,
      sleepImpl: async () => {
        sleeps += 1;
      },
    }
  );

  assert.equal(result.response.status, 200);
  assert.equal(result.attempts, 2);
  assert.equal(sleeps, 1);
});

test('edge fetch does not retry Worker 5xx', async () => {
  let calls = 0;
  const result = await fetchWithCloudflareEdgeRetry(
    'https://example.test/runtime',
    {},
    {
      fetchImpl: async () => {
        calls += 1;
        return response(503, {
          Server: 'cloudflare',
          'x-vellira-worker-version': 'worker-1',
        });
      },
      delayMs: 0,
    }
  );

  assert.equal(result.response.status, 503);
  assert.equal(result.attempts, 1);
  assert.equal(calls, 1);
});

test('edge fetch remains bounded when Cloudflare 503 persists', async () => {
  let calls = 0;
  const result = await fetchWithCloudflareEdgeRetry(
    'https://example.test/runtime',
    {},
    {
      maxAttempts: 3,
      fetchImpl: async () => {
        calls += 1;
        return response(503, { Server: 'cloudflare' });
      },
      delayMs: 0,
      sleepImpl: async () => {},
    }
  );

  assert.equal(result.response.status, 503);
  assert.equal(result.attempts, 3);
  assert.equal(calls, 3);
});


test('edge fetch never retries non-GET requests', async () => {
  let calls = 0;
  const result = await fetchWithCloudflareEdgeRetry(
    'https://example.test/mutation',
    { method: 'POST' },
    {
      fetchImpl: async () => {
        calls += 1;
        return response(503, { Server: 'cloudflare' });
      },
      delayMs: 0,
    }
  );

  assert.equal(result.response.status, 503);
  assert.equal(result.attempts, 1);
  assert.equal(calls, 1);
});
