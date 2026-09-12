const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function assertReleaseStateSynchronized({ manifestVersion, latestTag }) {
  assert.match(
    manifestVersion ?? '',
    SEMVER,
    'package.json version must be valid SemVer'
  );

  if (!latestTag) {
    return { manifestVersion, latestTag: null };
  }

  assert.match(
    latestTag,
    new RegExp(`^v${SEMVER.source.slice(1, -1)}$`),
    'Latest reachable release tag must be v-prefixed SemVer'
  );

  const latestVersion = latestTag.slice(1);
  assert.equal(
    manifestVersion,
    latestVersion,
    `Release state is not synchronized: package.json is ${manifestVersion}, latest reachable release tag is ${latestTag}. Stop before semantic-release and run release recovery first.`
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

if (require.main === module) {
  const state = assertReleaseStateSynchronized({
    manifestVersion: readManifestVersion(),
    latestTag: latestReachableReleaseTag(),
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

module.exports = {
  assertReleaseStateSynchronized,
};
