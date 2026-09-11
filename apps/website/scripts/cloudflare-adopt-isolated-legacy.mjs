import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { deploymentIdentity } from '../cloudflare/build-identity.mjs';
import {
  assetInventory,
  archiveAssets,
  recordArchivedDeployment,
  requireArchivedDeployment,
  sha256,
} from './cloudflare-static-asset-archive.mjs';
import {
  LEGACY,
  ADOPTION_KEY,
  BASELINE,
  assertAdoptionContext,
  assertLegacy,
  assertIsolation,
  readIsolation,
  jsonGet,
  assertGreenMain,
} from './cloudflare-legacy-adoption-control.mjs';

export async function requireEmptyAdoptionBucket(bucket) {
  const listing = await bucket.list({ limit: 1 });
  assert.deepEqual(
    listing.objects,
    [],
    'Adoption requires a pristine empty archive; do not retry or erase evidence'
  );
  assert.equal(listing.truncated, false, 'Incomplete archive listing');
}

async function requireExactKeys(bucket, keys) {
  const actual = [];
  let cursor;
  const seen = new Set();
  do {
    const page = await bucket.list({
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });
    assert.ok(Array.isArray(page.objects));
    actual.push(...page.objects.map((object) => object.key));
    if (!page.truncated) break;
    assert.ok(
      page.cursor && !seen.has(page.cursor),
      'Archive pagination did not advance'
    );
    seen.add(page.cursor);
    cursor = page.cursor;
  } while (cursor);
  assert.deepEqual(
    actual.sort(),
    [...keys].sort(),
    'Dirty or incomplete adoption archive'
  );
}

async function createEvidence(bucket, key, record) {
  const body = JSON.stringify(record);
  const created = await bucket.put(key, body, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'application/json' },
    customMetadata: { sha256: sha256(body) },
  });
  assert.ok(created, 'One-time adoption evidence already exists');
  const stored = await bucket.get(key);
  assert.ok(stored);
  assert.equal(
    await stored.text(),
    body,
    'Adoption evidence read-back mismatch'
  );
  assert.equal(stored.customMetadata?.sha256, sha256(body));
  assert.equal(stored.httpMetadata?.contentType, 'application/json');
  return body;
}

const withoutFilename = (inventory) =>
  inventory.map((asset) =>
    Object.fromEntries(
      Object.entries(asset).filter(([key]) => key !== 'filename')
    )
  );

export async function completeCandidateInventory(root) {
  const next = await assetInventory(path.join(root, '.next/static'));
  const deployed = await assetInventory(
    path.join(root, '.open-next/assets/_next/static')
  );
  assert.deepEqual(
    withoutFilename(deployed),
    withoutFilename(next),
    'New candidate static graph differs from the complete Next output'
  );
  return deployed;
}

