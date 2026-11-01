import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { validateAtomicReleaseSnapshot, assertStableReleaseVersion } from './atomic-release-sync.mjs';

const require = createRequire(import.meta.url);
const { syncWorkspaceStarterVersions } = require('../sync-workspace-starter-versions.cjs');
const { syncStarterLockfiles } = require('../sync-workspace-starter-lockfiles.cjs');

export const PUBLISHED_PACKAGES = Object.freeze([
  '@vellira-ui/core', '@vellira-ui/types', '@vellira-ui/tokens',
  '@vellira-ui/icons', '@vellira-ui/react', '@vellira-ui/react-native',
]);

// Fail closed before mutating Starter files. This script never publishes.
export function verifyPublishedRelease(version, { execute = execFileSync } = {}) {
  assertStableReleaseVersion(version);
  const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  const release = JSON.parse(execute('gh', [
    'api', 'repos/vellira-dev/vellira/releases/tags/v' + version,
  ], options));
  assert.equal(release.tag_name, 'v' + version);
  assert.equal(release.draft, false);
  assert.equal(release.prerelease, false);
  const expectedSha = process.env.EXPECTED_TAG_SHA || process.env.GITHUB_SHA;
  assert.match(expectedSha ?? '', /^[0-9a-f]{40}$/, 'Expected immutable release source SHA');
  const tag = JSON.parse(execute('gh', [
    'api', 'repos/vellira-dev/vellira/git/ref/tags/v' + version,
  ], options));
  let target = tag.object;
  if (target?.type === 'tag') {
    target = JSON.parse(execute('gh', [
      'api', 'repos/vellira-dev/vellira/git/tags/' + target.sha,
    ], options)).object;
  }
  assert.equal(target?.type, 'commit', 'Release tag must resolve to a commit');
  assert.equal(target?.sha, expectedSha, 'Published release tag points at unexpected source SHA');
  for (const name of PUBLISHED_PACKAGES) {
    const published = execute('npm', [
      'view', name + '@' + version, 'version', '--json',
      '--registry=https://registry.npmjs.org', '--fetch-retries=2',
      '--fetch-timeout=30000',
    ], options).trim();
    assert.equal(JSON.parse(published), version, 'Unpublished ' + name + '@' + version);
  }
}

export function prepareAtomicStarter({ root, version, verify = verifyPublishedRelease }) {
  assertStableReleaseVersion(version);
  // semantic-release must have prepared the root and all public package manifests.
  for (const file of [
    'package.json', ...PUBLISHED_PACKAGES.map(name =>
      'packages/' + name.slice('@vellira-ui/'.length) + '/package.json'),
  ]) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    assert.equal(manifest.version, version, 'Not a prepared release: ' + file);
  }
  verify(version);
  syncWorkspaceStarterVersions({ root, version });
  syncStarterLockfiles({ root });
  validateAtomicReleaseSnapshot(root, version);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(process.argv.length, 3, 'Usage: node scripts/ci/prepare-atomic-release-sync.mjs <version>');
  prepareAtomicStarter({ root: process.cwd(), version: process.argv[2] });
}
