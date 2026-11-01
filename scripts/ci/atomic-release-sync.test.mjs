import assert from 'node:assert/strict';
import test from 'node:test';
import { ATOMIC_RELEASE_SYNC_PATHS, assertAtomicSyncFileSet, assertStableReleaseVersion, verifyAtomicManifestTransition } from './atomic-release-sync.mjs';

test('atomic file set includes seven package manifests and five Starter assets', () => {
  assert.equal(ATOMIC_RELEASE_SYNC_PATHS.length, 12);
  assertAtomicSyncFileSet(ATOMIC_RELEASE_SYNC_PATHS);
});
test('rejects partial root-only release sync', () => {
  assert.throws(() => assertAtomicSyncFileSet(ATOMIC_RELEASE_SYNC_PATHS.filter(x => !x.includes('workspace-starter'))));
});
test('rejects unexpected file or duplicate', () => {
  assert.throws(() => assertAtomicSyncFileSet([...ATOMIC_RELEASE_SYNC_PATHS, 'apps/website/src/app/page.tsx']));
  assert.throws(() => assertAtomicSyncFileSet([...ATOMIC_RELEASE_SYNC_PATHS, ATOMIC_RELEASE_SYNC_PATHS[0]]));
});

test('requires canonical stable semantic versions before atomic assembly', () => {
  for (const version of ['2.189.0', '0.0.1', '10.0.123']) {
    assert.doesNotThrow(() => assertStableReleaseVersion(version));
  }
  for (const version of ['v2.189.0', '2.189.0-beta.1', '02.1.0', '2.189', '2.189.0 ']) {
    assert.throws(() => assertStableReleaseVersion(version));
  }
});

test('version transition accepts only seven converged version-only changes', () => {
  const manifests = ATOMIC_RELEASE_SYNC_PATHS.filter(p => p === 'package.json' || /^packages\\/[^/]+\\/package\\.json$/.test(p));
  const before = Object.fromEntries(manifests.map(p => [p, { name: p, version: '2.188.12', private: true }]));
  const after = Object.fromEntries(manifests.map(p => [p, { name: p, version: '2.189.0', private: true }]));
  const payload = { files: ATOMIC_RELEASE_SYNC_PATHS, before, after, version: '2.189.0' };
  assert.equal(verifyAtomicManifestTransition(payload).previousVersion, '2.188.12');
  assert.throws(() => verifyAtomicManifestTransition({
    ...payload, after: { ...after, 'package.json': { ...after['package.json'], scripts: { malicious: 'true' } } },
  }), /Unexpected manifest mutation/);
  assert.throws(() => verifyAtomicManifestTransition({
    ...payload, before: { ...before, 'package.json': { ...before['package.json'], version: '2.188.11' } },
  }), /not converged/);
});
