#!/usr/bin/env node
// Opt-in diagnostic for #1906. Measures *exports*, not installed-package bytes
// or on-device startup. Uses a published npm version, never workspace source.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const version = process.env.VELLIRA_NATIVE_VERSION;
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error('Set VELLIRA_NATIVE_VERSION to an exact published semver.');
}
const output = path.resolve(
  process.env.VELLIRA_METRO_EVIDENCE ?? 'consumer-evidence/native-metro-matrix.json'
);
const cases = ['baseline', 'button', 'button-select'];
const platforms = ['ios', 'android'];

function run(command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      [command, ...args, result.error?.message, result.stdout, result.stderr]
        .filter(Boolean)
        .join('\n')
        .slice(-14000)
    );
  }
  return result.stdout.trim();
}
function write(dir, filename, data) {
  fs.mkdirSync(path.dirname(path.join(dir, filename)), { recursive: true });
  fs.writeFileSync(path.join(dir, filename), data);
}
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(target) : entry.isFile() ? [target] : [];
  });
}
function manifest(kind) {
  const deps = {
    '@expo/metro-runtime': '57.0.17',
    expo: '57.0.31',
    react: '19.2.3',
    'react-native': '0.86.3',
    'react-native-svg': '15.15.4',
  };
  if (kind !== 'baseline') deps['@vellira-ui/react-native'] = version;
  return {
    name: 'vellira-native-metro-' + kind,
    private: true,
    version: '0.0.0',
    main: 'index.js',
    dependencies: deps,
  };
}
function app(kind) {
  const imports =
    kind === 'baseline'
      ? ''
      : "import { " +
        (kind === 'button' ? 'Button' : 'Button, Select') +
        " } from '@vellira-ui/react-native';\n";
  const children =
    kind === 'baseline'
      ? "React.createElement(Text, null, 'Metro baseline')"
      : kind === 'button'
        ? "React.createElement(Button, null, 'Metro Button')"
        : "React.createElement(View, null, React.createElement(Button, null, 'Metro Button'), React.createElement(Select, { label: 'Choice', options: [{ value: 'one', label: 'One' }], defaultValue: 'one' }))";
  return (
    "import React from 'react';\n" +
    "import { View, Text } from 'react-native';\n" +
    imports +
    'export default function App() {\n' +
    '  return React.createElement(View, null, ' +
    children +
    ');\n}\n'
  );
}
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-metro-1906-'));
const evidence = {
  schemaVersion: 1,
  issue: 1906,
  version,
  node: process.version,
  installMode: 'npm --legacy-peer-deps (disables npm peer auto-install)',
  purpose: 'Metro production export comparison; not device/Hermes runtime proof',
  cases: {},
};
try {
  for (const kind of cases) {
    const dir = path.join(root, kind);
    fs.mkdirSync(dir);
    write(dir, 'package.json', JSON.stringify(manifest(kind), null, 2) + '\n');
    write(dir, 'app.json', JSON.stringify({
      expo: { name: 'Vellira Metro ' + kind, slug: 'vellira-metro-' + kind, version: '1.0.0', platforms },
    }, null, 2) + '\n');
    write(dir, 'index.js', "import { registerRootComponent } from 'expo';\nimport App from './App';\nregisterRootComponent(App);\n");
    write(dir, 'App.js', app(kind));
    run('npm', ['install', '--legacy-peer-deps', '--no-audit', '--no-fund'], dir);
    const pickerPath = path.join(dir, 'node_modules/@react-native-picker/picker');
    if (fs.existsSync(pickerPath)) {
      throw new Error(kind + ': picker present; cannot claim negative-dependency proof.');
    }
    const installedVersion = kind === 'baseline'
      ? null
      : JSON.parse(fs.readFileSync(
          path.join(dir, 'node_modules/@vellira-ui/react-native/package.json'), 'utf8'
        )).version;
    if (installedVersion && installedVersion !== version) {
      throw new Error(kind + ': installed wrong Vellira version ' + installedVersion);
    }
    let nativePackageInventory = null;
    if (kind !== 'baseline') {
      const nativeRoot = path.join(dir, 'node_modules/@vellira-ui/react-native');
      const nativeManifest = JSON.parse(
        fs.readFileSync(path.join(nativeRoot, 'package.json'), 'utf8')
      );
      const packedFiles = walk(path.join(nativeRoot, 'dist'));
      if (!packedFiles.length) throw new Error(kind + ': missing published dist');
      const references = [];
      for (const file of packedFiles) {
        if (!/\.(?:js|d\.ts|d\.mts)$/.test(file)) continue;
        if (fs.readFileSync(file, 'utf8').includes('@react-native-picker/picker')) {
          references.push(path.relative(nativeRoot, file).replaceAll(path.sep, '/'));
        }
      }
      if (references.length) {
        throw new Error(kind + ': published native dist references picker: ' + references.join(', '));
      }
      nativePackageInventory = {
        requiredPeers: nativeManifest.peerDependencies ?? {},
        optionalPeers: nativeManifest.peerDependenciesMeta ?? {},
        distFileCount: packedFiles.length,
        distTotalBytes: packedFiles.reduce((n, file) => n + fs.statSync(file).size, 0),
        pickerReferencesInPackedDist: references,
        note: 'Static packed-dist inspection; does not prove on-device native-module absence',
      };
    }
    const expoBin = path.join(dir, 'node_modules/expo/bin/cli');
    const measurements = {};
    for (const platform of platforms) {
      const outputDir = path.join(dir, 'out-' + platform);
      run(process.execPath, [
        expoBin, 'export', '--platform', platform, '--output-dir', outputDir,
      ], dir, { EXPO_OFFLINE: '1' });
      const files = walk(outputDir);
      if (!files.length) throw new Error(kind + '/' + platform + ': no output files');
      const js = files.filter((file) => /\.(?:js|hbc)$/.test(file));
      if (!js.length) throw new Error(kind + '/' + platform + ': no JS/Hermes files');
      measurements[platform] = {
        outputBytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0),
        scriptBytes: js.reduce((sum, file) => sum + fs.statSync(file).size, 0),
        scriptCount: js.length,
      };
    }
    evidence.cases[kind] = { installedVersion, pickerInstalled: false, nativePackageInventory, platforms: measurements };
    console.log('[native-metro-1906]', kind, JSON.stringify(evidence.cases[kind]));
  }
  for (const platform of platforms) {
    const base = evidence.cases.baseline.platforms[platform].scriptBytes;
    evidence.cases.button.platforms[platform].deltaFromBaseline =
      evidence.cases.button.platforms[platform].scriptBytes - base;
    evidence.cases['button-select'].platforms[platform].deltaFromButton =
      evidence.cases['button-select'].platforms[platform].scriptBytes -
      evidence.cases.button.platforms[platform].scriptBytes;
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log('[native-metro-1906] evidence:', output);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