// This is an identity-locked adoption transaction, not a mode of normal deploy.
// Only the CLI below binds these operations to the real production target.
export async function adoptIsolatedLegacy({
  config,
  env,
  bucket,
  checkLegacy,
  prepareCandidate,
  verifyCandidate,
  dryRun,
  activate,
  postflight,
}) {
  assertAdoptionContext(config, env);
  const before = await checkLegacy();
  assertLegacy(before.snapshot);
  await requireEmptyAdoptionBucket(bucket);
  const { identity, inventory } = await prepareCandidate();
  assert.equal(
    identity.buildId,
    deploymentIdentity({ ...env, VELLIRA_DEPLOYABLE: '1' })
  );
  assert.notEqual(identity.buildId, LEGACY.buildId);
  assert.ok(inventory.length, 'Empty candidate graph');
  const record = {
    schema: 'vellira-isolated-legacy-adoption-v1',
    status: 'authorized-attempt-not-activation-proof',
    at: new Date().toISOString(),
    legacy: LEGACY,
    reason:
      'Original GitHub run has no saved assets artifact; Cloudflare read-only APIs expose no authoritative complete Static Assets path inventory. No rebuild or partial reconstruction accepted.',
    historicalNonAttachment: {
      neverAttachedToPublicVelliraDev: true,
      basis:
        'Explicit operator attestation; current API isolation is separately checked, not proof of all historical route states.',
      statement: env.ADOPTION_NEVER_PUBLIC,
      actor: env.GITHUB_ACTOR,
    },
    exception:
      'Old workers.dev tabs for the legacy BUILD_ID are not guaranteed after adoption.',
    candidate: {
      ...identity,
      sourceCommit: env.GITHUB_SHA,
      runId: env.GITHUB_RUN_ID,
      runAttempt: env.GITHUB_RUN_ATTEMPT,
    },
    before,
  };
  // Atomic, single-use claim. Never a deployments/<legacy BUILD_ID>.json record.
  const evidenceBody = await createEvidence(bucket, ADOPTION_KEY, record);
  const assets = await archiveAssets(bucket, inventory);
  await recordArchivedDeployment(bucket, identity.buildId, assets);
  await requireArchivedDeployment(bucket, identity.buildId);
  const keys = [
    ADOPTION_KEY,
    `deployments/${identity.buildId}.json`,
    ...assets.map((asset) => asset.key),
  ];
  await requireExactKeys(bucket, keys);
  await dryRun({ identity, assets });
  // Dry run, a slow upload, or an out-of-band publisher must not stale the gates.
  assert.deepEqual(
    withoutFilename(await verifyCandidate()),
    assets,
    'Candidate changed before activation'
  );
  await requireArchivedDeployment(bucket, identity.buildId);
  await requireExactKeys(bucket, keys);
  assert.equal(await (await bucket.get(ADOPTION_KEY)).text(), evidenceBody);
  const immediatelyBefore = await checkLegacy();
  assertLegacy(immediatelyBefore.snapshot);
  await activate();
  const after = await postflight(identity);
  assertIsolation(after.snapshot);
  assert.equal(after.snapshot.buildId, identity.buildId);
  assert.notEqual(
    after.snapshot.deployment.versions[0].version_id,
    LEGACY.version
  );
  await requireArchivedDeployment(bucket, identity.buildId);
  await requireExactKeys(bucket, keys);
  await createEvidence(
    bucket,
    `adoption-completions/isolated-${LEGACY.version}.json`,
    {
      schema: 'vellira-isolated-legacy-adoption-completion-v1',
      adoptionKey: ADOPTION_KEY,
      candidateBuildId: identity.buildId,
      immediatelyBefore,
      after,
      at: new Date().toISOString(),
    }
  );
  return { identity, assets, before, immediatelyBefore, after };
}

