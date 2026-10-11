import assert from 'node:assert/strict';
import { prepareRouteCache } from './cloudflare-route-cache.mjs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const localWorkerName = 'vellira-local-cache';

export function createLocalCacheConfig(source) {
  const config = structuredClone(source);
  assert.ok(config && typeof config === 'object' && !Array.isArray(config));
  assert.ok(
    !config.env || Object.keys(config.env).length === 0,
    'Local cache preparation does not accept environment overlays'
  );
  // Local preparation must not opt into remote bindings through a future config.
  function rejectRemote(value) {
    if (!value || typeof value !== 'object') return;
    assert.notEqual(
      value.remote,
      true,
      'Local cache preparation forbids remote bindings'
    );
    for (const child of Object.values(value)) rejectRemote(child);
  }
  rejectRemote(config);

  // Derive a local-only projection; never edit either deployment configuration.
  // An explicit empty list also prevents Wrangler from loading .dev.vars keys.
  config.name = localWorkerName;
  config.secrets = { required: [] };
  config.routes = [];
  config.workers_dev = false;
  config.preview_urls = false;
  delete config.route;
  delete config.account_id;
  delete config.env;
  return config;
}

export async function withLocalCacheConfig(configPath, action) {
  const sourcePath = path.resolve(root, configPath);
  const { experimental_readRawConfig } = await import('wrangler');
  const { readDeploymentConfig } =
    await import('./cloudflare-target-config.mjs');
  // Validate the real target first. The projection's name is deliberately not
  // accepted by this same guard, so it cannot enter the guarded deployment path.
  readDeploymentConfig(sourcePath);
  const { rawConfig, configPath: resolvedPath } = experimental_readRawConfig({
    config: sourcePath,
  });
  assert.equal(
    path.resolve(resolvedPath),
    sourcePath,
    'Unexpected Wrangler config redirection'
  );
  const localPath = path.join(
    path.dirname(sourcePath),
    `.wrangler-local-cache-${randomUUID()}.jsonc`
  );
  // A sibling file preserves every relative path in the canonical JSONC config.
  await fs.writeFile(
    localPath,
    `${JSON.stringify(createLocalCacheConfig(rawConfig), null, 2)}\n`,
    {
      flag: 'wx',
      mode: 0o600,
    }
  );
  try {
    return await action(localPath);
  } finally {
    await fs.rm(localPath, { force: true });
  }
}

export async function populateLocalCache(
  configPath = 'wrangler.jsonc',
  { env = process.env, execute = spawnSync } = {}
) {
  return withLocalCacheConfig(configPath, (localPath) => {
    prepareRouteCache(path.dirname(path.resolve(root, configPath)));
    // Only local preparation is exposed; no arbitrary command/flag passthrough.
    const args = [
      'exec',
      'opennextjs-cloudflare',
      'populateCache',
      'local',
      `--config=${localPath}`,
    ];
    const result = execute('pnpm', args, { cwd: root, env, stdio: 'inherit' });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, 'Local OpenNext cache preparation failed');
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  assert.ok(
    args.length <= 1 &&
      (!args.length ||
        ['wrangler.jsonc', 'wrangler.production.jsonc'].includes(args[0])),
    'Expected only a canonical Wrangler config filename; remote commands and flags are forbidden'
  );
  await populateLocalCache(args[0]);
}
