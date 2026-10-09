import assert from 'node:assert/strict';
import test from 'node:test';

import {
  destinationEdgeFailures,
  isRecoveredDocumentFallback,
  isSafeClientNavigationReplay,
  runRecoverableClientNavigation,
} from './cloudflare-client-navigation-recovery.mjs';

test('client navigation retries only after a proven edge recovery', async () => {
  let prepareCalls = 0;
  let actionCalls = 0;
  let retryCalls = 0;
  let failures = [];

  const result = await runRecoverableClientNavigation({
    stage: 'blog navigation',
    maxAttempts: 3,
    prepareAttempt: async () => {
      prepareCalls += 1;
    },
    runAttempt: async () => {
      actionCalls += 1;
      if (actionCalls === 1) {
        failures.push({ url: '/blog?_rsc=1' });
        throw new Error('navigation timeout');
      }
      return 'ok';
    },
    failureCursor: () => failures.length,
    failuresSince: (cursor) => failures.slice(cursor),
    recoverFailures: async (items) => items.length === 1,
    beforeRetry: async () => {
      retryCalls += 1;
    },
  });

  assert.equal(result, 'ok');
  assert.equal(prepareCalls, 2);
  assert.equal(actionCalls, 2);
  assert.equal(retryCalls, 1);
});

test('client navigation fails closed without a matching recoverable edge failure', async () => {
  await assert.rejects(
    runRecoverableClientNavigation({
      stage: 'blog navigation',
      maxAttempts: 3,
      prepareAttempt: async () => {},
      runAttempt: async () => {
        throw new Error('real navigation failure');
      },
      failureCursor: () => 0,
      failuresSince: () => [],
      recoverFailures: async () => true,
    }),
    /real navigation failure/
  );
});

test('destination matching ignores unrelated background edge failures', () => {
  const failures = [
    { url: 'https://vellira.test/blog/two-runtimes?_rsc=abc' },
    { url: 'https://vellira.test/login?_rsc=def' },
    { url: 'https://vellira.test/api/blog-metrics/articles/two-runtimes/like' },
  ];

  assert.deepEqual(destinationEdgeFailures(failures, '/blog/two-runtimes'), [
    failures[0],
  ]);
});

test('client navigation does not retry when edge recovery is not proven', async () => {
  let actionCalls = 0;
  const failures = [{ url: '/blog/two-runtimes?_rsc=1' }];

  await assert.rejects(
    runRecoverableClientNavigation({
      stage: 'blog navigation',
      maxAttempts: 3,
      prepareAttempt: async () => {},
      runAttempt: async () => {
        actionCalls += 1;
        throw new Error('navigation timeout');
      },
      failureCursor: () => 0,
      failuresSince: () => failures,
      recoverFailures: async () => false,
    }),
    /navigation timeout/
  );

  assert.equal(actionCalls, 1);
});

test('client navigation respects the maximum attempt bound', async () => {
  let actionCalls = 0;
  const failures = [{ url: '/blog/two-runtimes?_rsc=1' }];

  await assert.rejects(
    runRecoverableClientNavigation({
      stage: 'blog navigation',
      maxAttempts: 3,
      prepareAttempt: async () => {},
      runAttempt: async () => {
        actionCalls += 1;
        throw new Error('navigation timeout');
      },
      failureCursor: () => 0,
      failuresSince: () => failures,
      recoverFailures: async () => true,
      beforeRetry: async () => {},
    }),
    /navigation timeout/
  );

  assert.equal(actionCalls, 3);
});

const documentFallbackFixture = {
  href: '/components/accordion',
  baseUrl: 'https://vellira.test',
  expectedBuildId: 'build-1',
  edgeRecovered: true,
  previousDocumentSequence: 4,
  documentResponse: {
    sequence: 5,
    url: 'https://vellira.test/components/accordion',
    status: 200,
    headers: {
      'x-vellira-build-id': 'build-1',
      'x-vellira-worker-version': 'worker-1',
      'x-vellira-request-id': 'request-1',
      'cache-control': 'no-cache, max-age=0, must-revalidate',
      'cloudflare-cdn-cache-control': 'no-store',
    },
  },
};

test('document fallback is accepted only after recovered destination edge failure on exact build', () => {
  assert.equal(isRecoveredDocumentFallback(documentFallbackFixture), true);
});

test('document fallback fails closed without edge proof, exact build, or a new document', () => {
  assert.equal(
    isRecoveredDocumentFallback({
      ...documentFallbackFixture,
      edgeRecovered: false,
    }),
    false
  );
  assert.equal(
    isRecoveredDocumentFallback({
      ...documentFallbackFixture,
      documentResponse: {
        ...documentFallbackFixture.documentResponse,
        headers: {
          ...documentFallbackFixture.documentResponse.headers,
          'x-vellira-build-id': 'build-2',
        },
      },
    }),
    false
  );
  assert.equal(
    isRecoveredDocumentFallback({
      ...documentFallbackFixture,
      documentResponse: {
        ...documentFallbackFixture.documentResponse,
        sequence: 4,
      },
    }),
    false
  );
  assert.equal(
    isRecoveredDocumentFallback({
      ...documentFallbackFixture,
      documentResponse: {
        ...documentFallbackFixture.documentResponse,
        headers: {
          ...documentFallbackFixture.documentResponse.headers,
          'set-cookie': 'migration=1',
        },
      },
    }),
    false
  );
});

