#!/usr/bin/env node
// #1906: opt-in staged build only; no changes to publishable exports/files.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const pkg = path.join(repo, 'packages/react-native');
const dist = path.join(pkg, 'dist');
const root = path.join(dist, 'index.js');
const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8'));
if (Object.keys(manifest.exports ?? {}).join(',') !== '.') {
  throw new Error('The opt-in build requires the current root-only public exports');
}
if (!fs.existsSync(root) || !fs.existsSync(path.join(dist, 'index.d.ts'))) {
  throw new Error('Build the canonical react-native package first');
}
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const original = hash(root);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-native-entry-build-'));
const entries = [
  { name: 'button', src: 'src/primitives/Button/index.ts', types: 'primitives/Button/index.d.ts' },
  { name: 'theme', src: 'src/theme/index.ts', types: 'theme/index.d.ts' },
];
function run(args, cwd) {
  const p = spawnSync('pnpm', args, { cwd, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
  if (p.error || p.status !== 0) {
    throw new Error([p.error?.message, p.stdout, p.stderr].filter(Boolean).join('\n'));
  }
}
try {
  const staged = [];
  for (const entry of entries) {
    if (!fs.existsSync(path.join(dist, entry.types))) {
      throw new Error('Missing canonical declaration: ' + entry.types);
    }
    const output = path.join(scratch, entry.name);
    run(['exec', 'tsdown', entry.src, '--config', 'tsdown.config.ts', '--out-dir', output], pkg);
    const candidates = fs.readdirSync(output).filter(f => /\.(?:js|mjs)$/.test(f));
    if (candidates.length !== 1) throw new Error('Unexpected output for ' + entry.name);
    staged.push({ name: entry.name, source: path.join(output, candidates[0]) });
  }
  if (hash(root) !== original) throw new Error('Canonical root changed during isolated builds');
  for (const item of staged) {
    fs.copyFileSync(item.source, path.join(dist, item.name + '.js'));
  }
  if (hash(root) !== original) throw new Error('Canonical root changed after staging');
  console.log('[native-subpath-optin] root integrity preserved', original);
  for (const item of staged) {
    console.log('[native-subpath-optin]', item.name,
      fs.statSync(path.join(dist, item.name + '.js')).size);
  }
  console.log('[native-subpath-optin] staged only; not exported or included in publish allowlist');
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
