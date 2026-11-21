import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCssHoldDelay,
  isMigrationCssRequest,
  observeHeldCss,
  cssPendingAtHardNavigation,
} from './cloudflare-migration-css-hold.mjs';

const css = new URL('http://127.0.0.1:80/_next/static/css/0948936741fa9839.css');
const request = (url = css, method = 'GET', headers = {}) =>
  new Request(url, { method, headers });

test('only genuine generation-B static CSS requests can be held', () => {
  assert.equal(isMigrationCssRequest(request(), css, 'B'), true);
  assert.equal(isMigrationCssRequest(request(), css, 'A'), false);
  assert.equal(isMigrationCssRequest(request(), css, 'C'), false);
  assert.equal(isMigrationCssRequest(request(css, 'HEAD'), css, 'B'), false);
  assert.equal(isMigrationCssRequest(request(css, 'GET', { RSC: '1' }), css, 'B'), false);
  for (const path of [
    '/target/fresh',
    '/_next/static/css/another.js',
    '/_next/static/chunks/abc.js',
    '/_next/static/css/nested/abc.css',
    '/favicon.ico',
  ]) {
    assert.equal(
      isMigrationCssRequest(request(new URL(path, css)), new URL(path, css), 'B'),
      false
    );
  }
});

test('only finite bounded integral delays are accepted', () => {
  for (const delay of [-1, 5001, 0.1, NaN, Infinity, '200']) {
    assert.throws(() => assertCssHoldDelay(delay));
  }
  assert.equal(assertCssHoldDelay(0), 0);
  assert.equal(assertCssHoldDelay(5000), 5000);
});

test('disabled mode does not delay or alter requests', async () => {
  let called = false;
  const observations = [];
  assert.equal(await observeHeldCss({
    request: request(), url: css, generation: 'B', delayMs: 0,
    outgoing: {}, observations, wait: () => { called = true; },
  }), true);
  assert.equal(called, false);
  assert.deepEqual(observations, []);
});

test('held CSS has real start/settled timestamps', async () => {
  let time = 100;
  const observations = [];
  assert.equal(await observeHeldCss({
    request: request(), url: css, generation: 'B', delayMs: 4000,
    outgoing: { destroyed: false }, observations,
    clock: () => time,
    wait: (ms) => { assert.equal(ms, 4000); time = 4100; },
  }), true);
  assert.deepEqual(observations, [{
    generation: 'B', pathname: css.pathname, at: 100,
    settledAt: 4100, delayMs: 4000, closedBeforeResponse: false,
  }]);
  assert.equal(cssPendingAtHardNavigation(observations, 99), false);
  assert.equal(cssPendingAtHardNavigation(observations, 101), true);
  assert.equal(cssPendingAtHardNavigation(observations, 4099), true);
  assert.equal(cssPendingAtHardNavigation(observations, 4100), false);
});

test('CSS cancellation remains recorded and never represented as successful response', async () => {
  const observations = [];
  const outgoing = { destroyed: false };
  assert.equal(await observeHeldCss({
    request: request(), url: css, generation: 'B', delayMs: 4000,
    outgoing, observations, wait: () => { outgoing.destroyed = true; },
  }), false);
  assert.equal(observations[0].closedBeforeResponse, true);
});

test('no CSS overlap gives inconclusive evidence', () => {
  assert.equal(cssPendingAtHardNavigation([], 110), false);
  assert.equal(cssPendingAtHardNavigation([{ generation: 'B', at: 99, settledAt: 105 }], 110), false);
  assert.equal(cssPendingAtHardNavigation([{ generation: 'A', at: 99, settledAt: 200 }], 110), false);
  assert.equal(cssPendingAtHardNavigation([{ generation: 'B', at: 99, settledAt: null }], null), false);
});
