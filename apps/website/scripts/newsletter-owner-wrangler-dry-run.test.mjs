import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const website = path.resolve(import.meta.dirname, '..');
const ownerConfig = path.join(
  website,
  'cloudflare/newsletter-budget-owner.wrangler.candidate.jsonc'
);
const deployedConfigs = ['wrangler.jsonc', 'wrangler.production.jsonc'];

function javascriptFiles(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...javascriptFiles(absolute));
    else if (entry.isFile() && /\.(?:mjs|js)$/.test(entry.name)) {
      result.push(absolute);
    }
  }
  return result;
}

test('pinned Wrangler compiles owner candidate without deployment or credentials', (t) => {
  // The workspace installs binaries through pnpm; per-package .bin paths
  // are not guaranteed to exist in CI's filtered install layout.
  const config = JSON.parse(fs.readFileSync(ownerConfig, 'utf8'));
  assert.equal(config.name, 'vellira-newsletter-budget-owner');
  assert.equal(config.workers_dev, false);
  assert.equal(config.main, './newsletter-budget-owner-worker.mjs');
  assert.deepEqual(config.exports, {
    NewsletterRollingBudgetCoordinator: {
      type: 'durable-object',
      storage: 'sqlite',
    },
  });

  // Never infer remote safety from a config name alone.
  for (const forbidden of [
    'routes',
    'route',
    'account_id',
    'env',
    'vars',
    'secrets',
    'triggers',
    'durable_objects',
    'migrations',
  ]) {
    assert.equal(config[forbidden], undefined, forbidden);
  }

  const originals = [ownerConfig, ...deployedConfigs.map((name) => path.join(website, name))]
    .map((file) => ({ file, contents: fs.readFileSync(file, 'utf8') }));

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-owner-dryrun-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const outdir = path.join(scratch, 'bundle');

  // Fixed arguments only: never use --temporary or invoke a deployment.
  // Do not inherit Cloudflare credentials, Buttondown keys or GH tokens.
  const args = [
    'exec',
    'wrangler',
    'deploy',
    '--config',
    ownerConfig,
    '--dry-run',
    '--outdir',
    outdir,
  ];
  assert.ok(args.includes('--dry-run'));
  assert.ok(!args.includes('--temporary'));
  const result = spawnSync('pnpm', args, {
    cwd: website,
    encoding: 'utf8',
    timeout: 90_000,
    maxBuffer: 1024 * 1024,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: scratch,
      XDG_CONFIG_HOME: scratch,
      CI: 'true',
      WRANGLER_SEND_METRICS: 'false',
      HTTP_PROXY: 'http://127.0.0.1:9',
      HTTPS_PROXY: 'http://127.0.0.1:9',
      ALL_PROXY: 'http://127.0.0.1:9',
      NO_PROXY: 'localhost,127.0.0.1',
    },
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    'Pinned Wrangler dry-run failed: ' + (result.stderr || result.stdout).slice(-2200)
  );

  const files = javascriptFiles(outdir);
  assert.ok(files.length > 0, 'Wrangler dry-run emitted no JavaScript bundle');
  const bundle = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.match(bundle, /NewsletterRollingBudgetCoordinator/);
  assert.doesNotMatch(bundle, /BUTTONDOWN_API_KEY|api\.buttondown\.com/);

  // Dry-running the isolated owner must never rewrite live deployment configs.
  for (const { file, contents } of originals) {
    assert.equal(fs.readFileSync(file, 'utf8'), contents, file);
  }
});
