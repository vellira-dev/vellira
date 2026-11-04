import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs, { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fs.readFileSync(
  new URL('./native-metro-matrix.cjs', import.meta.url), 'utf8'
);

test('Metro Phase B compares exact published root imports on both platforms', () => {
  assert.match(script, /const cases = \['baseline', 'theme', 'button', 'button-select'\]/);
  assert.match(script, /const platforms = \['ios', 'android'\]/);
  assert.match(script, /VELLIRA_NATIVE_VERSION/);
  assert.match(script, /React\.createElement\(ThemeProvider/);
  assert.match(script, /'ThemeProvider, Button, Select'/);
  assert.match(script, /expoBin, 'export', '--platform', platform/);
  assert.match(script, /scriptBytes/);
  assert.match(script, /deltaFromBaseline/);
  assert.match(script, /deltaFromButton/);
});

test('opt-in production mode preserves output without dev bundle work', () => {
  assert.match(script, /VELLIRA_METRO_PRODUCTION_ONLY/);
  assert.match(script, /if \(!productionOnly\)/);
  assert.match(script, /schemaVersion: 2/);
  assert.match(script, /issue: optInSubpaths \? 2082 : 470/);
  assert.match(script, /sourceRevision/);
  assert.match(script, /packageLockSha256/);
  assert.match(script, /VELLIRA_METRO_EVIDENCE/);
});

test('normal npm resolution must not install Picker or hide peer contracts', () => {
  assert.match(script, /npm_config_legacy_peer_deps: 'false'/);
  assert.match(script, /\['install', '--no-audit', '--no-fund'\]/);
  assert.doesNotMatch(script, /'install', '--legacy-peer-deps'/);
  assert.match(script, /'node_modules\/@react-native-picker\/picker'/);
  assert.match(script, /published Vellira still requires Picker peer/);
  assert.match(script, /pickerInLockfile: false/);
});

test('opt-in Expo 58 fixture and leaf-theme development marker', () => {
  assert.match(script, /getNativeExpoFixture\(process.env.VELLIRA_NATIVE_EXPO_PROFILE\)/);
  assert.match(script, /starterLockSha256: expoFixture.lockSha256/);
  assert.match(script, /kind === 'theme' \|\| kind === 'leaf-theme'/);
});

test('exact Native candidate requires a predeclared matching SHA256', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'vellira-native-sha-'));
  try {
    const file = path.join(scratch, 'native-candidate.tgz');
    writeFileSync(file, 'synthetic-not-a-real-package');
    const execute = (extra) => spawnSync(
      process.execPath,
      [fileURLToPath(new URL('./native-metro-matrix.cjs', import.meta.url))],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          VELLIRA_NATIVE_VERSION: '2.190.9',
          VELLIRA_NATIVE_CANDIDATE_TGZ: file,
          ...extra,
        },
      }
    );
    const missing = execute({ VELLIRA_NATIVE_CANDIDATE_SHA256: '' });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /requires its SHA256 pinned/);
    const incorrect = execute({
      VELLIRA_NATIVE_CANDIDATE_SHA256: '0'.repeat(64),
    });
    assert.notEqual(incorrect.status, 0);
    assert.match(incorrect.stderr, /candidate SHA256 mismatch/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('opt-in shared Native matrix measures exact packed candidate root vs leaf', () => {
  assert.match(script, /VELLIRA_METRO_SUBPATH_MATRIX/);
  assert.match(script, /VELLIRA_NATIVE_CANDIDATE_TGZ/);
  assert.match(script, /path\.isAbsolute\(candidateTarball\)/);
  assert.match(script, /assertNativeSubpathContract\(nativeRoot\)/);
  assert.match(script, /'leaf-theme', 'leaf-button', 'leaf-button-select', 'mixed-root-leaf'/);
  assert.match(script, /nativeSubpathDeltas/);
  assert.match(script, /savedBytes/);
  assert.match(script, /candidateSource/);
  assert.match(script, /createHash\('sha256'\)/);
});

test('exact Native Metro matrix pins the entire release-candidate dependency set', () => {
  assert.match(script, /validateCandidateArtifactDirectory\(candidateDir, expectedSourceSha, NATIVE_PACKAGE_NAMES\)/);
  assert.match(script, /assertInstalledCandidatePackages\(dir, candidate, NATIVE_PACKAGE_NAMES\)/);
  assert.match(script, /deps\[artifact.name\] = 'file:' \+ artifact.tarballPath/);
  assert.match(script, /nativeArtifact.sha256 !== candidateSha256/);
  assert.match(script, /manifestSha256: candidate.manifestSha256/);
  assert.match(script, /verifiedLocalCandidatePackages/);
});

test('candidate manifest authority must exist before starting Metro installs', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'vellira-native-manifest-'));
  try {
    const file = path.join(scratch, 'native-candidate.tgz');
    writeFileSync(file, 'synthetic-not-a-real-package');
    const { createHash } = require('node:crypto');
    const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const execute = (extra) => spawnSync(
      process.execPath,
      [fileURLToPath(new URL('./native-metro-matrix.cjs', import.meta.url))],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          VELLIRA_NATIVE_VERSION: '2.190.9',
          VELLIRA_NATIVE_CANDIDATE_TGZ: file,
          VELLIRA_NATIVE_CANDIDATE_SHA256: hash,
          VELLIRA_CANDIDATE_DIR: '',
          VELLIRA_CANDIDATE_SHA: '',
          ...extra,
        },
      }
    );
    const missing = execute({});
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /requires VELLIRA_CANDIDATE_DIR and exact VELLIRA_CANDIDATE_SHA/);
    const invalid = execute({
      VELLIRA_CANDIDATE_DIR: scratch,
      VELLIRA_CANDIDATE_SHA: '0'.repeat(40),
    });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /release candidate manifest is missing/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
