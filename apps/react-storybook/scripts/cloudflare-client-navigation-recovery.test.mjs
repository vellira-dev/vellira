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

  assert.deepEqual(
    destinationEdgeFailures(failures, '/blog/two-runtimes'),
    [failures[0]]
  );
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
