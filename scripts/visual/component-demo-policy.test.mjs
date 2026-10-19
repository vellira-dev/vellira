import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { capturePhase } from './component-demo-frames.mjs';
import {
  getDemo,
  getFrameCount,
  getStoryUrl,
  STORYBOOK_ORIGIN,
  verifyDuration,
  verifyGifSize,
  verifyRevision,
} from './component-demo-policy.mjs';

const SHA = 'a'.repeat(40);
// Only the PNG signature matters for this contract; browser-backed coverage
// is provided by the dedicated exact-head capture job and its media artifacts.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO1pLQAAAABJRU5ErkJggg==', 'base64');

test('only the reviewed Dropdown story is admitted', () => {
  assert.equal(getDemo('dropdown-keyboard').storyId, 'components-dropdown--default');
  assert.equal(
    getStoryUrl('dropdown-keyboard'),
    `${STORYBOOK_ORIGIN}/iframe.html?id=components-dropdown--default&viewMode=story&globals=theme:light`
  );
  assert.equal(getDemo('dropdown-keyboard').viewport.width, 960);
});

test('Button capture is an explicitly reviewed real Storybook story', () => {
  const demo = getDemo('button-confirmation');
  assert.equal(demo.storyId, 'primitives-button--destructive-confirmation');
  assert.equal(
    getStoryUrl('button-confirmation'),
    `${STORYBOOK_ORIGIN}/iframe.html?id=primitives-button--destructive-confirmation&viewMode=story&globals=theme:light`
  );
  assert.deepEqual(Object.keys(demo.phaseFrames), [
    'ready', 'confirming', 'loading', 'closed',
  ]);
  assert.equal(getFrameCount(demo), 56);
  assert.equal(demo.posterPhase, 'confirming');
  verifyDuration(56 / 12, demo);
});

test('Modal capture admits the maintained focus-and-Escape Storybook scenario', () => {
  const modal = getDemo('modal-focus');
  assert.equal(modal.storyId, 'components-modal--default');
  assert.equal(
    getStoryUrl('modal-focus'),
    `${STORYBOOK_ORIGIN}/iframe.html?id=components-modal--default&viewMode=story&globals=theme:light`
  );
  assert.deepEqual(Object.keys(modal.phaseFrames), [
    'ready', 'opened', 'focused', 'closed',
  ]);
  assert.equal(modal.posterPhase, 'opened');
  assert.equal(getFrameCount(modal), 56);
  verifyDuration(56 / 12, modal);
});

test('Select choice uses the maintained SimpleUsage story and four verified phases', () => {
  const demo = getDemo('select-keyboard');
  assert.equal(demo.storyId, 'components-select--simple-usage');
  assert.equal(
    getStoryUrl('select-keyboard'),
    STORYBOOK_ORIGIN + '/iframe.html?id=components-select--simple-usage&viewMode=story&globals=theme:light'
  );
  assert.equal(demo.posterPhase, 'highlighted');
  assert.deepEqual(Object.keys(demo.phaseFrames), [
    'ready', 'opened', 'highlighted', 'selected',
  ]);
  assert.equal(getFrameCount(demo), 56);
  verifyDuration(56 / 12, demo);
});

test('Tabs capture admits real Controlled story and keyboard navigation stages', () => {
  const tabs = getDemo('tabs-keyboard');
  assert.equal(tabs.storyId, 'components-tabs--controlled');
  assert.equal(
    getStoryUrl('tabs-keyboard'),
    STORYBOOK_ORIGIN + '/iframe.html?id=components-tabs--controlled&viewMode=story&globals=theme:light'
  );
  assert.equal(tabs.posterPhase, 'settings');
  assert.deepEqual(Object.keys(tabs.phaseFrames), [
    'ready', 'profile', 'settings', 'restored',
  ]);
  assert.equal(getFrameCount(tabs), 56);
  verifyDuration(56 / 12, tabs);
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

test('verified frame plan has no preload frames and bounded clip duration', () => {
  const demo = getDemo('dropdown-keyboard');
  assert.deepEqual(Object.keys(demo.phaseFrames), ['ready', 'opened', 'highlighted', 'closed']);
  assert.equal(getFrameCount(demo), 56);
  verifyDuration(56 / 12, demo);
  assert.throws(() => verifyDuration(10, demo), /Unexpected encoded video duration/);
  assert.throws(() => verifyDuration(Number.NaN, demo), /Unexpected encoded video duration/);
  assert.throws(() => getFrameCount({ phaseFrames: { ready: 0, opened: 2, highlighted: 2, closed: 2 } }), /Invalid reviewed/);
});

test('frame writer only captures the admitted post-load states, with contiguous filenames', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'vellira-demo-frames-test-'));
  let calls = 0;
  const page = { screenshot: async (options) => {
    assert.deepEqual(options, { type: 'png', animations: 'disabled' });
    calls++;
    return PNG;
  } };
  try {
    const poster = path.join(directory, 'poster.png');
    const next = await capturePhase(page, directory, 0, 3, poster);
    assert.equal(next, 3);
    assert.equal(await capturePhase(page, directory, next, 2), 5);
    assert.equal(calls, 2);
    assert.deepEqual(readdirSync(directory).sort(), [
      'frame-0000.png', 'frame-0001.png', 'frame-0002.png', 'frame-0003.png', 'frame-0004.png', 'poster.png',
    ]);
    assert.deepEqual(readFileSync(poster), PNG);
    await assert.rejects(() => capturePhase(page, directory, -1, 2), /Invalid component demo frame phase/);
    await assert.rejects(() => capturePhase({ screenshot: async () => Buffer.from('invalid') }, directory, 5, 1), /PNG screenshot/);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
