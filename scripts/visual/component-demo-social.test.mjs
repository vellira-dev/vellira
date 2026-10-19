import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getSocialCrop, getSocialStages, getSocialXfadePlan, getSocialMarkup, requireImagePng } from './component-demo-social.mjs';

const demo = {
  title: 'Vellira Dropdown — keyboard navigation and Escape',
  viewport: { width: 960, height: 540 },
  gifFps: 12,
  phaseFrames: { ready: 9, opened: 17, highlighted: 17, closed: 13 },
};
const trigger = { x: 423, y: 81, width: 132, height: 44 };
const menu = { x: 420, y: 125, width: 224, height: 140 };

test('geometry crops a real, unclipped Dropdown; rejects invalid or oversized regions', () => {
  assert.deepEqual(getSocialCrop(trigger, menu, demo.viewport), { x: 376, y: 39, width: 312, height: 268 });
  assert.throws(() => getSocialCrop({ ...trigger, x: -8 }, menu, demo.viewport), /contained/);
  assert.throws(() => getSocialCrop(trigger, { ...menu, width: 900 }, demo.viewport), /contained/);
  assert.throws(() => getSocialCrop(trigger, { ...menu, x: 900 }, demo.viewport), /contained/);
  assert.throws(() => getSocialCrop(trigger, { ...menu, height: 440 }, demo.viewport), /contained/);
  assert.throws(() => getSocialCrop({ ...trigger, x: NaN }, menu, demo.viewport), /contained/);
  assert.throws(() => getSocialCrop(trigger, menu, { width: 0.5, height: 540 }), /invalid/);
});

test('phase selection reads only real proof frame indices and timing', () => {
  assert.deepEqual(getSocialStages(demo).map(x => [x.name, x.startFrame, x.frames]), [
    ['ready', 0, 9], ['opened', 9, 17], ['highlighted', 26, 17], ['closed', 43, 13],
  ]);
  const xfade = getSocialXfadePlan(demo);
  assert.equal(xfade.stages.length, 4);
  assert.ok(Math.abs(xfade.expectedDuration - 56 / 12) < 0.001);
  assert.deepEqual(xfade.offsets.map(x => Number(x.toFixed(3))), [0.75, 2.167, 3.583]);
  assert.throws(() => getSocialStages({ ...demo, phaseFrames: { ...demo.phaseFrames, opened: 0 } }), /incomplete/);
  assert.throws(() => getSocialXfadePlan({ ...demo, gifFps: 13 }), /rate/);
});

test('Button stages reuse social format with verified confirmation and loading phases', () => {
  const button = {
    ...demo,
    title: 'Vellira Button — confirmation and loading',
    subtitle: 'Confirmation and loading feedback',
    phaseFrames: { ready: 9, confirming: 17, loading: 17, closed: 13 },
    socialStages: [
      { name: 'ready', label: '01 / READY', key: 'ENTER', action: 'Request confirmation' },
      { name: 'confirming', label: '02 / CONFIRM', key: 'ENTER', action: 'Confirm the action' },
      { name: 'loading', label: '03 / LOADING', key: 'BUSY', action: 'Show loading feedback' },
      { name: 'closed', label: '04 / RESET', key: 'DONE', action: 'Return to ready' },
    ],
    posterPhase: 'confirming',
  };
  const stages = getSocialStages(button);
  assert.deepEqual(stages.map(x => [x.name, x.startFrame]), [
    ['ready', 0], ['confirming', 9], ['loading', 26], ['closed', 43],
  ]);
  assert.equal(getSocialXfadePlan(button).expectedDuration, 56 / 12);
  const markup = getSocialMarkup({
    demo: button,
    stage: stages[2],
    crop: getSocialCrop(trigger, menu, demo.viewport),
    imageBase64: Buffer.from('proof').toString('base64'),
    logoBase64: Buffer.from('<svg/>').toString('base64'),
  });
  assert.match(markup, /Confirmation and loading feedback/);
  assert.match(markup, /Show loading feedback/);
  assert.match(markup, /<div class="title">Button<\/div>/);
  assert.match(markup, /alt="Real Storybook Button"/);
  assert.throws(() => getSocialStages({ ...button, socialStages: [] }), /exactly four reviewed/);
  assert.throws(() => getSocialStages({
    ...button, socialStages: [{...stages[0], name: 'wrong'}, ...stages.slice(1)],
  }), /Unreviewed or incomplete/);
});

