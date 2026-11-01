import assert from 'node:assert/strict';
import test from 'node:test';
import { ATOMIC_RELEASE_SYNC_PATHS, assertAtomicSyncFileSet } from './atomic-release-sync.mjs';

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
