import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
  fs.copyFileSync(path.join(path.dirname(generator), 'native-expo-fixture.cjs'),
    path.join(scripts, 'native-expo-fixture.cjs'));
  const releaseScripts = path.join(repo, 'scripts/release-candidate');
  fs.mkdirSync(releaseScripts, { recursive: true });
  fs.copyFileSync(path.join(path.dirname(generator), '../release-candidate/consumer-artifacts.cjs'),
    path.join(releaseScripts, 'consumer-artifacts.cjs'));

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

function makePackedCandidate(fixture, { version = '2.188.1' } = {}) {
  const packageDir = path.join(fixture.root, 'packed', 'package');
  fs.mkdirSync(packageDir, { recursive: true });
  const manifest = {
    name: '@vellira-ui/react-native',
    version,
    exports: {
      '.': { 'react-native': './dist/index.js' },
      './button': { 'react-native': './dist/button.js' },
      './theme': { 'react-native': './dist/theme.js' },
      './select': { 'react-native': './dist/select.js' },
    },
  };
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify(manifest) + '\n'
  );
  const candidate = path.join(fixture.root, 'candidate.tgz');
  const result = spawnSync('tar', [
    '-czf', candidate, '-C', path.join(fixture.root, 'packed'), 'package',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const sha = createHash('sha256').update(fs.readFileSync(candidate)).digest('hex');
  const names = ['core', 'tokens', 'types', 'icons', 'react-native'];
  const candidateDir = path.join(fixture.root, 'release-candidate');
  fs.mkdirSync(candidateDir);
  const artifacts = names.map(name => {
    const filename = name === 'react-native' ? 'candidate.tgz' : name + '.tgz';
    const file = path.join(candidateDir, filename);
    fs.copyFileSync(candidate, file);
    const bytes = fs.readFileSync(file);
    return {
      name: '@vellira-ui/' + name,
      version: '2.188.1',
      filename,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      npmIntegrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64'),
      npmShasum: createHash('sha1').update(bytes).digest('hex'),
    };
  });
  const sourceSha = 'a'.repeat(40);
  fs.writeFileSync(path.join(candidateDir, 'candidate.json'), JSON.stringify({
    schemaVersion: 1,
    source: { sha: sourceSha },
    version: '2.188.1',
    checks: { cleanInstall: true },
    packages: [
      ...artifacts.slice(0, 4),
      { ...artifacts[4] },
      { ...artifacts[0], name: '@vellira-ui/react', filename: 'react.tgz' },
    ],
  }));
  fs.copyFileSync(path.join(candidateDir, 'core.tgz'), path.join(candidateDir, 'react.tgz'));
  return {
    candidate,
    sha,
    candidateDir,
    sourceSha,
    exactEnv: {
      VELLIRA_NATIVE_CANDIDATE_TGZ: candidate,
      VELLIRA_NATIVE_CANDIDATE_SHA256: sha,
      VELLIRA_CANDIDATE_DIR: candidateDir,
      VELLIRA_CANDIDATE_SHA: sourceSha,
    },
  };
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

test('exact Native candidate mode copies immutable tarball without synthetic staging', () => {
  withFixture((fixture) => {
    const { candidate, sha, exactEnv } = makePackedCandidate(fixture);
    fs.rmSync(path.join(fixture.native, 'dist/shared-proof'), {
      recursive: true,
      force: true,
    });
    const run = execute(fixture, [fixture.destination], {
      ...exactEnv,
      VELLIRA_HERMES_SHEET_PROOF: '1',
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /immutable candidate SHA256/);
    assert.match(run.stdout, new RegExp(sha));
    const generated = JSON.parse(fs.readFileSync(path.join(fixture.destination, 'package.json'), 'utf8'));
    for (const name of ['core', 'icons', 'tokens', 'types']) {
      assert.match(generated.dependencies['@vellira-ui/' + name], /^file:\.\//);
      assert.ok(fs.existsSync(path.join(fixture.destination,
        generated.dependencies['@vellira-ui/' + name].slice(7))));
    }
    assert.deepEqual(
      fs.readFileSync(candidate),
      fs.readFileSync(path.join(
        fixture.destination,
        'vellira-hermes-shared-candidate.tgz'
      ))
    );
    const app = fs.readFileSync(path.join(fixture.destination, 'App.tsx'), 'utf8');
    const readme = fs.readFileSync(path.join(fixture.destination, 'README.md'), 'utf8');
    assert.match(app, /from '@vellira-ui\/react-native\/select'/);
    assert.match(readme, /npm install --no-audit --no-fund/);
    assert.doesNotMatch(readme, /npm install --legacy-peer-deps/);
  });
});

test('exact Native candidate rejects missing or mismatched SHA before creating files', () => {
  withFixture((fixture) => {
    const { candidate, sha } = makePackedCandidate(fixture);
    const withoutPin = execute(fixture, [fixture.destination], {
      VELLIRA_NATIVE_CANDIDATE_TGZ: candidate,
    });
    assert.notEqual(withoutPin.status, 0);
    assert.match(withoutPin.stderr, /requires its SHA256 pinned/);
    assert.equal(fs.existsSync(fixture.destination), false);

    const incorrect = execute(fixture, [fixture.destination], {
      VELLIRA_NATIVE_CANDIDATE_TGZ: candidate,
      VELLIRA_NATIVE_CANDIDATE_SHA256: '0'.repeat(64) === sha
        ? '1'.repeat(64) : '0'.repeat(64),
    });
    assert.notEqual(incorrect.status, 0);
    assert.match(incorrect.stderr, /SHA256 mismatch/);
    assert.equal(fs.existsSync(fixture.destination), false);
  });
});

test('exact Native candidate rejects bad archive and source-version drift', () => {
  withFixture((fixture) => {
    const { candidate, sha, exactEnv } = makePackedCandidate(fixture, { version: '2.188.2' });
    const mismatch = execute(fixture, [fixture.destination], exactEnv);
    assert.notEqual(mismatch.status, 0);
    assert.match(mismatch.stderr, /name\/version\/subpath authority mismatch/);
    assert.equal(fs.existsSync(fixture.destination), false);

    const invalid = path.join(fixture.root, 'invalid.tgz');
    fs.writeFileSync(invalid, 'not-a-tarball');
    const hash = createHash('sha256').update(fs.readFileSync(invalid)).digest('hex');
    const reject = execute(fixture, [fixture.destination], {
      ...exactEnv,
      VELLIRA_NATIVE_CANDIDATE_TGZ: invalid,
      VELLIRA_NATIVE_CANDIDATE_SHA256: hash,
    });
    assert.notEqual(reject.status, 0);
    assert.match(reject.stderr, /Hermes Native tarball differs from exact release candidate/);
    assert.equal(fs.existsSync(fixture.destination), false);
  });
});

test('exact Hermes candidate requires full manifest authority before output creation', () => {
  withFixture((fixture) => {
    const { candidate, sha, exactEnv } = makePackedCandidate(fixture);
    const missing = execute(fixture, [fixture.destination], {
      VELLIRA_NATIVE_CANDIDATE_TGZ: candidate,
      VELLIRA_NATIVE_CANDIDATE_SHA256: sha,
      VELLIRA_CANDIDATE_DIR: '',
      VELLIRA_CANDIDATE_SHA: '',
    });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /requires VELLIRA_CANDIDATE_DIR and VELLIRA_CANDIDATE_SHA/);
    assert.equal(fs.existsSync(fixture.destination), false);
    fs.rmSync(path.join(exactEnv.VELLIRA_CANDIDATE_DIR, 'icons.tgz'));
    const missingInternal = execute(fixture, [fixture.destination], exactEnv);
    assert.notEqual(missingInternal.status, 0);
    assert.match(missingInternal.stderr, /Candidate tarball is missing/);
    assert.equal(fs.existsSync(fixture.destination), false);
  });
});
