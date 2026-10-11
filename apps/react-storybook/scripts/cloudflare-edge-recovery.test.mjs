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

const probeOptions = {
  url: 'https://example.test/blog?_rsc=proof',
  expectedBuildId: 'build-1',
  delayMs: 0,
  sleep: async () => {},
};
const timeout = () =>
  Object.assign(
    new Error(
      'apiRequestContext.get: Timeout 10000ms exceeded.\nCall log: secret'
    ),
    { name: 'TimeoutError' }
  );

function scriptedGet(outcomes) {
  const state = { calls: [], disposed: 0 };
  state.get = async (url, options) => {
    state.calls.push({ url, options });
    const next = outcomes[state.calls.length - 1];
    if (next instanceof Error) throw next;
    assert.ok(next, 'unexpected extra request');
    return {
      ...fakeResponse(next.status, next.headers),
      dispose: async () => {
        state.disposed++;
      },
    };
  };
  return state;
}
const exact = { status: 200, headers: { 'x-vellira-build-id': 'build-1' } };
const edge = { status: 503, headers: { server: 'cloudflare' } };

test('two transport timeouts consume attempts before exact-build recovery', async () => {
  const state = scriptedGet([timeout(), timeout(), exact]);
  const result = await recoverCloudflareEdgeGet5xx({
    ...probeOptions,
    requestGet: state.get,
  });
  assert.deepEqual(result, { recovered: true, attempts: 3, status: 200 });
  assert.equal(state.calls.length, 3);
  assert.equal(state.disposed, 1);
  for (const { options } of state.calls) {
    assert.equal(options.timeout, 10_000);
    assert.equal(options.maxRetries, 0);
    assert.equal(options.maxRedirects, 0);
  }
});

test('persistent transport timeout is structured, bounded and redacted', async () => {
  const state = scriptedGet([timeout(), timeout(), timeout()]);
  let sleeps = 0;
  const result = await recoverCloudflareEdgeGet5xx({
    ...probeOptions,
    requestGet: state.get,
    sleep: async () => {
      sleeps++;
    },
  });
  assert.equal(result.recovered, false);
  assert.equal(result.reason, 'transport-error');
  assert.equal(result.attempts, 3);
  assert.equal(state.calls.length, 3);
  assert.equal(sleeps, 2);
  assert.equal(state.disposed, 0);
  assert.doesNotMatch(result.error, /secret|Call log/);
});

for (const [label, outcomes, reason, calls, disposed] of [
  ['persistent edge 503', [edge, edge, edge], 'edge-5xx-persisted', 3, 3],
  [
    'transport then edge exhaustion',
    [timeout(), edge, edge],
    'edge-5xx-persisted',
    3,
    2,
  ],
  [
    'edge then transport exhaustion',
    [edge, timeout(), timeout()],
    'transport-error',
    3,
    1,
  ],
  [
    'wrong-build 200',
    [{ status: 200, headers: { 'x-vellira-build-id': 'other' } }, exact],
    'non-edge-or-build-mismatch',
    1,
    1,
  ],
  [
    'missing-build 200',
    [{ status: 200 }, exact],
    'non-edge-or-build-mismatch',
    1,
    1,
  ],
  [
    'redirect to healthy route',
    [{ status: 302, headers: { location: '/healthy' } }, exact],
    'non-edge-or-build-mismatch',
    1,
    1,
  ],
  ...['build-id', 'worker-version', 'request-id', 'asset-source'].map(
    (header) => [
      `Worker 503 x-vellira-${header}`,
      [
        {
          status: 503,
          headers: { server: 'cloudflare', [`x-vellira-${header}`]: 'worker' },
        },
        exact,
      ],
      'non-edge-or-build-mismatch',
      1,
      1,
    ]
  ),
]) {
  test(`fails closed and disposes responses: ${label}`, async () => {
    const state = scriptedGet(outcomes);
    const result = await recoverCloudflareEdgeGet5xx({
      ...probeOptions,
      requestGet: state.get,
    });
    assert.equal(result.recovered, false);
    assert.equal(result.reason, reason);
    assert.equal(state.calls.length, calls);
    assert.equal(state.disposed, disposed);
  });
}

