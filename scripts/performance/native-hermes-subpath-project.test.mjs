import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const generator = fileURLToPath(new URL('./native-hermes-subpath-project.cjs', import.meta.url));

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-hermes-test-'));
  const repo = path.join(root, 'repository');
  const scripts = path.join(repo, 'scripts/performance');
  const native = path.join(repo, 'packages/react-native');
  fs.mkdirSync(scripts, { recursive: true });
  fs.mkdirSync(path.join(native, 'dist/shared-proof'), { recursive: true });
  fs.copyFileSync(generator, path.join(scripts, 'native-hermes-subpath-project.cjs'));
  fs.writeFileSync(path.join(native, 'package.json'), '{"version":"2.188.1"}\n');
  for (const file of ['index.js', 'button.js', 'theme.js']) {
    fs.writeFileSync(path.join(native, 'dist/shared-proof', file), 'export {}\n');
  }
  // Replaces the packer for this offline *generator* test only.
  fs.writeFileSync(path.join(scripts, 'native-shared-chunk-tarball-probe.cjs'),
    "require('node:fs').writeFileSync(process.env.VELLIRA_SHARED_TARBALL_OUTPUT, 'FIXTURE_ONLY');\n");
  const destination = path.join(root, 'generated');
  return { root, repo, native, destination, generator: path.join(scripts, 'native-hermes-subpath-project.cjs') };
}

function execute(fixture, args = [fixture.destination], environment = {}) {
  return spawnSync(process.execPath, [fixture.generator, ...args], {
    cwd: fixture.repo,
    encoding: 'utf8',
    env: { ...process.env, VELLIRA_HERMES_SHEET_PROOF: '0', ...environment },
  });
}

function withFixture(callback) {
  const fixture = makeFixture();
  try { callback(fixture); }
  finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
}

test('prepares isolated unpublished Hermes Expo app with both context boundaries', () => {
  withFixture((f) => {
    const run = execute(f);
    assert.equal(run.status, 0, run.stderr);
    const manifest = JSON.parse(fs.readFileSync(path.join(f.destination, 'package.json'), 'utf8'));
    const app = fs.readFileSync(path.join(f.destination, 'App.tsx'), 'utf8');
    const config = JSON.parse(fs.readFileSync(path.join(f.destination, 'app.json'), 'utf8'));
    const readme = fs.readFileSync(path.join(f.destination, 'README.md'), 'utf8');
    assert.equal(manifest.dependencies['@vellira-ui/react-native'], 'file:./vellira-hermes-shared-candidate.tgz');
    assert.equal(manifest.dependencies['react-native'], '0.86.3');
    assert.equal(manifest.dependencies.expo, '57.0.31');
    assert.equal(manifest.dependencies['react-native-safe-area-context'], '5.9.1');
    assert.ok(!Object.hasOwn(manifest.dependencies, '@react-native-picker/picker'));
    assert.equal(config.expo.jsEngine, 'hermes');
    for (const token of ['HermesInternal', 'RootProvider', 'SubpathProvider',
      'rootUseTheme', 'subpathUseTheme', 'RootButton', 'SubpathButton',
      'SafeAreaProvider', 'SafeAreaView', 'onRootPress', 'onSubpathPress',
      'root-press-count', 'subpath-press-count', 'independent-button-result',
      'VELLIRA_HERMES_PROOF']) {
      assert.ok(app.includes(token), 'Missing proof marker: ' + token);
    }
    assert.match(app, /onPress=\{onRootPress\}/);
    assert.match(app, /onPress=\{onSubpathPress\}/);
    assert.match(app, /rootPressCount > 0 && subpathPressCount > 0/);
    assert.match(app, /independentPass \? 'PASS' : 'PENDING'/);
    assert.ok(readme.includes('Independent buttons: PASS'));
    assert.doesNotMatch(app, /setPressCount/);
    assert.ok(readme.includes('npm install --legacy-peer-deps'));
    assert.ok(readme.includes('npm run ios -- --device'));
    assert.equal(fs.readFileSync(path.join(f.destination, 'vellira-hermes-shared-candidate.tgz'), 'utf8'), 'FIXTURE_ONLY');
  });
});

test('optional real Hermes sheet proof includes both choices without altering default probe', () => {
  withFixture((f) => {
    const run = execute(f, [f.destination], {
      VELLIRA_HERMES_SHEET_PROOF: '1',
    });
    assert.equal(run.status, 0, run.stderr);

    const app = fs.readFileSync(path.join(f.destination, 'App.tsx'), 'utf8');
    const readme = fs.readFileSync(path.join(f.destination, 'README.md'), 'utf8');

    assert.match(app, /presentation="sheet"/);
    assert.match(app, /<RootProvider theme="light">/);
    assert.match(app, /label: "France", value: "fr"/);
    assert.match(app, /label: "Spain", value: "es"/);
    assert.match(app, /sheetSeen\.includes\("fr"\) && sheetSeen\.includes\("es"\)/);
    assert.match(app, /VELLIRA_HERMES_SHEET/);
    assert.match(app, /__VELLIRA_SELECT_LAYOUT_PROOF__/);
    assert.match(app, /LogBox\.ignoreLogs/);
    assert.match(readme, /VELLIRA_SELECT_LAYOUT/);
    assert.match(readme, /Optional sheet layout proof/);
    assert.match(app, /Independent buttons/);
  });
});

test('never overwrites an existing destination or installed proof', () => {
  withFixture((f) => {
    fs.mkdirSync(f.destination);
    fs.writeFileSync(path.join(f.destination, 'marker'), 'leave untouched');
    const run = execute(f);
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /already exists/);
    assert.equal(fs.readFileSync(path.join(f.destination, 'marker'), 'utf8'), 'leave untouched');
    assert.deepEqual(fs.readdirSync(f.destination), ['marker']);
  });
});

test('fails closed before staging when shared graph build is incomplete', () => {
  withFixture((f) => {
    fs.rmSync(path.join(f.native, 'dist/shared-proof/button.js'));
    const run = execute(f);
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /Missing button.js/);
    assert.ok(!fs.existsSync(f.destination));
  });
});
