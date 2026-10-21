import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SHA = '260850f9e5f2fb51e9095b739e63952ce6a7e1cc';
const RUN = '39277740730';
const IDS = ['dropdown-keyboard', 'button-confirmation', 'modal-focus', 'select-keyboard', 'tabs-keyboard'];
const EXTS = ['mp4', 'gif', 'png'];

function exactFile(file) {
  const stat = lstatSync(file);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0, 'Unsafe file: ' + file);
  return readFileSync(file);
}

function verify(file, claim, label, social) {
  const data = exactFile(file);
  assert.equal(data.length, claim?.bytes, 'Byte mismatch: ' + label);
  assert.match(claim?.sha256, /^[0-9a-f]{64}$/, 'Missing SHA-256: ' + label);
  assert.equal(createHash('sha256').update(data).digest('hex'), claim.sha256,
    'Hash mismatch: ' + label);
  if (social && label.endsWith('.png')) {
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(data.readUInt32BE(16), 1200);
    assert.equal(data.readUInt32BE(20), 1200);
  }
  if (social && label.endsWith('.gif')) {
    assert.equal(data.subarray(0, 6).toString('ascii'), 'GIF89a');
    assert.equal(data.readUInt16LE(6), 1200);
    assert.equal(data.readUInt16LE(8), 1200);
    assert.ok(data.length <= 8 * 1024 * 1024, 'GIF size over budget');
  }
  if (social && label.endsWith('.mp4')) {
    assert.equal(data.subarray(4, 8).toString('ascii'), 'ftyp');
  }
}

function list(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    assert.ok(entry.isDirectory() || entry.isFile(), 'Unapproved source entry');
    const rel = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? list(path.join(dir, entry.name), rel) : [rel];
  });
}

export function promote(root, publicDir) {
  assert.ok(path.isAbsolute(root) && path.isAbsolute(publicDir), 'Absolute paths required');
  assert.ok(!existsSync(publicDir), 'Refusing overwrite of immutable v1 assets');
  const expected = [], planned = [], demos = [];
  for (const id of IDS) {
    const dir = path.join(root, id);
    expected.push(id + '/manifest.json');
    const manifest = JSON.parse(exactFile(path.join(dir, 'manifest.json')).toString('utf8'));
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.demo, id);
    assert.equal(manifest.commitSha, SHA);
    assert.equal(String(manifest.githubRunId), RUN);
    assert.equal(manifest.publishing, 'manual-review-required');
    assert.equal(manifest.frameSource, 'real-storybook-states-after-readiness');
    assert.equal(manifest.frames, 56);
    assert.equal(manifest.fps, 12);
    assert.equal(manifest.social?.schemaVersion, 1);
    assert.equal(manifest.social?.profile, 'square-1200-v1');
    assert.equal(manifest.social?.width, 1200);
    assert.equal(manifest.social?.height, 1200);
    assert.deepEqual(Object.keys(manifest.files).sort(), EXTS.map(ext => id + '.' + ext).sort());
    assert.deepEqual(Object.keys(manifest.social.files).sort(), EXTS.map(ext => 'social/' + id + '-social.' + ext).sort());
    const files = {};
    for (const ext of EXTS) {
      const rawName = id + '.' + ext;
      const socialName = id + '-social.' + ext;
      expected.push(id + '/' + rawName, id + '/social/' + socialName);
      verify(path.join(dir, rawName), manifest.files[rawName], rawName, false);
      const src = path.join(dir, 'social', socialName);
      const proof = manifest.social.files['social/' + socialName];
      verify(src, proof, socialName, true);
      files[ext] = {
        url: '/media/component-demos/v1/' + id + '/' + socialName,
        bytes: proof.bytes,
        sha256: proof.sha256,
      };
      planned.push([src, path.join(publicDir, id, socialName)]);
    }
    demos.push({ id, title: manifest.title, storyId: manifest.storyId, files });
  }
  assert.deepEqual(list(root).sort(), expected.sort(), 'Unexpected proof inputs');
  for (const [src, dest] of planned) {
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
  const catalog = {
    schemaVersion: 1,
    source: {
      repository: 'vellira-dev/vellira', commitSha: SHA,
      githubRunId: RUN, artifactId: '12199925799',
      publishing: 'manual-review-required',
    },
    profile: 'square-1200-v1',
    demos,
  };
  writeFileSync(path.join(publicDir, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  return catalog;
}

if (process.argv[1] && process.argv[1].endsWith('/stage-component-demo-media.mjs')) {
  if (process.argv.length !== 4) throw new Error('Expected absolute proof and public directories');
  const result = promote(path.resolve(process.argv[2]), path.resolve(process.argv[3]));
  console.log('Verified and staged ' + result.demos.length + ' permanent demo asset sets.');
}
