import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { assertStableReleaseVersion } from './atomic-release-sync.mjs';
import { RELEASE_SYNC_MANIFESTS } from './release-sync-contract.mjs';

const SHA = /^[a-f0-9]{40}$/;
const ordered = [...RELEASE_SYNC_MANIFESTS].sort();
const versions = (read) => Object.fromEntries(
  RELEASE_SYNC_MANIFESTS.map(file => [file, JSON.parse(read(file)).version])
);

function greaterVersion(next, previous) {
  const a = next.split('.').map(Number);
  const b = previous.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

// semantic-release may succeed without publishing. In that case an older,
// immutable release tag MUST NOT be rebound to this newer source commit.
// Partial or malformed new releases still fail closed.
export function classifySemanticReleaseOutcome({
  sourceSha, checkoutSha, baselineVersion, preparedVersion,
  baselineManifestVersions, preparedManifestVersions, changedPaths,
  candidateExists, preparedTagSha,
}) {
  assert.match(sourceSha ?? '', SHA, 'Release requires immutable GITHUB_SHA');
  assert.equal(checkoutSha, sourceSha, 'Release checkout does not match workflow SHA');
  assertStableReleaseVersion(baselineVersion);
  assertStableReleaseVersion(preparedVersion);
  for (const manifests of [baselineManifestVersions, preparedManifestVersions]) {
    assert.deepEqual(Object.keys(manifests).sort(), ordered, 'Missing release manifests');
  }
  for (const file of RELEASE_SYNC_MANIFESTS) {
    assert.equal(baselineManifestVersions[file], baselineVersion,
      'Release baseline version drift: ' + file);
    assert.equal(preparedManifestVersions[file], preparedVersion,
      'Prepared release version drift: ' + file);
  }
  assert.ok(Array.isArray(changedPaths), 'Missing changed paths');
  assert.equal(new Set(changedPaths).size, changedPaths.length, 'Duplicate changed paths');
  if (baselineVersion === preparedVersion) {
    assert.deepEqual(changedPaths, [], 'No-release must not mutate package manifests');
    assert.equal(candidateExists, false, 'No-release must not create npm candidate');
    return { released: false, version: preparedVersion, sourceSha };
  }
  assert.ok(greaterVersion(preparedVersion, baselineVersion),
    'New release must advance SemVer');
  assert.equal(candidateExists, true, 'New release requires prepared npm candidate');
  assert.deepEqual([...changedPaths].sort(), ordered,
    'New release must prepare all seven exact package manifests');
  assert.equal(preparedTagSha, sourceSha,
    'New release tag must resolve to exact workflow commit');
  return { released: true, version: preparedVersion, sourceSha };
}

const git = (...args) => execFileSync('git', args, {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

export function classifyCurrentRelease() {
  const sourceSha = process.env.GITHUB_SHA;
  assert.match(sourceSha ?? '', SHA, 'GITHUB_SHA is required');
  const checkoutSha = git('rev-parse', 'HEAD');
  const baseline = versions(file => git('show', 'HEAD:' + file));
  const prepared = versions(file => fs.readFileSync(file, 'utf8'));
  const changed = git('diff', 'HEAD', '--name-only', '--', ...RELEASE_SYNC_MANIFESTS)
    .split('\n').filter(Boolean);
  const baselineVersion = baseline['package.json'];
  const preparedVersion = prepared['package.json'];
  const candidateExists = fs.existsSync('.release-candidate/candidate.json');
  const newReleaseState = baselineVersion !== preparedVersion ||
    changed.length !== 0 || candidateExists;
  const preparedTagSha = newReleaseState
    ? git('rev-parse', '--verify', 'refs/tags/v' + preparedVersion + '^{commit}')
    : null;
  return classifySemanticReleaseOutcome({
    sourceSha, checkoutSha, baselineVersion, preparedVersion,
    baselineManifestVersions: baseline, preparedManifestVersions: prepared,
    changedPaths: changed, candidateExists, preparedTagSha,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = classifyCurrentRelease();
  assert.ok(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required');
  fs.appendFileSync(process.env.GITHUB_OUTPUT,
    'released=' + result.released + '\nversion=' + result.version + '\n');
  console.log(JSON.stringify(result));
}
