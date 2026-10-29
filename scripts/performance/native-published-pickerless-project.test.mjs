import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const generator = fileURLToPath(new URL('./native-published-pickerless-project.cjs', import.meta.url));

function withFixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-pickerless-generator-test-'));
  try { run({ root, output: path.join(root, 'isolated-expo') }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function execute(output, version = '2.188.1') {
  return spawnSync(process.execPath, [generator, output], {
    encoding: 'utf8',
    env: { ...process.env, VELLIRA_NATIVE_VERSION: version },
  });
}

function prepare(output) {
  const result = execute(output);
  assert.equal(result.status, 0, result.stderr);
  return {
    app: fs.readFileSync(path.join(output, 'App.tsx'), 'utf8'),
    manifest: JSON.parse(fs.readFileSync(path.join(output, 'package.json'), 'utf8')),
    expo: JSON.parse(fs.readFileSync(path.join(output, 'app.json'), 'utf8')),
    verifier: path.join(output, 'verify-pickerless.cjs'),
    readme: fs.readFileSync(path.join(output, 'README.md'), 'utf8'),
  };
}

function fakePublishedInstall(output) {
  const root = path.join(output, 'node_modules/@vellira-ui/react-native');
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'),
    JSON.stringify({ name: '@vellira-ui/react-native', version: '2.188.1' }));
  fs.writeFileSync(path.join(root, 'dist/index.js'), 'export const Button = 1;\n');
  fs.writeFileSync(path.join(root, 'dist/index.d.ts'), 'export declare const Button: number;\n');
  return root;
}

function verify(executable) {
  return spawnSync(process.execPath, [executable], { encoding: 'utf8' });
}

test('creates an opt-in published-package Expo/Hermes runtime test with no picker dependency', () => {
  withFixture(({ output }) => {
    const { app, manifest, expo, readme } = prepare(output);
    assert.equal(manifest.dependencies['@vellira-ui/react-native'], '2.188.1');
    assert.equal(manifest.dependencies.expo, '57.0.31');
    assert.equal(manifest.dependencies['react-native'], '0.86.3');
    assert.equal(manifest.dependencies['react-native-safe-area-context'], '5.9.1');
    assert.equal(manifest.scripts['verify:pickerless'], 'node verify-pickerless.cjs');
    assert.equal(manifest.scripts.ios, 'expo run:ios');
    assert.ok(!Object.hasOwn(manifest.dependencies, '@react-native-picker/picker'));
    assert.equal(expo.expo.jsEngine, 'hermes');
    for (const token of ['HermesInternal', 'Select', "presentation='modal'",
      'SafeAreaProvider', 'SafeAreaView', "seen.includes('fr') && seen.includes('es')",
      'onValueChange', 'selectPassed', 'Native Select without picker',
      'VELLIRA_PUBLISHED_PICKERLESS']) {
      assert.ok(app.includes(token), 'Missing proof marker: ' + token);
    }
    assert.ok(readme.includes('npm install --legacy-peer-deps'));
    assert.ok(readme.includes('ordinary npm installation'));
    assert.ok(readme.includes('select France, reopen and select Spain'));
  });
});

test('published package and negative-picker verifier passes only when complete and picker absent', () => {
  withFixture(({ output }) => {
    const { verifier } = prepare(output);
    const packageRoot = fakePublishedInstall(output);
    const result = verify(verifier);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /picker absent/);
    fs.mkdirSync(path.join(output, 'node_modules/@react-native-picker/picker'), { recursive: true });
    const withPicker = verify(verifier);
    assert.notEqual(withPicker.status, 0);
    assert.match(withPicker.stderr, /Unexpected picker auto-install/);
    fs.rmSync(path.join(output, 'node_modules/@react-native-picker'), { recursive: true });
    fs.writeFileSync(path.join(packageRoot, 'dist/index.d.ts'),
      "import type { Picker } from '@react-native-picker/picker';\n");
    const withReference = verify(verifier);
    assert.notEqual(withReference.status, 0);
    assert.match(withReference.stderr, /references picker/);
  });
});

test('rejects an unexpected published version and missing runtime/declarations', () => {
  withFixture(({ output }) => {
    const { verifier } = prepare(output);
    const packageRoot = fakePublishedInstall(output);
    fs.writeFileSync(path.join(packageRoot, 'package.json'),
      JSON.stringify({ name: '@vellira-ui/react-native', version: '2.188.2' }));
    assert.match(verify(verifier).stderr, /wrong published Vellira/);
    fs.writeFileSync(path.join(packageRoot, 'package.json'),
      JSON.stringify({ name: '@vellira-ui/react-native', version: '2.188.1' }));
    fs.rmSync(path.join(packageRoot, 'dist/index.js'));
    assert.match(verify(verifier).stderr, /Incomplete published dist/);
  });
});

test('refuses to overwrite an existing output and rejects unpinned versions', () => {
  withFixture(({ output }) => {
    fs.mkdirSync(output);
    fs.writeFileSync(path.join(output, 'marker'), 'do not overwrite');
    const blocked = execute(output);
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /already exists/);
    assert.deepEqual(fs.readdirSync(output), ['marker']);
    fs.rmSync(output, { recursive: true });
    const unpinned = execute(output, 'latest');
    assert.notEqual(unpinned.status, 0);
    assert.match(unpinned.stderr, /exact published version/);
    assert.ok(!fs.existsSync(output));
  });
});
