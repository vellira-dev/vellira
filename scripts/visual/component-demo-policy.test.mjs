import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDemo,
  getStoryUrl,
  STORYBOOK_ORIGIN,
  verifyGifSize,
  verifyRevision,
} from './component-demo-policy.mjs';

const SHA = 'a'.repeat(40);

test('only the reviewed Dropdown story is admitted', () => {
  assert.equal(getDemo('dropdown-keyboard').storyId, 'components-dropdown--default');
  assert.equal(
    getStoryUrl('dropdown-keyboard'),
    `${STORYBOOK_ORIGIN}/iframe.html?id=components-dropdown--default&viewMode=story&globals=theme:light`
  );
  assert.equal(getDemo('dropdown-keyboard').viewport.width, 960);
});

test('rejects unknown demos and user-controlled URLs or paths', () => {
  for (const value of ['', '../secret', 'https://example.com', 'dropdown', 'constructor', '__proto__']) {
    assert.throws(() => getDemo(value), /Unknown component demo/);
  }
});

test('requires an exact commit identity and rejects dispatched SHA drift', () => {
  verifyRevision(SHA, SHA);
  verifyRevision(SHA, undefined);
  assert.throws(() => verifyRevision('main', undefined), /exact Git commit SHA/);
  assert.throws(() => verifyRevision(SHA, 'b'.repeat(40)), /does not match/);
});

test('rejects empty, oversized, and invalid GIF output', () => {
  const limit = getDemo('dropdown-keyboard').maxGifBytes;
  verifyGifSize(limit, limit);
  assert.throws(() => verifyGifSize(limit + 1, limit), /no larger/);
  assert.throws(() => verifyGifSize(0, limit), /nonempty/);
  assert.throws(() => verifyGifSize(Number.NaN, limit), /nonempty/);
});
