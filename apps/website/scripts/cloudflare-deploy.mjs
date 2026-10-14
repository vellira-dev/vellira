import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readDeploymentConfig } from './cloudflare-target-config.mjs';
import { withRemoteArchive } from './cloudflare-archive-client.mjs';
import { prepareDeployment } from './cloudflare-prepare-deployment.mjs';
import { populateLocalCache } from './cloudflare-populate-local-cache.mjs';
import { assertFreshProductionCandidate, ProductionCandidateSupersededError } from './cloudflare-production-freshness.mjs';
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
const { GITHUB_TOKEN: githubToken, ...childProcessEnv } = process.env;
const freshnessContext = {
  configPath,
  candidateSource: process.env.CANDIDATE_SOURCE,
  candidateSha: process.env.CANDIDATE_SHA,
  githubToken,
  cwd: root,
};

function run(command, args, env = childProcessEnv) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed`);
}

async function deploy() {
// Populate OpenNext's read-only route assets before auditing the final graph.
// Activation uses Wrangler directly so no further OpenNext mutation can occur
// after the archive/closure gate. Experimental skew mapping is intentionally absent.
await populateLocalCache(configPath, { env: childProcessEnv });
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
await assertFreshProductionCandidate(freshnessContext);
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
  { ...childProcessEnv, OPEN_NEXT_DEPLOY: 'true' }
);
await assertFreshProductionCandidate(freshnessContext);
run('pnpm', ['exec', 'wrangler', 'deploy', `--config=${configPath}`], {
  ...childProcessEnv,
  OPEN_NEXT_DEPLOY: 'true',
});
// Cloudflare activation can propagate briefly across edges. Do not start strict
// postflight checks until several uncached runtime executions agree on both the
// unique build identity and one Worker version.
await waitForRuntimeStability({
  base,
  expectedBuildId: identity.buildId,
});

}

try {
  await deploy();
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, 'superseded=false\n');
  }
} catch (error) {
  if (!(error instanceof ProductionCandidateSupersededError) || process.env.CANDIDATE_SOURCE !== 'staging') {
    throw error;
  }
  // A stale staging candidate must not activate the Worker. All other errors fail closed.
  console.log('::notice::' + error.message);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, 'superseded=true\n');
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      '### SUPERSEDED — production safely skipped\n\n' + error.message +
      '\n\nNo Cloudflare Worker activation occurred. A newer staging-qualified candidate is required.\n');
  }
}
