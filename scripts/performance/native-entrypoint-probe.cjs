#!/usr/bin/env node
// #1906: isolated packaging probe, never a replacement for Metro consumer proof.
// Uses the maintained tsdown config while redirecting outputs to temporary dirs.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const nativeDir = path.join(repo, 'packages/react-native');
const entries = {
  publicRoot: 'src/index.ts',
  buttonOnly: 'src/primitives/Button/index.ts',
  themeOnly: 'src/theme/index.ts',
};
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-native-entrypoints-'));
const results = { schemaVersion: 1, issue: 1906, kind: 'isolated-tsdown-probe', variants: {} };

try {
  for (const [name, entry] of Object.entries(entries)) {
    const out = path.join(scratch, name);
    const cmd = spawnSync('pnpm', [
      'exec', 'tsdown', entry,
      '--config', 'tsdown.config.ts',
      '--out-dir', out,
    ], {
      cwd: nativeDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (cmd.error || cmd.status !== 0) {
      throw new Error(name + ' tsdown failed: ' + (cmd.error?.message ?? cmd.stderr));
    }
    const files = fs.readdirSync(out, { withFileTypes: true })
      .filter((item) => item.isFile())
      .map((item) => ({ file: item.name, bytes: fs.statSync(path.join(out, item.name)).size }));
    const js = files.filter(({ file }) => /\.(?:js|mjs|cjs)$/.test(file));
    if (!js.length) throw new Error(name + ': no output JavaScript');
    results.variants[name] = {
      entry,
      files,
      javascriptBytes: js.reduce((sum, file) => sum + file.bytes, 0),
    };
    console.log('[native-entrypoint-probe]', name, results.variants[name].javascriptBytes);
  }
  results.ratios = {
    buttonVsPublic: results.variants.buttonOnly.javascriptBytes / results.variants.publicRoot.javascriptBytes,
    themeVsPublic: results.variants.themeOnly.javascriptBytes / results.variants.publicRoot.javascriptBytes,
  };
  const target = path.resolve(process.env.VELLIRA_ENTRYPOINT_EVIDENCE ??
    'consumer-evidence/native-entrypoint-probe.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(results, null, 2) + '\n');
  console.log('[native-entrypoint-probe] evidence:', target);
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
