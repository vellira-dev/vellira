import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyTeardownPrefetchTrace,
  assertTeardownFallbackResult,
  hasBlockingBrowserError,
} from './cloudflare-migration-teardown-trace.mjs';

const home = 'http://127.0.0.1:46573/target/prefetched';
const fresh = 'http://127.0.0.1:46573/target/fresh';
const rsc = (route) =>
  `http://127.0.0.1:46573${route}?_rsc=EhaCa9lrLxaM_bV6`;
const navigationStartedAt = 1000;
const request = (route, at) => ({
  kind: 'request',
  at,
  pageUrl: home,
  url: rsc(route),
  rsc: '1',
  prefetch: '1',
});
const hardNav = {
  kind: 'request',
  at: 1020,
  pageUrl: home,
  url: fresh,
  document: true,
};
const originRequest = (route, at) => ({
  at,
  generation: 'B',
  rsc: true,
  requestHeaders: { 'next-router-prefetch': '1' },
  url: `${route}?_rsc=EhaCa9lrLxaM_bV6`,
});
function trace(events, originRequests = []) {
  return classifyTeardownPrefetchTrace({
    events,
    originRequests,
    oldDocument: home,
    navigationStartedAt,
  });
}
function result(events, originRequests) {
  return {
    events,
    destination: 'Target fresh B',
    oldDocument: home,
    bFlightFromGenerationB: true,
    teardown: trace(events, originRequests),
  };
}

test('real old-document requests accepted then canceled are benign', () => {
  const events = [
    request('/target/prefetched', 1015),
    request('/target/expired', 1016),
    { kind: 'requestfailed', url: rsc('/target/prefetched'), at: 1019 },
    { kind: 'requestfailed', url: rsc('/target/expired'), at: 1019 },
    hardNav,
  ];
  const t = trace(events, [originRequest('/target/prefetched', 1017)]);
  assert.equal(t.bothObserved, true);
  assert.equal(t.paths['/target/prefetched'].status, 'dispatched');
  assert.equal(t.paths['/target/prefetched'].acceptedByOrigin, 1);
  assert.equal(t.paths['/target/expired'].status, 'dispatched');
  assert.equal(trace(events, [originRequest('/target/expired', 1050)]).paths['/target/expired'].acceptedByOrigin, 0);
  assert.doesNotThrow(() => assertTeardownFallbackResult(result(events)));
});

test('real WebKit pageerrors without request events are classified and BLOCK', () => {
  const events = [
    hardNav,
    ...['/target/prefetched', '/target/expired'].map((route) => ({
      kind: 'pageerror',
      at: 1020,
      pageUrl: home,
      error: `Fetch API cannot load http: /127.0.0.1:46573${route}?_rsc=EhaCa9lrLxaM_bV6 due to access control checks.`,
    })),
  ];
  const t = trace(events);
  assert.equal(t.bothObserved, true);
  for (const route of ['/target/prefetched', '/target/expired']) {
    assert.equal(t.paths[route].status, 'pageerror-before-or-during-network');
    assert.equal(t.paths[route].requests, 0);
    assert.equal(t.paths[route].acceptedByOrigin, 0);
  }
  assert.equal(hasBlockingBrowserError(events), true);
  assert.throws(() => assertTeardownFallbackResult(result(events)));
});

test('one route absent must be inconclusive, not PASS', () => {
  const events = [request('/target/prefetched', 1015), hardNav];
  assert.equal(trace(events).bothObserved, false);
  assert.throws(() => assertTeardownFallbackResult(result(events)));
});

test('old requests before click cannot satisfy the fallback window', () => {
  const events = [
    request('/target/prefetched', 900),
    request('/target/expired', 900),
    hardNav,
  ];
  assert.equal(trace(events).bothObserved, false);
});

test('B document prefetches cannot masquerade as old-document dispatch', () => {
  const events = [
    { ...request('/target/prefetched', 1023), pageUrl: fresh },
    { ...request('/target/expired', 1023), pageUrl: fresh },
    hardNav,
  ];
  assert.equal(trace(events).bothObserved, false);
});

test('non-RSC, non-prefetch requests and requestfailed alone are not positive evidence', () => {
  const events = [
    { ...request('/target/prefetched', 1015), rsc: undefined },
    { ...request('/target/expired', 1015), prefetch: undefined },
    { kind: 'requestfailed', at: 1016, pageUrl: home, url: rsc('/target/expired') },
    hardNav,
  ];
  assert.equal(trace(events).bothObserved, false);
});

test('a client SPA transition is not a full navigation proof', () => {
  const events = [
    request('/target/prefetched', 1015),
    request('/target/expired', 1016),
  ];
  const t = trace(events);
  assert.equal(t.hardNavigationAt, null);
  assert.equal(t.bothObserved, false);
});

test('all page/window/console errors always block', () => {
  const base = [
    request('/target/prefetched', 1015),
    request('/target/expired', 1016),
    hardNav,
  ];
  for (const kind of [
    'pageerror',
    'console-error',
    'window-error',
    'unhandledrejection',
  ]) {
    const events = [...base, { kind, at: 1020, error: 'sentinel' }];
    assert.equal(hasBlockingBrowserError(events), true);
    assert.throws(() => assertTeardownFallbackResult(result(events)));
  }
  assert.equal(hasBlockingBrowserError(base), false);
});

test('destination/build evidence is mandatory independently of request dispatch', () => {
  const base = result([
    request('/target/prefetched', 1015),
    request('/target/expired', 1016),
    hardNav,
  ]);
  assert.throws(() => assertTeardownFallbackResult({ ...base, destination: 'Target fresh A' }));
  assert.throws(() => assertTeardownFallbackResult({ ...base, bFlightFromGenerationB: false }));
  assert.throws(() => assertTeardownFallbackResult({ ...base, oldDocument: fresh }));
});
