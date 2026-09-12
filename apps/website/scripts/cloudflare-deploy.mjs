import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readDeploymentConfig } from './cloudflare-target-config.mjs';
import { withRemoteArchive } from './cloudflare-archive-client.mjs';
import { prepareDeployment } from './cloudflare-prepare-deployment.mjs';
import { waitForRuntimeStability } from './cloudflare-runtime-stabilization.mjs';
import {
  archiveAssets,
  assetInventory,
  recordArchivedDeployment,
  requireArchivedDeployment,
} from './cloudflare-static-asset-archive.mjs';

const root = path.resolve(import.meta.dirname, '..');
// Invalidate an earlier activation seal even if config/cache population fails.
await fs.rm(path.join(root, '.open-next/vellira-build.json'), { force: true });
const configPath = path.resolve(root, process.argv[2] ?? 'wrangler.jsonc');
const config = readDeploymentConfig(configPath);

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed`);
}

// Populate OpenNext's read-only route assets before auditing the final graph.
// Activation uses Wrangler directly so no further OpenNext mutation can occur
// after the archive/closure gate. Experimental skew mapping is intentionally absent.
run('pnpm', [
  'exec',
  'opennextjs-cloudflare',
  'populateCache',
  'local',
  `--config=${configPath}`,
]);
const identity = prepareDeployment(root);
const inventory = await assetInventory(
  path.join(root, '.open-next/assets/_next/static')
);
const base = process.env.WEBSITE_URL;
assert.ok(base, 'WEBSITE_URL is required to verify the active predecessor');
assert.equal(
  new URL(base).hostname,
  `${config.name}.vellira.workers.dev`,
  'Deployment origin must match the target Worker'
);
assert.equal(new URL(base).protocol, 'https:');
const previous = await fetch(new URL('/BUILD_ID', base), { cache: 'no-store' });
assert.equal(
  previous.status,
  200,
  'Cannot identify the active deployment; activation is blocked'
);
const previousBuildId = (await previous.text()).trim();
await withRemoteArchive(config, async (bucket, bucketName) => {
  // Adoption must not orphan the current live graph. Historical backfill is an
  // explicit archive-only operation, not a silent best-effort migration.
  await requireArchivedDeployment(bucket, previousBuildId);
  const assets = await archiveAssets(bucket, inventory);
  await recordArchivedDeployment(bucket, identity.buildId, assets);
  await fs.writeFile(
    path.join(root, '.open-next/archive-evidence.json'),
    JSON.stringify(
      { ...identity, previousBuildId, bucket: bucketName, assets },
      null,
      2
    )
  );
  // Missing/failed archive verification leaves no seal for the Worker import.
  await fs.writeFile(
    path.join(root, '.open-next/vellira-build.json'),
    JSON.stringify(identity)
  );
});
// Dry run is another blocking gate before changing traffic.
run(
  'pnpm',
  ['exec', 'wrangler', 'deploy', '--dry-run', `--config=${configPath}`],
  { ...process.env, OPEN_NEXT_DEPLOY: 'true' }
);
run('pnpm', ['exec', 'wrangler', 'deploy', `--config=${configPath}`], {
  ...process.env,
  OPEN_NEXT_DEPLOY: 'true',
});
// Cloudflare activation can propagate briefly across edges. Do not start strict
// postflight checks until several uncached runtime executions agree on both the
// unique build identity and one Worker version.
await waitForRuntimeStability({
  base,
  expectedBuildId: identity.buildId,
});
