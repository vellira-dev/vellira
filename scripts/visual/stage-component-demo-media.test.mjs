import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promote } from './stage-component-demo-media.mjs';

const IDS = [
  'dropdown-keyboard', 'button-confirmation', 'modal-focus',
  'select-keyboard', 'tabs-keyboard',
];
const sha256 = x => createHash('sha256').update(x).digest('hex');
function png() {
  const b = Buffer.alloc(32);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(b);
  b.writeUInt32BE(1200, 16);
  b.writeUInt32BE(1200, 20);
  return b;
}
function gif() {
  const b = Buffer.alloc(24);
  b.write('GIF89a', 0, 'ascii');
  b.writeUInt16LE(1200, 6);
  b.writeUInt16LE(1200, 8);
  return b;
}
function mp4() {
  const b = Buffer.alloc(24);
  b.write('ftyp', 4, 'ascii');
  return b;
}
function fixture(root) {
  const source = path.join(root, 'proof');
  for (const id of IDS) {
    const dir = path.join(source, id);
    mkdirSync(path.join(dir, 'social'), { recursive: true });
    const raw = {}, social = {};
    for (const [ext, make] of [['mp4', mp4], ['gif', gif], ['png', png]]) {
      const name = id + '.' + ext, value = make();
      writeFileSync(path.join(dir, name), value);
      raw[name] = { bytes: value.length, sha256: sha256(value) };
      const socialName = id + '-social.' + ext;
      writeFileSync(path.join(dir, 'social', socialName), value);
      social['social/' + socialName] = { bytes: value.length, sha256: sha256(value) };
    }
    writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
      schemaVersion: 1,
      demo: id,
      storyId: 'canonical-story',
      title: id,
      commitSha: '260850f9e5f2fb51e9095b739e63952ce6a7e1cc',
      githubRunId: '39277740730',
      publishing: 'manual-review-required',
      frameSource: 'real-storybook-states-after-readiness',
      frames: 56,
      fps: 12,
      files: raw,
      social: {
        schemaVersion: 1, profile: 'square-1200-v1',
        width: 1200, height: 1200, files: social,
      },
    }));
  }
  return source;
}
function withFixture(fn) {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'vellira-media-stage-'));
  try { fn(temp, fixture(temp)); }
  finally { rmSync(temp, { recursive: true, force: true }); }
}
test('stages exactly fifteen immutable media files with review evidence', () => withFixture((temp, source) => {
  const dest = path.join(temp, 'public');
  const result = promote(source, dest);
  assert.equal(result.demos.length, 5);
  assert.equal(result.source.githubRunId, '39277740730');
  const catalog = JSON.parse(readFileSync(path.join(dest, 'catalog.json'), 'utf8'));
  assert.equal(catalog.demos[4].files.mp4.url,
    '/media/component-demos/v1/tabs-keyboard/tabs-keyboard-social.mp4');
  assert.ok(existsSync(path.join(dest, 'modal-focus', 'modal-focus-social.gif')));
  assert.throws(() => promote(source, dest), /Refusing overwrite/);
}));
test('rejects tampered proof without partial output', () => withFixture((temp, source) => {
  const file = path.join(source, 'select-keyboard', 'social', 'select-keyboard-social.mp4');
  writeFileSync(file, Buffer.from('tampered'));
  const dest = path.join(temp, 'public');
  assert.throws(() => promote(source, dest), /Byte mismatch/);
  assert.equal(existsSync(dest), false);
}));
test('rejects malformed identity or unexpected source files', () => withFixture((temp, source) => {
  const file = path.join(source, 'tabs-keyboard', 'manifest.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  manifest.commitSha = '0'.repeat(40);
  writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => promote(source, path.join(temp, 'out')), /Expected values to be strictly equal/);
  manifest.commitSha = '260850f9e5f2fb51e9095b739e63952ce6a7e1cc';
  writeFileSync(file, JSON.stringify(manifest));
  writeFileSync(path.join(source, 'unreviewed.txt'), 'surprise');
  assert.throws(() => promote(source, path.join(temp, 'out')), /Unexpected proof inputs/);
}));