for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
  test(`${method} cannot enter the GET replay transport`, async () => {
    const result = await recoverCloudflareEdgeGet5xx({
      ...probeOptions,
      method,
      requestGet: async () => assert.fail('mutation replay'),
    });
    assert.equal(result.reason, 'non-get');
    assert.equal(result.attempts, 0);
  });
}

test('missing expected build and static assets cannot enter edge recovery', async () => {
  for (const options of [
    { expectedBuildId: undefined },
    { expectedBuildId: ' ' },
    { url: 'https://example.test/_next/static/chunk.js' },
  ]) {
    const result = await recoverCloudflareEdgeGet5xx({
      ...probeOptions,
      ...options,
      requestGet: async () => assert.fail('unproven replay'),
    });
    assert.equal(result.recovered, false);
    assert.equal(result.attempts, 0);
  }
});

test('configuration, programming, response inspection and disposal errors are not transport failures', async () => {
  for (const options of [
    { maxAttempts: Infinity },
    { delayMs: -1 },
    { sleep: null },
    { requestGet: null },
    { url: 'broken URL' },
  ]) {
    await assert.rejects(
      recoverCloudflareEdgeGet5xx({ ...probeOptions, ...options })
    );
  }
  for (const error of [
    new TypeError('bad options'),
    new ReferenceError('missing binding'),
    new Error('context closed'),
  ]) {
    await assert.rejects(
      recoverCloudflareEdgeGet5xx({
        ...probeOptions,
        requestGet: async () => {
          throw error;
        },
      }),
      (actual) => actual === error
    );
  }
  let disposed = false;
  await assert.rejects(
    recoverCloudflareEdgeGet5xx({
      ...probeOptions,
      requestGet: async () => ({
        status() {
          throw new Error('inspection');
        },
        async dispose() {
          disposed = true;
        },
      }),
    }),
    /inspection/
  );
  assert.equal(disposed, true);
  await assert.rejects(
    recoverCloudflareEdgeGet5xx({
      ...probeOptions,
      requestGet: async () => ({
        ...fakeResponse(200, exact.headers),
        async dispose() {
          throw new Error('disposal');
        },
      }),
    }),
    /disposal/
  );
});

test('all caller failure records remain unhandled without shared exact-build proof', async () => {
  const { recoverCloudflareEdgeFailure } =
    await import('./cloudflare-edge-recovery.mjs');
  for (const outcomes of [
    [timeout(), timeout(), timeout()],
    [edge, edge, edge],
    [{ status: 200, headers: {} }],
  ]) {
    const failure = {
      ...edge,
      method: 'GET',
      url: probeOptions.url,
      requestHeaders: { RSC: '1', Cookie: 'secret', Authorization: 'secret' },
      handled: false,
    };
    const state = scriptedGet(outcomes);
    const result = await recoverCloudflareEdgeFailure(failure, {
      ...probeOptions,
      requestGet: state.get,
    });
    assert.equal(result.recovered, false);
    assert.equal(failure.handled, false);
    assert.deepEqual(failure.recovery, result);
    await recoverCloudflareEdgeFailure(failure, {
      ...probeOptions,
      requestGet: async () => assert.fail('cleanup reset attempt budget'),
    });
  }
  const failure = {
    ...edge,
    method: 'GET',
    url: probeOptions.url,
    handled: false,
  };
  await recoverCloudflareEdgeFailure(failure, {
    ...probeOptions,
    requestGet: scriptedGet([exact]).get,
  });
  assert.equal(failure.handled, true);
});

test('diagnostic GET retries transport but never static HTTP failures; disposes caller reads', async () => {
  const { readCloudflareDiagnosticGet } =
    await import('./cloudflare-edge-recovery.mjs');
  const state = scriptedGet([timeout(), edge, exact]);
  await readCloudflareDiagnosticGet(
    { ...probeOptions, requestGet: state.get },
    async (response) => {
      assert.equal(response.status(), 503);
    }
  );
  assert.equal(state.calls.length, 2);
  assert.equal(state.disposed, 1);
  const badBody = scriptedGet([exact]);
  await assert.rejects(
    readCloudflareDiagnosticGet(
      { ...probeOptions, requestGet: badBody.get },
      async () => {
        throw new Error('invalid manifest');
      }
    ),
    /invalid manifest/
  );
  assert.equal(badBody.disposed, 1);
  assert.equal(badBody.calls.length, 1);
});

