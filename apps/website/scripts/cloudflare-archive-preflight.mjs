import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  readDeploymentConfig,
  validateDeploymentTarget,
} from './cloudflare-target-config.mjs';
import { withRemoteArchive } from './cloudflare-archive-client.mjs';
import { requireArchivedDeployment } from './cloudflare-static-asset-archive.mjs';

// Read-only prerequisite check. No build outputs, archive writes, activation
// seal, or deployment are needed. The deploy-time archive gate remains mandatory:
// this early check is not authority to activate hours later.
export async function preflightArchive(
  config,
  base,
  {
    accountId = process.env.CLOUDFLARE_ACCOUNT_ID,
    fetchImpl = fetch,
    openArchive = withRemoteArchive,
    log = console.log,
  } = {}
) {
  validateDeploymentTarget(config);
  assert.match(
    accountId ?? '',
    /^[a-f0-9]{32}$/,
    'CLOUDFLARE_ACCOUNT_ID must explicitly select the deployment account'
  );
  if (config.account_id)
    assert.equal(
      config.account_id,
      accountId,
      'Configured and requested Cloudflare accounts differ'
    );
  const origin = new URL(base);
  assert.equal(
    origin.origin,
    `https://${config.name}.vellira.workers.dev`,
    'Preflight origin must match the target Worker'
  );
  assert.ok(
    !origin.username && !origin.password,
    'Preflight origin must not contain credentials'
  );
  const bucketName = config.r2_buckets.find(
    (binding) => binding.binding === 'STATIC_ASSET_ARCHIVE'
  ).bucket_name;
  const context = { accountId, worker: config.name, bucket: bucketName };
  log(JSON.stringify({ event: 'archive-preflight-start', ...context }));
  const url = new URL('/BUILD_ID', origin);
  url.searchParams.set('archive-preflight', randomUUID());
  const response = await fetchImpl(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(
    response.status,
    200,
    'Cannot identify active deployment; archive preflight is blocked'
  );
  const previousBuildId = (await response.text()).trim();
  assert.match(previousBuildId, /^[a-zA-Z0-9_-]+$/, 'Invalid active BUILD_ID');
  const evidence = { ...context, previousBuildId };
  log(JSON.stringify({ event: 'archive-preflight-predecessor', ...evidence }));
  await openArchive({ ...config, account_id: accountId }, async (bucket) => {
    // A successful binding read distinguishes accessible storage from a missing
    // predecessor manifest. The existing gate also verifies every object's bytes
    // and metadata, rather than accepting the mere presence of a manifest.
    await bucket.head(`deployments/${previousBuildId}.json`);
    log(
      JSON.stringify({
        event: 'archive-preflight-storage-readable',
        ...evidence,
      })
    );
    await requireArchivedDeployment(bucket, previousBuildId);
  });
  log(JSON.stringify({ event: 'archive-preflight-passed', ...evidence }));
  return evidence;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const config = readDeploymentConfig(
    path.resolve(import.meta.dirname, '..', process.argv[2] ?? 'wrangler.jsonc')
  );
  assert.ok(
    process.env.WEBSITE_URL,
    'WEBSITE_URL is required for archive preflight'
  );
  await preflightArchive(config, process.env.WEBSITE_URL);
}
