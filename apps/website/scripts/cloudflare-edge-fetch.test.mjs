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
      expectedBuildId: 'build-1',
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
      expectedBuildId: 'build-1',
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
  await assert.rejects(
    fetchWithCloudflareEdgeRetry(
      'https://example.test/runtime',
      {},
      {
        expectedBuildId: 'build-1',
        fetchImpl: async () => {
          calls++;
          return response(503, { Server: 'cloudflare' });
        },
        delayMs: 0,
        sleepImpl: async () => {},
      }
    ),
    /edge-5xx-persisted/
  );
  assert.equal(calls, 3);
});

test('edge fetch never retries non-GET requests', async () => {
  let calls = 0;
  const result = await fetchWithCloudflareEdgeRetry(
    'https://example.test/mutation',
    { method: 'POST' },
    {
      expectedBuildId: 'build-1',
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

test('runtime probes use shared timeout recovery and exact-build rejection', async () => {
  let calls = 0;
  const result = await fetchWithCloudflareEdgeRetry(
    'https://example.test/runtime',
    {},
    {
      expectedBuildId: 'build-1',
      delayMs: 0,
      sleepImpl: async () => {},
      fetchImpl: async () => {
        if (++calls < 3)
          throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
        return response(200, { 'x-vellira-build-id': 'build-1' });
      },
    }
  );
  assert.equal(result.attempts, 3);
  assert.equal(await result.response.text(), 'ok');
  await assert.rejects(
    fetchWithCloudflareEdgeRetry(
      'https://example.test/runtime',
      {},
      {
        expectedBuildId: 'build-1',
        fetchImpl: async () => response(200, { 'x-vellira-build-id': 'wrong' }),
      }
    ),
    /build-mismatch/
  );
});

test('runtime static asset HTTP failures remain blockers without HTTP retries', async () => {
  let calls = 0;
  const result = await fetchWithCloudflareEdgeRetry(
    'https://example.test/_next/static/chunk.js',
    {},
    {
      expectedBuildId: 'build-1',
      fetchImpl: async () => {
        calls++;
        return response(503, { Server: 'cloudflare' });
      },
    }
  );
  assert.equal(result.response.status, 503);
  assert.equal(calls, 1);
});

test('headerless immutable CDN assets preserve byte validation by the caller', async () => {
  const result = await fetchWithCloudflareEdgeRetry(
    'https://example.test/_next/static/chunk.js',
    {},
    {
      expectedBuildId: 'build-1',
      fetchImpl: async () => response(200),
    }
  );
  assert.equal(await result.response.text(), 'ok');
});

test('a streamed success timeout is retried before declaring exact-build recovery', async () => {
  let calls = 0;
  const result = await fetchWithCloudflareEdgeRetry(
    'https://example.test/runtime',
    {},
    {
      expectedBuildId: 'build-1',
      delayMs: 0,
      sleepImpl: async () => {},
      fetchImpl: async () =>
        ++calls === 1
          ? new Response(
              new ReadableStream({
                start(controller) {
                  controller.error(
                    Object.assign(new Error('body timeout'), {
                      name: 'TimeoutError',
                    })
                  );
                },
              }),
              { headers: { 'x-vellira-build-id': 'build-1' } }
            )
          : response(200, { 'x-vellira-build-id': 'build-1' }),
    }
  );
  assert.equal(result.attempts, 2);
  assert.equal(await result.response.text(), 'ok');
});

test('invalid runtime probe configuration fails before even a non-retried mutation', async () => {
  for (const invalid of [{ maxAttempts: 0 }, { delayMs: -1 }]) {
    await assert.rejects(
      fetchWithCloudflareEdgeRetry(
        'https://example.test/mutation',
        { method: 'POST' },
        {
          ...invalid,
          fetchImpl: async () =>
            assert.fail('invalid configuration sent a request'),
        }
      ),
      /maxAttempts|delayMs/
    );
  }
});

test('a headerless Worker resource termination never becomes a successful native recovery', async () => {
  let calls = 0;
  let signal;
  await assert.rejects(
    fetchWithCloudflareEdgeRetry(
      'https://example.test/runtime',
      {},
      {
        expectedBuildId: 'build-1',
        fetchImpl: async (_url, options) => {
          calls++;
          signal = options.signal;
          return new Response('<span class="cf-error-code">1102</span>', {
            status: 503,
            headers: { server: 'cloudflare', 'content-type': 'text/html' },
          });
        },
      }
    ),
    /worker-platform-error/
  );
  assert.equal(calls, 1);
  assert.equal(signal.aborted, true, 'discarded probe releases its transport');
});