async function main() {
  const mode = process.argv[2];
  assert.ok(
    ['preflight', 'adopt'].includes(mode) && process.argv.length === 3,
    'Usage: cloudflare-adopt-isolated-legacy.mjs preflight|adopt (dedicated main workflow only)'
  );
  const root = path.resolve(import.meta.dirname, '..');
  const seal = path.join(root, '.open-next/vellira-build.json');
  if (mode === 'adopt') await fs.rm(seal, { force: true });
  const repository = path.resolve(root, '../..');
  const configPath = path.join(root, 'wrangler.production.jsonc');
  const { readDeploymentConfig } =
    await import('./cloudflare-target-config.mjs');
  const config = readDeploymentConfig(configPath);
  const env = process.env;
  assertAdoptionContext(config, env);
  const command = (program, args, cwd = root, extraEnv = {}) =>
    execFileSync(program, args, {
      cwd,
      env: { ...env, ...extraEnv },
      stdio: 'inherit',
    });
  const git = (...args) =>
    execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
  const cf = (p) =>
    jsonGet(
      'https://api.cloudflare.com',
      `/client/v4${p}`,
      env.CLOUDFLARE_API_TOKEN
    );
  const github = (p) => jsonGet('https://api.github.com', p, env.GH_TOKEN);
  const checkLegacy = async () => {
    assert.equal(git('rev-parse', 'HEAD'), env.GITHUB_SHA);
    assert.equal(
      git('status', '--porcelain', '--untracked-files=no'),
      '',
      'Dirty checkout'
    );
    git('merge-base', '--is-ancestor', BASELINE, 'HEAD');
    const ci = await assertGreenMain(github, env.GITHUB_SHA);
    const bucketInfo = (
      await cf(`/accounts/${LEGACY.accountId}/r2/buckets/${LEGACY.bucket}`)
    ).result;
    assert.equal(
      bucketInfo?.name,
      LEGACY.bucket,
      'Required production R2 bucket missing'
    );
    assert.equal(
      bucketInfo.storage_class,
      'Standard',
      'Production archive must use Standard storage'
    );
    const snapshot = await readIsolation(cf);
    assertLegacy(snapshot);
    return { ci, snapshot };
  };
  const { withRemoteArchive } = await import('./cloudflare-archive-client.mjs');
  // No automatic bucket provisioning; explicit account and existence GET first.
  const before = await checkLegacy();
  if (mode === 'preflight') {
    await withRemoteArchive(config, requireEmptyAdoptionBucket);
    console.log(
      JSON.stringify({
        event: 'isolated-legacy-adoption-preflight-passed',
        before,
      })
    );
    return;
  }
  try {
    const { prepareDeployment } =
      await import('./cloudflare-prepare-deployment.mjs');
    const { preflightArchive } =
      await import('./cloudflare-archive-preflight.mjs');
    await withRemoteArchive(config, async (bucket) => {
      const result = await adoptIsolatedLegacy({
        config,
        env,
        bucket,
        checkLegacy,
        prepareCandidate: async () => {
          command('pnpm', [
            'exec',
            'opennextjs-cloudflare',
            'populateCache',
            'local',
            `--config=${configPath}`,
          ]);
          return {
            identity: prepareDeployment(root),
            inventory: await completeCandidateInventory(root),
          };
        },
        verifyCandidate: () => completeCandidateInventory(root),
        dryRun: async ({ identity, assets }) => {
          await fs.writeFile(
            path.join(root, '.open-next/archive-evidence.json'),
            JSON.stringify({
              ...identity,
              previousBuildId: LEGACY.buildId,
              bucket: LEGACY.bucket,
              assets,
              adoptionKey: ADOPTION_KEY,
            })
          );
          await fs.writeFile(seal, JSON.stringify(identity));
          command(
            'pnpm',
            [
              'exec',
              'wrangler',
              'deploy',
              '--dry-run',
              `--config=${configPath}`,
            ],
            root,
            { OPEN_NEXT_DEPLOY: 'true' }
          );
        },
        activate: async () => {
          command(
            'pnpm',
            ['exec', 'wrangler', 'deploy', `--config=${configPath}`],
            root,
            { OPEN_NEXT_DEPLOY: 'true' }
          );
        },
        postflight: async (identity) => {
          const snapshot = await readIsolation(cf);
          assert.equal(
            snapshot.buildId,
            identity.buildId,
            'New deployment is not active'
          );
          // Public endpoint: never forward a control-plane credential.
          const runtimeResponse = await fetch(
            `${LEGACY.origin}/__vellira_runtime?adoption=${encodeURIComponent(identity.buildId)}`,
            {
              cache: 'no-store',
              redirect: 'error',
              headers: { Accept: 'application/json' },
              signal: AbortSignal.timeout(30_000),
            }
          );
          assert.equal(runtimeResponse.status, 200);
          const runtime = await runtimeResponse.json();
          assert.equal(runtime.buildId, identity.buildId);
          assert.equal(
            runtime.workerVersion,
            snapshot.deployment.versions[0].version_id,
            'Runtime and control-plane Worker versions differ'
          );
          command(process.execPath, [
            'scripts/cloudflare-runtime-contract.mjs',
          ]);
          const standard = await preflightArchive(config, LEGACY.origin, {
            openArchive: async (_config, operation) =>
              operation(bucket, LEGACY.bucket),
          });
          assert.equal(standard.previousBuildId, identity.buildId);
          return { snapshot, runtime, standardPreflight: standard };
        },
      });
      await fs.writeFile(
        path.join(root, '.open-next/legacy-adoption-result.json'),
        JSON.stringify(result, null, 2)
      );
      console.log(
        JSON.stringify({
          event: 'isolated-legacy-adoption-complete',
          buildId: result.identity.buildId,
        })
      );
    });
  } finally {
    // No stale local activation seal after any failed or successful attempt.
    await fs.rm(seal, { force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  await main();
