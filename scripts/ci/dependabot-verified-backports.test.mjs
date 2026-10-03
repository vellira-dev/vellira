import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { filterVerifiedDependabotBackports } from './dependabot-verified-backports.mjs';

const patchPath = 'patches/node-forge@1.4.0.patch';
const patch = 'verified upstream patch\n';
const patchSha256 = createHash('sha256').update(patch).digest('hex');

function ledger() {
  return {
    schemaVersion: 1,
    backports: [
      {
        alertNumber: 93,
        package: 'node-forge',
        manifestPath: 'pnpm-lock.yaml',
        scope: 'runtime',
        ghsaId: 'GHSA-86w9-cpqp-85rv',
        version: '1.4.0',
        upstreamRepository: 'digitalbazaar/forge',
        upstreamPullRequest: 1152,
        upstreamCommit: 'c'.repeat(40),
        upstreamBaseBlob: 'a'.repeat(40),
        upstreamFixedBlob: 'b'.repeat(40),
        patchPath,
        patchSha256,
        removeWhen: 'patched release',
      },
    ],
  };
}

function alert(overrides = {}) {
  return {
    number: 93,
    dependency: {
      package: { name: 'node-forge' },
      manifest_path: 'pnpm-lock.yaml',
      scope: 'runtime',
    },
    security_advisory: {
      ghsa_id: 'GHSA-86w9-cpqp-85rv',
      severity: 'high',
    },
    ...overrides,
  };
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'vellira-backport-test-'));
  await mkdir(path.join(root, 'patches'), { recursive: true });
  await writeFile(path.join(root, patchPath), patch);
  await writeFile(
    path.join(root, 'pnpm-workspace.yaml'),
    `patchedDependencies:\n  'node-forge@1.4.0': ${patchPath}\n`
  );
  await writeFile(
    path.join(root, 'pnpm-lock.yaml'),
    [
      'patchedDependencies:',
      `  node-forge@1.4.0: ${patchSha256}`,
      '',
      `  node-forge@1.4.0(patch_hash=${patchSha256}): {}`,
      '',
    ].join('\n')
  );
  return root;
}

test('filters only an exact alert bound to a verified repository patch', async () => {
  const repositoryRoot = await fixture();
  const result = await filterVerifiedDependabotBackports({
    alerts: [alert()],
    ledger: ledger(),
    repositoryRoot,
  });

  assert.deepEqual(result.effectiveAlerts, []);
  assert.equal(result.verifiedBackports.length, 1);
  assert.equal(result.verifiedBackports[0].alertNumber, 93);
});

test('does not suppress a different GHSA even for the same package', async () => {
  const repositoryRoot = await fixture();
  const candidate = alert({
    security_advisory: {
      ghsa_id: 'GHSA-different',
      severity: 'high',
    },
  });
  const result = await filterVerifiedDependabotBackports({
    alerts: [candidate],
    ledger: ledger(),
    repositoryRoot,
  });

  assert.deepEqual(result.effectiveAlerts, [candidate]);
  assert.deepEqual(result.verifiedBackports, []);
});

test('fails closed when the patch bytes drift', async () => {
  const repositoryRoot = await fixture();
  await writeFile(path.join(repositoryRoot, patchPath), 'drifted patch\n');

  await assert.rejects(
    filterVerifiedDependabotBackports({
      alerts: [alert()],
      ledger: ledger(),
      repositoryRoot,
    }),
    /patch SHA mismatch/
  );
});

test('fails closed when the lockfile loses patched package identity', async () => {
  const repositoryRoot = await fixture();
  await writeFile(
    path.join(repositoryRoot, 'pnpm-lock.yaml'),
    `patchedDependencies:\n  node-forge@1.4.0: ${patchSha256}\n`
  );

  await assert.rejects(
    filterVerifiedDependabotBackports({
      alerts: [alert()],
      ledger: ledger(),
      repositoryRoot,
    }),
    /missing patched package identity/
  );
});
