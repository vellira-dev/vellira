const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { appendFileSync, readFileSync } = require('node:fs');
const path = require('node:path');

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function parseSemver(version, label) {
  const match = (version ?? '').match(SEMVER);
  assert.ok(match, `${label} must be valid SemVer`);
  return {
    version,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split('.') ?? [],
  };
}

function compareIdentifiers(left, right) {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  return left.localeCompare(right);
}

function compareSemver(left, right) {
  const a = parseSemver(left, 'left version');
  const b = parseSemver(right, 'right version');
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] - b[key];
  }
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (a.prerelease[index] === undefined) return -1;
    if (b.prerelease[index] === undefined) return 1;
    const comparison = compareIdentifiers(
      a.prerelease[index],
      b.prerelease[index]
    );
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function classifyReleaseState({ manifestVersion, latestTag }) {
  parseSemver(manifestVersion, 'package.json version');

  if (!latestTag) {
    return {
      state: 'synchronized',
      manifestVersion,
      latestTag: null,
      latestVersion: null,
    };
  }

  assert.match(
    latestTag,
    new RegExp(`^v${SEMVER.source.slice(1, -1)}$`),
    'Latest reachable release tag must be v-prefixed SemVer'
  );

  const latestVersion = latestTag.slice(1);
  if (manifestVersion === latestVersion) {
    return {
      state: 'synchronized',
      manifestVersion,
      latestTag,
      latestVersion,
    };
  }
  const comparison = compareSemver(manifestVersion, latestVersion);
  if (comparison < 0) {
    return {
      state: 'recoverable',
      manifestVersion,
      latestTag,
      latestVersion,
    };
  }
  return {
    state: 'invalid',
    manifestVersion,
    latestTag,
    latestVersion,
  };
}

function assertReleaseStateSynchronized({ manifestVersion, latestTag }) {
  const state = classifyReleaseState({ manifestVersion, latestTag });
  assert.equal(
    state.state,
    'synchronized',
    state.state === 'recoverable'
      ? `Release state is not synchronized: package.json is ${manifestVersion}, latest reachable release tag is ${latestTag}. Automatic recovery must reconcile the verified existing release before semantic-release.`
      : `Release state is invalid: package.json is ${manifestVersion}, latest reachable release tag is ${latestTag}. Refusing release because the manifest is not an exact synchronized version and is not older than external release state.`
  );
  return { manifestVersion, latestTag };
}

function latestReachableReleaseTag() {
  return (
    execFileSync(
      'git',
      [
        'tag',
        '--merged',
        'HEAD',
        '--sort=-version:refname',
        '--list',
        'v[0-9]*',
      ],
      { encoding: 'utf8' }
    )
      .trim()
      .split('\n')
      .find(Boolean) ?? null
  );
}

function readManifestVersion() {
  const manifest = JSON.parse(
    readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')
  );
  return manifest.version;
}

function writeOutput(name, value) {
  assert.ok(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required');
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value ?? ''}\n`);
}

if (require.main === module) {
  const manifestVersion = readManifestVersion();
  const latestTag = latestReachableReleaseTag();

  if (process.argv[2] === '--classify') {
    const state = classifyReleaseState({ manifestVersion, latestTag });
    assert.notEqual(
      state.state,
      'invalid',
      `Release state is invalid: package.json is ${manifestVersion}, latest reachable release tag is ${latestTag}. Refusing automatic reconciliation because the versions are neither an exact match nor a recoverable older-manifest state.`
    );
    const expectedTagSha = latestTag
      ? execFileSync('git', ['rev-parse', `${latestTag}^{commit}`], {
          encoding: 'utf8',
        }).trim()
      : '';
    writeOutput('state', state.state);
    writeOutput('release_version', state.latestVersion);
    writeOutput('expected_tag_sha', expectedTagSha);
    console.log(JSON.stringify({ ...state, expectedTagSha }, null, 2));
  } else {
    const state = assertReleaseStateSynchronized({
      manifestVersion,
      latestTag,
    });

    if (state.latestTag) {
      console.log(
        `[release] Synchronized release state: package.json ${state.manifestVersion} matches ${state.latestTag}.`
      );
    } else {
      console.log(
        `[release] No reachable release tag found; allowing initial release from package.json ${state.manifestVersion}.`
      );
    }
  }
}

module.exports = {
  assertReleaseStateSynchronized,
  classifyReleaseState,
  compareSemver,
};
