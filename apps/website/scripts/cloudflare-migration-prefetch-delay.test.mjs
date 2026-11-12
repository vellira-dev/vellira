import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertMigrationPrefetchDelay,
  isMigrationPrefetch,
  observeHeldPrefetch,
  assertRapidUnloadResult,
} from './cloudflare-migration-prefetch-delay.mjs';

const url = new URL('http://127.0.0.1:1234/target/prefetched?_rsc=abc');
function req(headers = { RSC: '1', 'Next-Router-Prefetch': '1' }, method = 'GET') {
  return new Request(url, { method, headers });
}

test('matches only genuine Next RSC route prefetches, never normal navigations', () => {
  assert.equal(isMigrationPrefetch(req(), url), true);
  for (const request of [
    req({ RSC: '1' }),
    req({ 'Next-Router-Prefetch': '1' }),
    req({}, 'GET'),
    req({ RSC: '1', 'Next-Router-Prefetch': '1' }, 'HEAD'),
  ])
    assert.equal(isMigrationPrefetch(request, url), false);
  assert.equal(
    isMigrationPrefetch(req(), new URL(url.origin + '/target/fresh')),
    false
  );
});

test('rejects unbounded and fractional delays', () => {
  for (const delay of [-1, 5_001, 2.5, Infinity, NaN, '100']) {
    assert.throws(() => assertMigrationPrefetchDelay(delay));
  }
  assert.equal(assertMigrationPrefetchDelay(0), 0);
  assert.equal(assertMigrationPrefetchDelay(5_000), 5_000);
});

test('normal production-origin behavior is unchanged with no diagnostic delay', async () => {
  const observations = [];
  let waits = 0;
  const accepted = await observeHeldPrefetch({
    request: req(),
    url,
    generation: 'A',
    delayMs: 0,
    outgoing: { destroyed: false },
    observations,
    wait: () => {
      waits++;
    },
  });
  assert.equal(accepted, true);
  assert.equal(waits, 0);
  assert.deepEqual(observations, []);
});

test('bounded diagnostic records observed prefetch and allows completed response', async () => {
  const observations = [];
  const waits = [];
  const result = await observeHeldPrefetch({
    request: req(),
    url,
    generation: 'A',
    delayMs: 700,
    outgoing: { destroyed: false },
    observations,
    wait: (ms) => {
      waits.push(ms);
    },
  });
  assert.equal(result, true);
  assert.deepEqual(waits, [700]);
  assert.equal(observations.length, 1);
  assert.deepEqual(
    {
      pathname: observations[0].pathname,
      rsc: observations[0].rsc,
      prefetch: observations[0].prefetch,
      requestedDelayMs: observations[0].requestedDelayMs,
      closedBeforeResponse: observations[0].closedBeforeResponse,
    },
    {
      pathname: '/target/prefetched',
      rsc: '1',
      prefetch: '1',
      requestedDelayMs: 700,
      closedBeforeResponse: false,
    }
  );
});

test('closed native request remains evidence and is not treated as successful HTTP response', async () => {
  const observations = [];
  const outgoing = { destroyed: false };
  const result = await observeHeldPrefetch({
    request: req(),
    url,
    generation: 'A',
    delayMs: 1000,
    outgoing,
    observations,
    wait: () => {
      outgoing.destroyed = true;
    },
  });
  assert.equal(result, false);
  assert.equal(observations[0].closedBeforeResponse, true);
});

test('other requests are never held, even during a diagnostic', async () => {
  const observations = [];
  let waited = false;
  const accepted = await observeHeldPrefetch({
    request: req(),
    url: new URL(url.origin + '/target/fresh'),
    generation: 'B',
    delayMs: 1000,
    outgoing: { destroyed: false },
    observations,
    wait: () => {
      waited = true;
    },
  });
  assert.equal(accepted, true);
  assert.equal(waited, false);
  assert.deepEqual(observations, []);
});

test('all page, console and script errors remain blocking in the rapid-unload test', () => {
  const good = {
    destination: 'Target fresh B',
    heldAtNavigation: true,
    events: [{ kind: 'requestfailed', error: 'Load request cancelled' }],
  };
  assert.doesNotThrow(() => assertRapidUnloadResult(good));
  for (const kind of [
    'pageerror',
    'console-error',
    'window-error',
    'unhandledrejection',
  ]) {
    assert.throws(() =>
      assertRapidUnloadResult({
        ...good,
        events: [...good.events, { kind, error: 'Fetch API cannot load' }],
      })
    );
  }
  assert.throws(() => assertRapidUnloadResult({ ...good, heldAtNavigation: false }));
  assert.throws(() => assertRapidUnloadResult({ ...good, destination: 'Target fresh A' }));
});
