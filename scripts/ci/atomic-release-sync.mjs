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


export function verifyAtomicManifestTransition({ files, before, after, version }) {
  assertAtomicSyncFileSet(files);
  assertStableReleaseVersion(version);
  assert.ok(before && after, 'Missing atomic manifest snapshots');
  const oldVersions = new Set();
  for (const file of RELEASE_SYNC_MANIFESTS) {
    const previous = before[file];
    const next = after[file];
    assert.ok(previous && next, 'Missing version-only manifest: ' + file);
    oldVersions.add(previous.version);
    assert.equal(next.version, version, 'Wrong release manifest version: ' + file);
    const previousRest = { ...previous };
    const nextRest = { ...next };
    delete previousRest.version;
    delete nextRest.version;
    assert.deepEqual(nextRest, previousRest, 'Unexpected manifest mutation: ' + file);
  }
  assert.equal(oldVersions.size, 1, 'Root and package versions were not converged before update');
  return { previousVersion: [...oldVersions][0], version };
}

export function verifyAtomicStarterTransition({ before, after, previousVersion, version }) {
  assertStableReleaseVersion(previousVersion);
  assertStableReleaseVersion(version);
  assert.ok(before && after, 'Missing Starter snapshots');

  for (const platform of ['web', 'native']) {
    const filename = 'examples/workspace-starter/' + platform + '/package.json';
    const oldManifest = before[filename];
    const newManifest = after[filename];
    assert.ok(oldManifest && newManifest, 'Missing Starter manifest ' + filename);
    const required = platform === 'web'
      ? ['@vellira-ui/react', '@vellira-ui/tokens', '@vellira-ui/icons']
      : ['@vellira-ui/react-native', '@vellira-ui/icons'];
    const expected = structuredClone(oldManifest);
    for (const name of required) {
      assert.equal(expected.dependencies?.[name], previousVersion, 'Unconverged prior Starter pin ' + name);
      expected.dependencies[name] = version;
    }
    assert.deepEqual(newManifest, expected, 'Unexpected Starter manifest mutation: ' + filename);
  }

  const readmePath = 'examples/workspace-starter/README.md';
  const oldReadme = before[readmePath];
  const newReadme = after[readmePath];
  assert.equal(typeof oldReadme, 'string');
  assert.equal(typeof newReadme, 'string');
  const oldPin = '**Vellira ' + previousVersion + ' packages**';
  const nextPin = '**Vellira ' + version + ' packages**';
  assert.equal(oldReadme.split(oldPin).length, 2, 'Prior Starter README pin must occur once');
  assert.equal(newReadme, oldReadme.replace(oldPin, nextPin), 'Unexpected Starter README mutation');
  // npm lockfiles contain transitive registry changes. Their integrity and
  // pinned versions require validateAtomicReleaseSnapshot, not text equality.
  return true;
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
