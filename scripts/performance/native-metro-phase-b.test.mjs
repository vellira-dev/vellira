import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

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
