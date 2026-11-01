import assert from 'node:assert/strict';
import test from 'node:test';
import { ATOMIC_RELEASE_SYNC_PATHS } from './atomic-release-sync.mjs';
import { loadAtomicSnapshot, verifyAtomicCandidate } from './verify-atomic-release-sync.mjs';

const a = 'a'.repeat(40);
const b = 'b'.repeat(40);

test('immutable SHA snapshot reads exactly the audited atomic file set', () => {
  const seen = [];
  const snapshot = loadAtomicSnapshot(a, {
    readFile: (sha, filename) => {
      seen.push([sha, filename]);
      return filename.endsWith('.json') ? '{}' : 'readme content';
    },
  });
  assert.deepEqual(Object.keys(snapshot), ATOMIC_RELEASE_SYNC_PATHS);
  assert.equal(seen.length, 12);
  assert.ok(seen.every(([sha]) => sha === a));
});

test('invalid SHA and unchanged SHA fail before inspecting any content', () => {
  const readFile = () => { throw Error('must not read'); };
  assert.throws(() => loadAtomicSnapshot('main', { readFile }), /immutable SHA/);
  assert.throws(() => verifyAtomicCandidate({
    baseSha: a, headSha: a, files: ATOMIC_RELEASE_SYNC_PATHS,
    version: '2.189.0', readFile,
  }), /must change/);
});

test('partial atomic changes reject even if snapshots contain all files', () => {
  const readFile = (_sha, filename) => filename.endsWith('.json')
    ? JSON.stringify({ version: '2.189.0' }) : 'README';
  assert.throws(() => verifyAtomicCandidate({
    baseSha: a, headSha: b, files: ATOMIC_RELEASE_SYNC_PATHS.slice(1),
    version: '2.189.0', readFile,
  }), /exactly seven package manifests and five Starter files/);
});
