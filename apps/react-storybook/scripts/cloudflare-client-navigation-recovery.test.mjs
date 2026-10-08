import assert from 'node:assert/strict';
import test from 'node:test';

import {
  destinationEdgeFailures,
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
