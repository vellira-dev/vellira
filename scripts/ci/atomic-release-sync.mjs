import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RELEASE_SYNC_MANIFESTS } from './release-sync-contract.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { syncStarterLockfiles } = require('../sync-workspace-starter-lockfiles.cjs');
const starterPaths = Object.freeze([
  'examples/workspace-starter/README.md',
  'examples/workspace-starter/native/package-lock.json',
  'examples/workspace-starter/native/package.json',
  'examples/workspace-starter/web/package-lock.json',
  'examples/workspace-starter/web/package.json',
]);
export const ATOMIC_RELEASE_SYNC_PATHS = Object.freeze([...RELEASE_SYNC_MANIFESTS, ...starterPaths].sort());
const VERSION = /^\\d+\\.\\d+\\.\\d+$/;

export function assertAtomicSyncFileSet(paths) {
  assert.deepEqual([...new Set(paths)].sort(), ATOMIC_RELEASE_SYNC_PATHS,
    'Atomic release sync requires exactly seven package manifests and five Starter files');
}

export function validateAtomicReleaseSnapshot(root, version) {
  assert.match(version, VERSION, 'Expected stable release version');
  for (const file of RELEASE_SYNC_MANIFESTS) {
    const doc = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    assert.equal(doc.version, version, file + ' version diverges');
  }
  for (const file of ['web', 'native']) {
    const doc = JSON.parse(fs.readFileSync(path.join(root, 'examples/workspace-starter', file, 'package.json'), 'utf8'));
    for (const [name, value] of Object.entries(doc.dependencies ?? {})) {
      if (name.startsWith('@vellira-ui/')) assert.equal(value, version, file + ' ' + name + ' drift');
    }
  }
  const readme = fs.readFileSync(path.join(root, starterPaths[0]), 'utf8');
  assert.ok(readme.includes('**Vellira ' + version + ' packages**'), 'Starter README version drift');
  syncStarterLockfiles({ root, check: true });
  return true;
}
