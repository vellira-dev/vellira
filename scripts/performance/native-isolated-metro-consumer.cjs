#!/usr/bin/env node
// Issue #1906: opt-in, non-publishing Metro experiment.
// Replaces the installed package's root JS only inside disposable Expo fixtures.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const native = path.join(repo, 'packages/react-native');
const version = process.env.VELLIRA_NATIVE_VERSION;
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error('VELLIRA_NATIVE_VERSION must be an exact published semver.');
}
const variants = [
  { name: 'button', entry: 'src/primitives/Button/index.ts', symbol: 'Button',
    markup: "React.createElement(Button, null, 'Vellira button probe')" },
  { name: 'theme', entry: 'src/theme/index.ts', symbol: 'ThemeProvider',
    markup: "React.createElement(ThemeProvider, null, React.createElement(Text, null, 'Vellira theme probe'))" },
];
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-metro-isolated-'));
const evidence = { schemaVersion: 1, issue: 1906, publishedVersion: version,
  kind: 'temporary-consumer-root-override', measurements: {}, limitations: [
    'This is a temporary replacement of dist/index.js in clean consumers, NOT a published subpath export.',
    'Metro production export is not Hermes execution, native linking, device startup or API compatibility proof.',
    'No public package files or exports are changed.',
  ] };
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' } });
  if (result.error || result.status !== 0) {
    throw new Error([command, ...args, result.error?.message, result.stdout, result.stderr]
      .filter(Boolean).join('\n').slice(-12000));
  }
}
function put(dir, filename, data) {
  const target = path.join(dir, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
}
function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const name = path.join(dir, item.name);
    return item.isDirectory() ? filesUnder(name) : item.isFile() ? [name] : [];
  });
}
function buildIsolated(variant) {
  const out = path.join(scratch, 'built-' + variant.name);
  run('pnpm', ['exec', 'tsdown', variant.entry, '--config', 'tsdown.config.ts',
    '--out-dir', out], native);
  const js = filesUnder(out).filter(file => /\.(?:js|mjs|cjs)$/.test(file));
  if (js.length !== 1) throw new Error('Expected one isolated JS file for ' + variant.name);
  return fs.readFileSync(js[0]);
}
function exportConsumer(variant, alternative, isolatedJs) {
  const dir = path.join(scratch, variant.name + '-' + alternative);
  fs.mkdirSync(dir);
  put(dir, 'package.json', JSON.stringify({
    name: 'vellira-isolated-probe-' + variant.name + '-' + alternative,
    private: true, version: '0.0.0', main: 'index.js',
    dependencies: { expo: '57.0.31', '@expo/metro-runtime': '57.0.17',
      react: '19.2.3', 'react-native': '0.86.3', 'react-native-svg': '15.15.4',
      '@vellira-ui/react-native': version }
  }, null, 2));
  put(dir, 'app.json', JSON.stringify({ expo: { name: 'Vellira isolated probe',
    slug: 'vellira-isolated-' + variant.name + '-' + alternative,
    version: '1.0.0', platforms: ['ios', 'android'] } }));
  put(dir, 'index.js', "import { registerRootComponent } from 'expo';\nimport App from './App';\nregisterRootComponent(App);\n");
  put(dir, 'App.js', "import React from 'react';\nimport { View, Text } from 'react-native';\n" +
    "import { " + variant.symbol + " } from '@vellira-ui/react-native';\n" +
    "export default function App() { return React.createElement(View, null, " + variant.markup + "); }\n");
  run('npm', ['install', '--legacy-peer-deps', '--no-audit', '--no-fund'], dir);
  const installed = path.join(dir, 'node_modules/@vellira-ui/react-native');
  const installedManifest = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
  if (installedManifest.version !== version) throw new Error('Installed package version mismatch');
  if (fs.existsSync(path.join(dir, 'node_modules/@react-native-picker/picker'))) {
    throw new Error('Unexpected picker installation');
  }
  if (alternative === 'isolated') fs.writeFileSync(path.join(installed, 'dist/index.js'), isolatedJs);
  const results = {};
  for (const platform of ['ios', 'android']) {
    const output = path.join(dir, 'out-' + platform);
    run(process.execPath, [path.join(dir, 'node_modules/expo/bin/cli'), 'export',
      '--platform', platform, '--output-dir', output], dir);
    const js = filesUnder(output).filter(file => /\.(?:js|hbc)$/.test(file));
    if (!js.length) throw new Error('No Metro output for ' + variant.name + '/' + platform);
    results[platform] = { scriptBytes: js.reduce((n, file) => n + fs.statSync(file).size, 0),
      fileCount: js.length };
  }
  return results;
}
try {
  for (const variant of variants) {
    const isolatedJs = buildIsolated(variant);
    const canonical = exportConsumer(variant, 'canonical', isolatedJs);
    const isolated = exportConsumer(variant, 'isolated', isolatedJs);
    evidence.measurements[variant.name] = { canonical, isolated };
    for (const platform of ['ios', 'android']) {
      isolated[platform].deltaFromCanonical =
        isolated[platform].scriptBytes - canonical[platform].scriptBytes;
    }
    console.log('[native-metro-isolated]', variant.name,
      JSON.stringify(evidence.measurements[variant.name]));
  }
  const filename = path.resolve(process.env.VELLIRA_ISOLATED_EVIDENCE ??
    'consumer-evidence/native-isolated-metro.json');
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(evidence, null, 2) + '\n');
  console.log('[native-metro-isolated] evidence:', filename);
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
