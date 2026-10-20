import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DEMO_ASSET_NAMES, stageVerifiedComponentMedia } from './stage-component-demo-assets.mjs';

const sha = '260850f9e5f2fb51e9095b739e63952ce6a7e1cc';
const run = '39277740730';
const hash = buffer => createHash('sha256').update(buffer).digest('hex');

function fixture(root) {
  for (const name of DEMO_ASSET_NAMES) {
    const dir = path.join(root, name, 'social');
    mkdirSync(dir, { recursive: true });
    const files = {};
    for (const ext of ['mp4', 'gif', 'png']) {
      const relative = 'social/' + name + '-social.' + ext;
      const data = Buffer.from(name + '/' + ext + '/reviewed');
      writeFileSync(path.join(root, name, relative), data);
      files[relative] = { bytes: data.length, sha256: hash(data) };
    }
    const manifest = {
      schemaVersion: 1, demo: name, commitSha: sha, githubRunId: run,
      publishing: 'manual-review-required',
      storyId: 'components-' + name + '--reviewed',
      social: {
        profile: 'square-1200-v1', width: 1200, height: 1200,
        phaseOrder: ['a', 'b', 'c', 'd'], files,
      },
    };
    writeFileSync(path.join(root, name, 'manifest.json'), JSON.stringify(manifest));
  }
}

test('only five immutable reviewed demos are staged, without raw proof', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'vellira-social-stage-'));
  try {
    const from = path.join(root, 'from'), to = path.join(root, 'to');
    fixture(from);
    const result = stageVerifiedComponentMedia(from, to, sha, run);
    assert.equal(result.count, 15);
    assert.equal(Object.keys(result.index.demos).length, 5);
    assert.equal(JSON.parse(readFileSync(path.join(to, 'index.json'))).sourceCommitSha, sha);
    assert.ok(existsSync(path.join(to, 'tabs-keyboard-social.mp4')));
    assert.equal(existsSync(path.join(to, 'tabs-keyboard.mp4')), false);
    assert.throws(() => stageVerifiedComponentMedia(from, to, 'b'.repeat(40), run), /authority/);
    assert.throws(() => stageVerifiedComponentMedia(from, to, sha, '11'), /authority/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('bad digest or wrong source SHA must fail closed', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'vellira-social-tamper-'));
  try {
    const from = path.join(root, 'from'), to = path.join(root, 'to');
    fixture(from);
    writeFileSync(path.join(from, 'select-keyboard', 'social', 'select-keyboard-social.png'), 'tampered');
    assert.throws(() => stageVerifiedComponentMedia(from, to, sha, run), /SHA-256 mismatch/);

    fixture(from);
    const file = path.join(from, 'tabs-keyboard', 'manifest.json');
    const manifest = JSON.parse(readFileSync(file));
    manifest.commitSha = 'b'.repeat(40);
    writeFileSync(file, JSON.stringify(manifest));
    assert.throws(() => stageVerifiedComponentMedia(from, to, sha, run), /mismatched media manifest/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
