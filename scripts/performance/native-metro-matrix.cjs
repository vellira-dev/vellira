#!/usr/bin/env node
// Opt-in diagnostic for #1906. Measures *exports*, not installed-package bytes
// or on-device startup. Uses a published npm version, never workspace source.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inspectPublishedPickerReferences } = require('./native-picker-scan.cjs');

const version = process.env.VELLIRA_NATIVE_VERSION;
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error('Set VELLIRA_NATIVE_VERSION to an exact published semver.');
}
const output = path.resolve(
  process.env.VELLIRA_METRO_EVIDENCE ?? 'consumer-evidence/native-metro-matrix.json'
);
const cases = ['baseline', 'theme', 'button', 'button-select'];
const platforms = ['ios', 'android'];
const sourceInventories = {};

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
        (kind === 'theme' ? 'ThemeProvider' : kind === 'button' ? 'Button' : 'Button, Select') +
        " } from '@vellira-ui/react-native';\n";
  const children =
    kind === 'baseline'
      ? "React.createElement(Text, null, 'Metro baseline')"
      : kind === 'theme'
        ? "React.createElement(ThemeProvider, null, React.createElement(Text, null, 'Metro theme only'))"
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
      const { references, scannedFiles } = inspectPublishedPickerReferences(nativeRoot, packedFiles);
      nativePackageInventory = {
        requiredPeers: nativeManifest.peerDependencies ?? {},
        optionalPeers: nativeManifest.peerDependenciesMeta ?? {},
        distFileCount: packedFiles.length,
        distTotalBytes: packedFiles.reduce((n, file) => n + fs.statSync(file).size, 0),
        pickerReferencesInPackedDist: references,
        scannedFiles,
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
    let developmentBundles = null;
    {
      developmentBundles = {};
      sourceInventories[kind] = {};
      for (const platform of platforms) {
        const bundlePath = path.join(dir, 'dev-' + platform + '.jsbundle');
        const assetsDir = path.join(dir, 'dev-' + platform + '-assets');
        const sourceMapPath = path.join(dir, 'dev-' + platform + '.map');
        run(process.execPath, [
          expoBin, 'export:embed',
          '--platform', platform,
          '--dev', 'true',
          '--entry-file', 'index.js',
          '--bundle-output', bundlePath,
          '--assets-dest', assetsDir,
          '--sourcemap-output', sourceMapPath,
          '--minify', 'false',
        ], dir);
        if (!fs.existsSync(bundlePath)) {
          throw new Error(kind + '/' + platform + ': development bundle missing');
        }
        const content = fs.readFileSync(bundlePath, 'utf8');
        const marker = kind === 'baseline'
          ? 'Metro baseline'
          : kind === 'theme'
            ? 'Metro theme only'
            : 'Metro Button';
        if (content.length < 10_000 || !content.includes(marker)) {
          throw new Error(kind + '/' + platform + ': development bundle lacks ' + marker);
        }
        if (!fs.existsSync(sourceMapPath)) {
          throw new Error(kind + '/' + platform + ': development source map missing');
        }
        const sourceMap = JSON.parse(fs.readFileSync(sourceMapPath, 'utf8'));
        if (!Array.isArray(sourceMap.sources) || sourceMap.sources.length === 0) {
          throw new Error(kind + '/' + platform + ': source map missing module inventory');
        }
        const groupedSources = {};
        const normalizedSources = sourceMap.sources.map((source) => source.replaceAll('\\\\', '/'));
        sourceInventories[kind][platform] = new Set(normalizedSources);
        for (const normalized of normalizedSources) {
          const group = normalized.includes('@vellira-ui/')
            ? '@vellira-ui'
            : normalized.includes('react-native/')
              ? 'react-native'
              : normalized.includes('expo/')
                ? 'expo'
                : normalized.includes('node_modules/')
                  ? 'other-node-modules'
                  : 'application-or-virtual';
          groupedSources[group] = (groupedSources[group] ?? 0) + 1;
        }
        developmentBundles[platform] = {
          bundleBytes: Buffer.byteLength(content),
          sourceMapModules: sourceMap.sources.length,
          sourceMapModuleGroups: groupedSources,
          buttonMarkerPresent: true,
          note: 'Source map counts are module inventory, not proportional output-byte attribution or device runtime proof',
        };
      }
    }
    evidence.cases[kind] = { installedVersion, pickerInstalled: false, nativePackageInventory, platforms: measurements, developmentBundles };
    console.log('[native-metro-1906]', kind, JSON.stringify(evidence.cases[kind]));
  }
  for (const platform of platforms) {
    const base = evidence.cases.baseline.platforms[platform].scriptBytes;
    evidence.cases.theme.platforms[platform].deltaFromBaseline =
      evidence.cases.theme.platforms[platform].scriptBytes - base;
    evidence.cases.button.platforms[platform].deltaFromBaseline =
      evidence.cases.button.platforms[platform].scriptBytes - base;
    evidence.cases.button.platforms[platform].deltaFromTheme =
      evidence.cases.button.platforms[platform].scriptBytes -
      evidence.cases.theme.platforms[platform].scriptBytes;
    evidence.cases['button-select'].platforms[platform].deltaFromButton =
      evidence.cases['button-select'].platforms[platform].scriptBytes -
      evidence.cases.button.platforms[platform].scriptBytes;
  }
  evidence.sourceModuleDeltas = {};
  for (const platform of platforms) {
    const casesToCompare = [
      ['baseline', 'theme'],
      ['theme', 'button'],
      ['button', 'button-select'],
    ];
    evidence.sourceModuleDeltas[platform] = {};
    for (const [from, to] of casesToCompare) {
      const before = sourceInventories[from][platform];
      const after = sourceInventories[to][platform];
      if (!before || !after) {
        throw new Error('missing source inventory for ' + platform + ': ' + from + ' -> ' + to);
      }
      evidence.sourceModuleDeltas[platform][from + '-to-' + to] = {
        added: [...after].filter((source) => !before.has(source)).length,
        removed: [...before].filter((source) => !after.has(source)).length,
        unchanged: [...after].filter((source) => before.has(source)).length,
        note: 'Source-map module identities, not output-byte contributions',
      };
    }
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log('[native-metro-1906] evidence:', output);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
