import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readDeploymentConfig } from './cloudflare-target-config.mjs';
import { withRemoteArchive } from './cloudflare-archive-client.mjs';
import {
  archiveAssets,
  assetInventory,
  recordArchivedDeployment,
} from './cloudflare-static-asset-archive.mjs';

// Explicit backfill only: no build, traffic activation, URL discovery, deletion,
// or reconstruction of missing historical bytes from a newer build.
const [configArgument, assetsArgument, expectedBuildId] = process.argv.slice(2);
assert.ok(
  configArgument && assetsArgument && expectedBuildId,
  'Usage: node cloudflare-archive-backfill.mjs <wrangler config> <original .open-next/assets directory> <expected BUILD_ID>'
);
const config = readDeploymentConfig(path.resolve(configArgument));
const assetsRoot = path.resolve(assetsArgument);
assert.equal(
  (await fs.readFile(path.join(assetsRoot, 'BUILD_ID'), 'utf8')).trim(),
  expectedBuildId
);
const inventory = await assetInventory(path.join(assetsRoot, '_next/static'));
await withRemoteArchive(config, async (bucket, bucketName) => {
  const assets = await archiveAssets(bucket, inventory);
  await recordArchivedDeployment(bucket, expectedBuildId, assets);
  console.log(
    JSON.stringify({
      buildId: expectedBuildId,
      bucket: bucketName,
      verifiedAssets: assets.length,
      activated: false,
    })
  );
});
