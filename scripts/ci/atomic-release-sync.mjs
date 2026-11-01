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
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function assertStableReleaseVersion(version) {
  assert.match(version, VERSION, 'Expected stable release version');
}

export function assertAtomicSyncFileSet(paths) {
  assert.equal(new Set(paths).size, paths.length, 'Duplicate atomic-sync path');
  assert.deepEqual([...paths].sort(), ATOMIC_RELEASE_SYNC_PATHS,
    'Atomic release sync requires exactly seven package manifests and five Starter files');
}

export function validateAtomicReleaseSnapshot(root, version) {
  assertStableReleaseVersion(version);
  for (const file of RELEASE_SYNC_MANIFESTS) {
    const doc = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    assert.equal(doc.version, version, file + ' version diverges');
  }
  const expectedDirectPackages = {
    web: ['@vellira-ui/react', '@vellira-ui/tokens', '@vellira-ui/icons'],
    native: ['@vellira-ui/react-native', '@vellira-ui/icons'],
  };
  for (const file of ['web', 'native']) {
    const doc = JSON.parse(fs.readFileSync(path.join(root, 'examples/workspace-starter', file, 'package.json'), 'utf8'));
    assert.equal(doc.private, true, file + ' must remain private');
    for (const name of expectedDirectPackages[file]) {
      assert.equal(doc.dependencies?.[name], version, file + ' ' + name + ' missing or drifting');
    }
    for (const [name, value] of Object.entries(doc.dependencies ?? {})) {
      if (name.startsWith('@vellira-ui/')) assert.equal(value, version, file + ' ' + name + ' drift');
    }
  }
  const readme = fs.readFileSync(path.join(root, starterPaths[0]), 'utf8');
  assert.ok(readme.includes('**Vellira ' + version + ' packages**'), 'Starter README version drift');
  syncStarterLockfiles({ root, check: true });
  return true;
}
