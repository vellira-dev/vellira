#!/usr/bin/env node
// Non-publishing shared-chunk tarball inventory probe for #1906.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { assertNativeSubpathContract } = require('../release-candidate/native-subpath-contract.cjs');

const repo = path.resolve(__dirname, '../..');
const pkg = path.join(repo, 'packages/react-native');
const shared = path.join(pkg, 'dist/shared-proof');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-shared-tarball-'));
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error([command, ...args, result.error?.message,
      result.stdout, result.stderr].filter(Boolean).join('\n').slice(-12000));
  }
  return result.stdout;
}
try {
  const files = fs.readdirSync(shared).filter(file => file.endsWith('.js'));
  for (const required of ['index.js', 'button.js', 'theme.js']) {
    if (!files.includes(required)) throw new Error('Missing shared entry ' + required);
  }
  const packedSource = path.join(scratch, 'source');
  fs.mkdirSync(packedSource);
  run('pnpm', ['--filter', '@vellira-ui/react-native', 'pack',
    '--pack-destination', packedSource], repo);
  const tarballs = fs.readdirSync(packedSource).filter(file => file.endsWith('.tgz'));
  if (tarballs.length !== 1) throw new Error('Expected one workspace package');
  const staging = path.join(scratch, 'staging');
  fs.mkdirSync(staging);
  run('tar', ['-xzf', path.join(packedSource, tarballs[0]), '-C',
    staging, '--strip-components=1'], repo);
  const manifestPath = path.join(staging, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (Object.keys(manifest.exports ?? {}).join(',') !== '.') {
    throw new Error('Source package already exposes subpaths');
  }
  for (const file of files) {
    fs.copyFileSync(path.join(shared, file), path.join(staging, 'dist', file));
  }
  // Root must originate from the SAME graph as Button and Theme.
  if (!fs.readFileSync(path.join(staging, 'dist/index.js')).equals(
    fs.readFileSync(path.join(shared, 'index.js')))) {
    throw new Error('Shared root entry was not staged');
  }
  manifest.files = [...new Set([...manifest.files, ...files.map(file => 'dist/' + file)])];
  manifest.exports['./button'] = {
    types: './dist/primitives/Button/index.d.ts',
    'react-native': './dist/button.js', import: './dist/button.js', default: './dist/button.js',
  };
  manifest.exports['./theme'] = {
    types: './dist/theme/index.d.ts',
    'react-native': './dist/theme.js', import: './dist/theme.js', default: './dist/theme.js',
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  if (!assertNativeSubpathContract(staging).enabled) throw new Error('Subpath contract disabled');
  const output = JSON.parse(run('npm', ['pack', staging, '--json',
    '--ignore-scripts', '--pack-destination', scratch], scratch))[0];
  const inventory = new Set(output.files.map(item => item.path));
  for (const file of files) {
    if (!inventory.has('dist/' + file)) throw new Error('Missing packed chunk ' + file);
  }
  for (const file of files) {
    const source = fs.readFileSync(path.join(staging, 'dist', file), 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g)) {
      const specifier = match[2];
      const target = path.posix.normalize(path.posix.join('dist', specifier));
      if (!inventory.has(target)) throw new Error('Unpacked chunk import ' + file + ' -> ' + target);
    }
  }
  const tarball = path.join(scratch, output.filename);
  const installed = path.join(scratch, 'installed');
  fs.mkdirSync(installed);
  run('tar', ['-xzf', tarball, '-C', installed, '--strip-components=1'], scratch);
  if (!assertNativeSubpathContract(installed).enabled) {
    throw new Error('Installed shared graph contract failed');
  }
  console.log('[shared-tarball] all', files.length, 'JS entries/chunks retained');
  console.log('[shared-tarball] packed bytes:', output.size);
  console.log('[shared-tarball] unpublished candidate; no npm release');
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
