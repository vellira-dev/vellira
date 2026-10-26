#!/usr/bin/env node
// #1906 unpublished subpath consumer proof. No production manifest mutations.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const native = path.join(repo, 'packages/react-native');
const version = process.env.VELLIRA_NATIVE_VERSION;
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error('Set VELLIRA_NATIVE_VERSION to an exact published version');
}
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-subpath-expo-'));
const entries = [
  { name: 'root', entry: 'src/index.ts', js: 'index.js', types: 'index.d.ts', key: '.' },
  { name: 'button', entry: 'src/primitives/Button/index.ts', js: 'button.js',
    types: 'primitives/Button/index.d.ts', key: './button' },
  { name: 'theme', entry: 'src/theme/index.ts', js: 'theme.js',
    types: 'theme/index.d.ts', key: './theme' },
];
const result = { schemaVersion: 1, issue: 1906, publishedVersion: version,
  kind: 'unpublished-expo-subpath-consumer', consumers: {},
  limitations: ['Temporary local export manifest is not publicly available',
    'Metro export does not prove native device startup or Hermes runtime'] };

function run(command, args, cwd) {
  const p = spawnSync(command, args, { cwd, encoding: 'utf8',
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
  if (p.error || p.status !== 0) {
    throw new Error([command, ...args, p.error?.message, p.stdout, p.stderr]
      .filter(Boolean).join('\n').slice(-14000));
  }
}
function write(base, file, content) {
  const target = path.join(base, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const p = path.join(dir, item.name);
    return item.isDirectory() ? walk(p) : item.isFile() ? [p] : [];
  });
}
try {
  const typesDir = path.join(root, 'types');
  run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json', '--emitDeclarationOnly',
    '--declarationMap', 'false', '--outDir', typesDir], native);
  const outputs = {};
  for (const entry of entries) {
    const build = path.join(root, 'built-' + entry.name);
    run('pnpm', ['exec', 'tsdown', entry.entry,
      '--config', 'tsdown.config.ts', '--out-dir', build], native);
    const js = walk(build).filter(p => /\.(?:js|mjs)$/.test(p));
    if (js.length !== 1) throw new Error(entry.name + ': expected exactly one JS file');
    outputs[entry.name] = fs.readFileSync(js[0]);
  }
  for (const entry of entries) {
    const consumer = path.join(root, 'consumer-' + entry.name);
    fs.mkdirSync(consumer);
    write(consumer, 'package.json', JSON.stringify({
      name: 'vellira-subpath-consumer-' + entry.name, private: true,
      version: '0.0.0', main: 'index.js',
      dependencies: { '@vellira-ui/react-native': version,
        expo: '57.0.31', '@expo/metro-runtime': '57.0.17',
        react: '19.2.3', 'react-native': '0.86.3', 'react-native-svg': '15.15.4' },
      devDependencies: { typescript: '6.0.3', '@types/react': '19.2.4' }
    }, null, 2));
    write(consumer, 'app.json', JSON.stringify({ expo: {
      name: 'Vellira Subpath', slug: 'vellira-subpath-' + entry.name,
      version: '1.0.0', platforms: ['ios', 'android'] } }));
    write(consumer, 'index.js',
      "import { registerRootComponent } from 'expo';\nimport App from './App';\nregisterRootComponent(App);\n");
    const specifier = '@vellira-ui/react-native' +
      (entry.key === '.' ? '' : entry.key.slice(1));
    const symbol = entry.name === 'theme' ? 'ThemeProvider' : 'Button';
    const markup = entry.name === 'theme'
      ? "React.createElement(ThemeProvider, null, React.createElement(Text, null, 'Theme'))"
      : "React.createElement(Button, null, 'Button')";
    write(consumer, 'App.tsx',
      "import React from 'react';\nimport { Text } from 'react-native';\n" +
      "import { " + symbol + " } from '" + specifier + "';\n" +
      'export default function App() { return ' + markup + '; }\n');
    write(consumer, 'tsconfig.json', JSON.stringify({
      extends: 'expo/tsconfig.base',
      compilerOptions: { strict: true, skipLibCheck: true },
      include: ['App.tsx']
    }, null, 2));
    run('npm', ['install', '--legacy-peer-deps', '--no-audit', '--no-fund'], consumer);
    const installed = path.join(consumer, 'node_modules/@vellira-ui/react-native');
    const manifest = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
    if (manifest.version !== version) throw new Error('Installed version mismatch');
    if (fs.existsSync(path.join(consumer, 'node_modules/@react-native-picker/picker'))) {
      throw new Error('Picker unexpectedly installed');
    }
    for (const item of entries) {
      write(installed, 'dist/' + item.js, outputs[item.name]);
    }
    fs.cpSync(typesDir, path.join(installed, 'types'), { recursive: true });
    const exports = {};
    for (const item of entries) {
      exports[item.key] = {
        types: './types/' + item.types,
        'react-native': './dist/' + item.js,
        import: './dist/' + item.js,
        default: './dist/' + item.js,
      };
    }
    manifest.exports = exports;
    fs.writeFileSync(path.join(installed, 'package.json'), JSON.stringify(manifest, null, 2));
    // This exercises actual external consumer typecheck, not just resolution.
    run(process.execPath, [
      path.join(consumer, 'node_modules/typescript/bin/tsc'),
      '--project', 'tsconfig.json', '--noEmit'], consumer);
    const platforms = {};
    for (const platform of ['ios', 'android']) {
      const output = path.join(consumer, 'dist-' + platform);
      run(process.execPath, [path.join(consumer, 'node_modules/expo/bin/cli'),
        'export', '--platform', platform, '--output-dir', output], consumer);
      const js = walk(output).filter(file => /\.(?:js|hbc)$/.test(file));
      if (!js.length) throw new Error(entry.name + '/' + platform + ': missing bundle');
      platforms[platform] = {
        jsBytes: js.reduce((n, file) => n + fs.statSync(file).size, 0),
        bundleCount: js.length,
      };
    }
    result.consumers[entry.name] = { import: specifier, typecheck: true, platforms };
    console.log('[native-subpath-expo]', entry.name, JSON.stringify(platforms));
  }
  const output = path.resolve(process.env.VELLIRA_SUBPATH_EXPO_EVIDENCE ??
    'consumer-evidence/native-subpath-expo.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log('[native-subpath-expo] evidence:', output);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
