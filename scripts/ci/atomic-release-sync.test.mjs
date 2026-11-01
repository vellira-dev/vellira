import assert from 'node:assert/strict';
import test from 'node:test';
import { ATOMIC_RELEASE_SYNC_PATHS, assertAtomicSyncFileSet, assertStableReleaseVersion } from './atomic-release-sync.mjs';

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