test('real HTTP probes omit credentials, preserve router headers, isolate Set-Cookie and refuse redirects', async (t) => {
  const http = await import('node:http');
  const { isolatedCloudflareGet } =
    await import('./cloudflare-edge-recovery.mjs');
  const observed = [];
  const server = http.createServer((request, response) => {
    observed.push({ url: request.url, headers: request.headers });
    response.setHeader('set-cookie', 'probe_secret=value; Path=/');
    response.setHeader('server', 'cloudflare');
    if (request.url === '/redirect') {
      response.writeHead(302, { location: '/healthy' });
    } else if (observed.length === 1) {
      response.statusCode = 503;
    } else {
      response.setHeader('x-vellira-build-id', 'build-1');
    }
    response.end('fixture');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const options = {
    ...probeOptions,
    url: `${origin}/rsc`,
    requestGet: isolatedCloudflareGet,
    requestHeaders: {
      RSC: '1',
      'Next-Router-State-Tree': 'tree',
      Cookie: 'secret',
      Authorization: 'secret',
      'Proxy-Authorization': 'secret',
      'Next-Action': 'mutation',
    },
  };
  assert.equal((await recoverCloudflareEdgeGet5xx(options)).recovered, true);
  assert.equal(observed.length, 2);
  for (const { headers } of observed) {
    assert.equal(headers.cookie, undefined);
    assert.equal(headers.authorization, undefined);
    assert.equal(headers['proxy-authorization'], undefined);
    assert.equal(headers['next-action'], undefined);
    assert.equal(headers.rsc, '1');
    assert.equal(headers['next-router-state-tree'], 'tree');
  }
  assert.equal(
    (
      await recoverCloudflareEdgeGet5xx({
        ...options,
        url: `${origin}/redirect`,
      })
    ).recovered,
    false
  );
  assert.equal(observed.length, 3);
});

test('platform Worker termination 1102 without Vellira headers is never recovered by a later 200', async () => {
  const { readCloudflarePlatformFailure, recoverCloudflareEdgeFailure } =
    await import('./cloudflare-edge-recovery.mjs');
  const response = {
    headers: () => ({ server: 'cloudflare', 'content-type': 'text/html' }),
    text: async () =>
      '<span class="cf-error-code">1102</span><h2>Worker exceeded resource limits</h2>',
  };
  const platformFailure = readCloudflarePlatformFailure(response);
  let calls = 0;
  const failure = {
    url: 'https://example.test/blog',
    method: 'GET',
    status: 503,
    headers: response.headers(),
    handled: false,
    platformFailure,
  };
  const result = await recoverCloudflareEdgeFailure(failure, {
    expectedBuildId: 'build',
    requestGet: async () => {
      calls++;
      throw Error('must not probe');
    },
  });
  assert.equal(result.recovered, false);
  assert.equal(result.reason, 'worker-platform-error');
  assert.equal(result.code, '1102');
  assert.equal(failure.handled, false);
  assert.equal(calls, 0);
});

test('a probe Worker termination body fails closed without retry and disposes its response', async () => {
  let calls = 0,
    disposed = 0;
  const result = await recoverCloudflareEdgeGet5xx({
    url: 'https://example.test/blog',
    expectedBuildId: 'build',
    requestGet: async () => {
      calls++;
      return {
        status: () => 503,
        headers: () => ({ server: 'cloudflare', 'content-type': 'text/html' }),
        text: async () => '<span class="cf-error-code">1102</span>',
        dispose: async () => {
          disposed++;
        },
      };
    },
  });
  assert.equal(result.reason, 'worker-platform-error');
  assert.equal(calls, 1);
  assert.equal(disposed, 1);
});
