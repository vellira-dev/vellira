#!/usr/bin/env node
// #1906 — unpublished npm tarball proof. Never publishes or edits workspace packages.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const version = process.env.VELLIRA_NATIVE_VERSION;
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error('Set VELLIRA_NATIVE_VERSION to the exact published version');
}
const workspace = path.resolve(__dirname, '../..');
const native = path.join(workspace, 'packages/react-native');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-subpath-tgz-'));
const specs = [
  { name: 'root', exportKey: '.', symbol: 'Button' },
  { name: 'button', exportKey: './button', symbol: 'Button',
    source: 'src/primitives/Button/index.ts', output: 'button.js',
    types: 'dist/primitives/Button/index.d.ts' },
  { name: 'theme', exportKey: './theme', symbol: 'ThemeProvider',
    source: 'src/theme/index.ts', output: 'theme.js',
    types: 'dist/theme/index.d.ts' },
];
const evidence = {
  schemaVersion: 1, issue: 1906, kind: 'unpublished-packed-native-subpath-consumer',
  sourcePublishedVersion: version, consumers: {}, limitations: [
    'The artifact is a disposable npm tarball, NOT a published Vellira release.',
    'Metro exports and TypeScript checks do not prove Hermes execution, native device startup or visual equivalence.',
    'The production root export is byte-identical to the downloaded public package.',
  ],
};
function call(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
  });
  if (result.error || result.status !== 0) {
    throw new Error([command, ...args, result.error?.message, result.stdout, result.stderr]
      .filter(Boolean).join('\n').slice(-12000));
  }
  return result.stdout;
}
function write(root, file, contents) {
  const to = path.join(root, file);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, contents);
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const target = path.join(dir, item.name);
    return item.isDirectory() ? walk(target) : item.isFile() ? [target] : [];
  });
}
function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
try {
  // Ground the candidate in the real published tarball, including declarations
  // and actual public dependency metadata, before adding any new JS.
  const downloaded = JSON.parse(call('npm', [
    'pack', '@vellira-ui/react-native@' + version, '--json',
    '--pack-destination', scratch, '--ignore-scripts',
  ], scratch))[0];
  const origin = path.join(scratch, downloaded.filename);
  const staging = path.join(scratch, 'staging');
  fs.mkdirSync(staging);
  call('tar', ['-xzf', origin, '-C', staging, '--strip-components=1'], scratch);
  const manifestPath = path.join(staging, 'package.json');
  const originalManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (originalManifest.version !== version || originalManifest.name !== '@vellira-ui/react-native') {
    throw new Error('Unexpected published package identity');
  }
  const originalRootExport = JSON.stringify(originalManifest.exports?.['.']);
  const rootJs = fs.readFileSync(path.join(staging, 'dist/index.js'));
  const rootType = fs.readFileSync(path.join(staging, 'dist/index.d.ts'));

  for (const spec of specs.filter((item) => item.source)) {
    const out = path.join(scratch, 'build-' + spec.name);
    call('pnpm', ['exec', 'tsdown', spec.source, '--config',
      'tsdown.config.ts', '--out-dir', out], native);
    const outputs = walk(out).filter((name) => /\.(?:js|mjs)$/.test(name));
    if (outputs.length !== 1) throw new Error(spec.name + ': expected one JS output');
    if (!fs.existsSync(path.join(staging, spec.types))) {
      throw new Error(spec.name + ': missing declaration in published tarball ' + spec.types);
    }
    const bytes = fs.readFileSync(outputs[0]);
    write(staging, 'dist/' + spec.output, bytes);
    originalManifest.files = [...new Set([
      ...(originalManifest.files ?? []), 'dist/' + spec.output,
    ])];
    originalManifest.exports['./' + spec.name] = {
      types: './' + spec.types,
      'react-native': './dist/' + spec.output,
      import: './dist/' + spec.output,
      default: './dist/' + spec.output,
    };
    evidence[spec.name + 'SourceBytes'] = bytes.length;
  }
  if (JSON.stringify(originalManifest.exports['.']) !== originalRootExport) {
    throw new Error('Root export contract mutated');
  }
  write(staging, 'package.json', JSON.stringify(originalManifest, null, 2) + '\n');

  // npm pack respects the candidate files allow-list; do not trust staging only.
  const packed = JSON.parse(call('npm', [
    'pack', staging, '--json', '--pack-destination', scratch, '--ignore-scripts',
  ], scratch))[0];
  const packedFiles = new Set(packed.files.map((item) => item.path));
  for (const required of ['package.json', 'dist/index.js', 'dist/index.d.ts',
    'dist/button.js', 'dist/theme.js',
    'dist/primitives/Button/index.d.ts', 'dist/theme/index.d.ts']) {
    if (!packedFiles.has(required)) throw new Error('Packed candidate missing ' + required);
  }
  const candidateTgz = path.join(scratch, packed.filename);
  evidence.candidate = {
    fileCount: packed.files.length, tarballBytes: fs.statSync(candidateTgz).size,
    sha256: hash(fs.readFileSync(candidateTgz)),
    rootJsSha256: hash(rootJs), rootTypesSha256: hash(rootType),
    exports: originalManifest.exports,
  };

  for (const spec of specs) {
    const consumer = path.join(scratch, 'consumer-' + spec.name);
    fs.mkdirSync(consumer);
    write(consumer, 'package.json', JSON.stringify({
      name: 'vellira-native-packed-consumer-' + spec.name,
      version: '0.0.0', private: true, main: 'index.js',
      dependencies: {
        '@vellira-ui/react-native': 'file:' + candidateTgz,
        expo: '57.0.31', '@expo/metro-runtime': '57.0.17',
        react: '19.2.3', 'react-native': '0.86.3', 'react-native-svg': '15.15.4',
      },
      devDependencies: { typescript: '6.0.3', '@types/react': '19.2.4' },
    }, null, 2));
    write(consumer, 'app.json', JSON.stringify({ expo: {
      name: 'Vellira packed consumer', slug: 'vellira-packed-' + spec.name,
      version: '1.0.0', platforms: ['ios', 'android'],
    } }));
    write(consumer, 'index.js', [
      "import { registerRootComponent } from 'expo';",
      "import App from './App';",
      'registerRootComponent(App);', '',
    ].join('\n'));
    const moduleName = '@vellira-ui/react-native' +
      (spec.exportKey === '.' ? '' : spec.exportKey.slice(1));
    const markup = spec.symbol === 'ThemeProvider'
      ? "React.createElement(ThemeProvider, null, React.createElement(Text, null, 'Theme'))"
      : "React.createElement(Button, null, 'Button')";
    write(consumer, 'App.tsx', [
      "import React from 'react';",
      "import { Text } from 'react-native';",
      "import { " + spec.symbol + " } from '" + moduleName + "';",
      'export default function App() { return ' + markup + '; }', '',
    ].join('\n'));
    write(consumer, 'tsconfig.json', JSON.stringify({
      extends: 'expo/tsconfig.base',
      compilerOptions: { strict: true, skipLibCheck: true },
      include: ['App.tsx'],
    }, null, 2));
    call('npm', ['install', '--legacy-peer-deps', '--no-audit', '--no-fund'], consumer);
    const installed = path.join(consumer, 'node_modules/@vellira-ui/react-native');
    const installedManifest = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
    if (JSON.stringify(installedManifest.exports['.']) !== originalRootExport) {
      throw new Error('Installed root export differs from published package');
    }
    if (hash(fs.readFileSync(path.join(installed, 'dist/index.js'))) !== hash(rootJs)) {
      throw new Error('Installed canonical root JS differs from published package');
    }
    if (hash(fs.readFileSync(path.join(installed, 'dist/index.d.ts'))) !== hash(rootType)) {
      throw new Error('Installed canonical declaration differs from published package');
    }
    if (fs.existsSync(path.join(consumer, 'node_modules/@react-native-picker/picker'))) {
      throw new Error('Unexpected auto-installed picker');
    }
    call(process.execPath, [
      path.join(consumer, 'node_modules/typescript/bin/tsc'),
      '--project', 'tsconfig.json', '--noEmit',
    ], consumer);
    const platforms = {};
    for (const platform of ['ios', 'android']) {
      const out = path.join(consumer, 'dist-' + platform);
      call(process.execPath, [
        path.join(consumer, 'node_modules/expo/bin/cli'),
        'export', '--platform', platform, '--output-dir', out,
      ], consumer);
      const bundles = walk(out).filter((file) => /\.(?:js|hbc)$/.test(file));
      if (!bundles.length) throw new Error(spec.name + '/' + platform + ': no bundle');
      platforms[platform] = {
        scriptBytes: bundles.reduce((n, file) => n + fs.statSync(file).size, 0),
        scriptCount: bundles.length,
      };
    }
    evidence.consumers[spec.name] = { import: moduleName, typecheck: true, platforms };
    console.log('[native-subpath-tgz]', spec.name, JSON.stringify(platforms));
  }
  for (const platform of ['ios', 'android']) {
    for (const spec of ['button', 'theme']) {
      evidence.consumers[spec].platforms[platform].savedFromRoot =
        evidence.consumers.root.platforms[platform].scriptBytes -
        evidence.consumers[spec].platforms[platform].scriptBytes;
    }
  }
  const output = path.resolve(process.env.VELLIRA_PACKED_SUBPATH_EVIDENCE ??
    'consumer-evidence/native-packed-subpath.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log('[native-subpath-tgz] evidence:', output);
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