test('soak navigation replay requires recovered edge, same route and same document', () => {
  const fixture = {
    baseUrl: 'https://vellira.test',
    startPath: '/components/radio',
    currentUrl: 'https://vellira.test/components/radio',
    expectedDocumentToken: 'doc-1',
    currentDocumentToken: 'doc-1',
    edgeRecovered: true,
  };

  assert.equal(isSafeClientNavigationReplay(fixture), true);
  assert.equal(
    isSafeClientNavigationReplay({ ...fixture, edgeRecovered: false }),
    false
  );
  assert.equal(
    isSafeClientNavigationReplay({
      ...fixture,
      currentUrl: 'https://vellira.test/components/checkbox',
    }),
    false
  );
  assert.equal(
    isSafeClientNavigationReplay({
      ...fixture,
      currentDocumentToken: 'doc-2',
    }),
    false
  );
});

// Execute the actual CLI function without launching its top-level browser journey.
// AST extraction keeps these tests bound to maintained callers, not copied logic.
async function smokeFunction(script, name, bindings) {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const ts = await import('typescript');
  const source = ts.createSourceFile(
    script,
    await readFile(new URL(script, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const declaration = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name
  );
  assert.ok(declaration, `Missing maintained function ${name}`);
  return runInNewContext(`(${declaration.getText(source)})`, {
    URL,
    console: { log() {} },
    ...bindings,
  });
}

test('website smoke cannot mark a browser edge handled after persistent probe timeouts', async () => {
  const { recoverCloudflareEdgeFailure } =
    await import('./cloudflare-edge-recovery.mjs');
  const failure = {
    url: 'https://example.test/blog?_rsc=1',
    status: 503,
    method: 'GET',
    headers: { server: 'cloudflare' },
    requestHeaders: { RSC: '1' },
    handled: false,
  };
  let calls = 0;
  const recover = await smokeFunction(
    './cloudflare-website-smoke.mjs',
    'recoverCloudflareEdgeFailures',
    {
      expectedBuildId: 'build-1',
      diagnostics: [],
      recoverCloudflareEdgeFailure: (record, options) =>
        recoverCloudflareEdgeFailure(record, {
          ...options,
          sleep: async () => {},
          requestGet: async () => {
            calls++;
            throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
          },
        }),
    }
  );
  assert.equal(await recover([failure], 'test'), false);
  assert.equal(failure.handled, false);
  assert.equal(failure.recovery.reason, 'transport-error');
  assert.equal(calls, 3);
});

for (const mutation of [false, true]) {
  test(`actor bootstrap document retry cannot repeat a dispatched mutation: ${mutation}`, async () => {
    const { EventEmitter } = await import('node:events');
    const page = new EventEmitter();
    const failures = [];
    let navigations = 0;
    let recoveryCalls = 0;
    page.goto = async () => {
      navigations++;
      failures.push({ url: 'https://example.test/article' });
      if (mutation)
        page.emit('request', {
          url: () => 'https://example.test/api/views',
          method: () => 'POST',
        });
    };
    const bootstrap = await smokeFunction(
      './cloudflare-website-smoke.mjs',
      'loadArticleWithActorMetrics',
      {
        baseUrl: 'https://example.test',
        criticalDiagnostics: [],
        edgeRecoveryMaxAttempts: 3,
        edgeRecoveryDelayMs: 0,
        cloudflareEdgeGetFailures: failures,
        sameOrigin: () => true,
        destinationEdgeFailures,
        edgeFailuresSince: (index) => failures.slice(index),
        sleep: async () => {},
        recoverCloudflareEdgeFailures: async () => {
          recoveryCalls++;
          return true;
        },
      }
    );
    const original = new Error('browser bootstrap failed');
    const observe = async (_requests, action) => {
      await action();
      if (navigations === 1) throw original;
      return [
        { status: 200, payload: { liked: false } },
        { status: 200, payload: { metrics: {} } },
      ];
    };
    if (mutation)
      await assert.rejects(
        bootstrap(page, observe, '/article', '/like', '/views'),
        (error) => error === original
      );
    else await bootstrap(page, observe, '/article', '/like', '/views');
    assert.equal(navigations, mutation ? 1 : 2);
    assert.equal(recoveryCalls, mutation ? 0 : 1);
    assert.equal(page.listenerCount('request'), 0);
  });
}

test('static aborted probes accept headerless CDN 200 but reject every HTTP failure without recovery', async () => {
  const { readCloudflareDiagnosticGet } =
    await import('./cloudflare-edge-recovery.mjs');
  for (const status of [200, 404, 503]) {
    let calls = 0;
    let disposed = 0;
    const verify = await smokeFunction(
      './cloudflare-static-chunk-smoke.mjs',
      'verifyAbortedChunkUrls',
      {
        abortedChunkUrls: new Set([
          'https://example.test/_next/static/chunk.js',
        ]),
        expectedBuildId: 'build-1',
        readCloudflareDiagnosticGet: (options, read) =>
          readCloudflareDiagnosticGet(
            {
              ...options,
              requestGet: async () => {
                calls++;
                return {
                  status: () => status,
                  headers: () => ({ server: 'cloudflare' }),
                  ok: () => status === 200,
                  dispose: async () => {
                    disposed++;
                  },
                };
              },
            },
            read
          ),
      }
    );
    if (status === 200) await verify('test');
    else
      await assert.rejects(verify('test'), /Aborted static chunk is missing/);
    assert.equal(calls, 1);
    assert.equal(disposed, 1);
  }
});

test('soak fails closed after proven edge recovery when document token evaluation stalls', async () => {
  const { boundedBrowserRead } =
    await import('./cloudflare-browser-diagnostics.mjs');
  let actions = 0;
  let retries = 0;
  const original = new Error('route readiness failed after edge 503');
  const run = await smokeFunction(
    './cloudflare-navigation-soak.mjs',
    'runRecoverableSoakNavigation',
    {
      baseUrl: 'https://example.test',
      documentToken: 'original-document',
      navigationRetryMaxAttempts: 3,
      navigationRetryDelayMs: 0,
      documentSequence: 1,
      page: {
        url: () => 'https://example.test/start',
        evaluate: () => new Promise(() => {}),
        waitForTimeout: async () => {
          retries++;
        },
      },
      diagnostics: {
        record() {},
        edgeFailureCursor: () => 0,
        recoveredDestinationEdgeFailureSince: () => true,
      },
      ready: async () => {
        throw original;
      },
      boundedBrowserRead: (read, label) => boundedBrowserRead(read, label, 10),
      isSafeClientNavigationReplay,
    }
  );
  await assert.rejects(
    run({
      href: '/target',
      title: 'Target',
      stage: 'fixture',
      action: async () => {
        actions++;
      },
    }),
    (error) => error === original
  );
  assert.equal(actions, 1);
  assert.equal(retries, 0);
});

test('document navigation never retries Worker failure because an unrelated edge request recovered', async () => {
  let navigations = 0;
  let probes = 0;
  const { isCloudflareEdgeGeneratedGet5xx } =
    await import('./cloudflare-edge-recovery.mjs');
  const goto = await smokeFunction('./cloudflare-website-smoke.mjs', 'goto', {
    baseUrl: 'https://example.test',
    edgeRecoveryMaxAttempts: 3,
    edgeRecoveryDelayMs: 0,
    cloudflareEdgeGetFailures: [],
    edgeFailuresSince: () => [{ url: 'https://example.test/unrelated?_rsc=1' }],
    destinationEdgeFailures,
    isCloudflareEdgeGeneratedGet5xx,
    recoverCloudflareEdgeFailures: async () => {
      probes++;
      return true;
    },
    sleep: async () => {},
    page: {
      goto: async () => {
        navigations++;
        return {
          status: () => 503,
          request: () => ({ method: () => 'GET' }),
          headers: () => ({
            server: 'cloudflare',
            'x-vellira-worker-version': 'worker',
          }),
        };
      },
    },
  });
  await assert.rejects(goto('/target'), /Document navigation failed/);
  assert.equal(navigations, 1);
  assert.equal(probes, 0);
});

test('static abort verification cannot turn an original mutation into a GET probe', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const ts = await import('typescript');
  const source = ts.createSourceFile(
    'static.mjs',
    await readFile(
      new URL('./cloudflare-static-chunk-smoke.mjs', import.meta.url),
      'utf8'
    ),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const listener = source.statements.find(
    (node) =>
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) &&
      node.expression.expression.getText(source) === 'page.on' &&
      node.expression.arguments[0]?.text === 'requestfailed'
  ).expression.arguments[1];
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const abortedChunkUrls = new Set();
    const critical = [];
    const handler = runInNewContext(`(${listener.getText(source)})`, {
      isNextRouterDataRequest: () => false,
      isNextStaticChunk: () => true,
      abortedChunkUrls,
      recordCritical: (value) => critical.push(value),
    });
    handler({
      method: () => method,
      url: () => 'https://example.test/_next/static/chunk.js',
      failure: () => ({ errorText: 'net::ERR_ABORTED' }),
    });
    assert.equal(abortedChunkUrls.size, method === 'GET' ? 1 : 0);
    assert.equal(critical.length, method === 'GET' ? 0 : 1);
  }
});