test('Modal social presentation has real focus and Escape labels, without fake UI', () => {
  const modal = {
    ...demo,
    title: 'Vellira Modal — focus and Escape dismissal',
    subtitle: 'Keyboard focus and Escape restoration',
    phaseFrames: { ready: 9, opened: 17, focused: 17, closed: 13 },
    socialStages: [
      { name: 'ready', label: '01 / READY', key: 'ENTER', action: 'Open the dialog' },
      { name: 'opened', label: '02 / OPEN', key: 'FOCUS', action: 'Focus starts inside' },
      { name: 'focused', label: '03 / NAVIGATE', key: 'TAB', action: 'Move focus inside' },
      { name: 'closed', label: '04 / RESTORE', key: 'ESC', action: 'Return focus to trigger' },
    ],
    posterPhase: 'opened',
  };
  assert.deepEqual(getSocialStages(modal).map(x => [x.name, x.startFrame]), [
    ['ready', 0], ['opened', 9], ['focused', 26], ['closed', 43],
  ]);
  assert.equal(getSocialXfadePlan(modal).expectedDuration, 56 / 12);
  const markup = getSocialMarkup({
    demo: modal,
    stage: getSocialStages(modal)[3],
    crop: getSocialCrop(trigger, menu, demo.viewport),
    imageBase64: Buffer.from('real-modal-proof').toString('base64'),
    logoBase64: Buffer.from('<svg/>').toString('base64'),
  });
  assert.match(markup, /Keyboard focus and Escape restoration/);
  assert.match(markup, /Return focus to trigger/);
  assert.match(markup, /<div class="title">Modal<\/div>/);
  assert.match(markup, /alt="Real Storybook Modal"/);
  assert.doesNotMatch(markup, /<button\b|<dialog\b/);
  assert.throws(
    () => getSocialStages({ ...modal, socialStages: modal.socialStages.slice(1) }),
    /exactly four reviewed/
  );
});

test('social HTML has approved branding, stage text and verified image only', () => {
  const stage = getSocialStages(demo)[2];
  const markup = getSocialMarkup({
    demo, stage, crop: getSocialCrop(trigger, menu, demo.viewport),
    imageBase64: Buffer.from('evidence').toString('base64'),
    logoBase64: Buffer.from('<svg/>').toString('base64'),
    fontRegular: 'AB==', fontBold: 'AB==',
  });
  assert.match(markup, /Keyboard navigation and Escape handling/);
  assert.match(markup, /ARROW DOWN/);
  assert.match(markup, /storybook\.vellira\.dev/);
  assert.match(markup, /width: 1200px; height: 1200px/);
  assert.match(markup, /data:image\/png;base64/);
  assert.doesNotMatch(markup, /<button\b|<select\b|<input\b/);
  assert.throws(() => getSocialMarkup({demo,stage:{...stage,key:'FAKE'},crop:getSocialCrop(trigger,menu,demo.viewport),imageBase64:'abcd'}), /Unknown social stage/);
});

test('only matching PNG screenshot dimensions are admitted', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'vellira-social-source-test-'));
  const file = path.join(dir, 'frame-0000.png');
  try {
    writeFileSync(file, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO1pLQAAAABJRU5ErkJggg==', 'base64'));
    assert.ok(requireImagePng(file, { width: 1, height: 1 }).length > 0);
    assert.throws(() => requireImagePng(file, { width: 960, height: 540 }), /dimensions/);
    writeFileSync(file, Buffer.from('invalid'));
    assert.throws(() => requireImagePng(file, { width: 1, height: 1 }), /only real proof/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
