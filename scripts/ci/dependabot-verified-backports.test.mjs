import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  DEFAULT_LEDGER_PATH,
  filterVerifiedDependabotBackports,
} from './dependabot-verified-backports.mjs';

const patchPath = 'patches/node-forge@1.4.0.patch';
const upstreamFilePath = 'lib/rsa.js';
const upstreamBaseBlob = 'a'.repeat(40);
const installedFixedFile = 'verified upstream fixed bytes\n';

function gitBlobSha1(source) {
  const bytes = Buffer.from(source);
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex');
}

const upstreamFixedBlob = gitBlobSha1(installedFixedFile);
const patch = [
  `diff --git a/${upstreamFilePath} b/${upstreamFilePath}`,
  `index ${upstreamBaseBlob}..${upstreamFixedBlob} 100644`,
  `--- a/${upstreamFilePath}`,
  `+++ b/${upstreamFilePath}`,
  '@@ -1 +1 @@',
  '-old',
  '+new',
  '',
].join('\n');
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
        upstreamBaseBlob,
        upstreamFixedBlob,
        upstreamFilePath,
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
  await mkdir(path.join(root, 'node_modules', 'node-forge', 'lib'), {
    recursive: true,
  });
  await writeFile(path.join(root, patchPath), patch);
  await writeFile(
    path.join(root, 'node_modules', 'node-forge', 'package.json'),
    JSON.stringify({ name: 'node-forge', version: '1.4.0' })
  );
  await writeFile(
    path.join(root, 'node_modules', 'node-forge', upstreamFilePath),
    installedFixedFile
  );
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
      'snapshots:',
      '',
      `  node-forge@1.4.0(patch_hash=${patchSha256}): {}`,
      '',
    ].join('\n')
  );
  return root;
}

test('repository ledger verifies against materialized patched dependencies', async () => {
  const repositoryLedger = JSON.parse(
    await readFile(DEFAULT_LEDGER_PATH, 'utf8')
  );
  const alerts = repositoryLedger.backports.map((entry) => ({
    number: entry.alertNumber,
    dependency: {
      package: { name: entry.package },
      manifest_path: entry.manifestPath,
      scope: entry.scope,
    },
    security_advisory: {
      ghsa_id: entry.ghsaId,
      severity: 'high',
    },
  }));

  const result = await filterVerifiedDependabotBackports({
    alerts,
    ledger: repositoryLedger,
    repositoryRoot: process.cwd(),
  });

  assert.deepEqual(result.effectiveAlerts, []);
  assert.equal(result.verifiedBackports.length, repositoryLedger.backports.length);
  for (const entry of result.verifiedBackports) {
    assert.equal(entry.actualInstalledFixedBlob, entry.upstreamFixedBlob);
  }
});

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

test('fails closed when a bare vulnerable lock reference remains', async () => {
  const repositoryRoot = await fixture();
  await writeFile(
    path.join(repositoryRoot, 'pnpm-lock.yaml'),
    [
      'patchedDependencies:',
      `  node-forge@1.4.0: ${patchSha256}`,
      '',
      'snapshots:',
      '',
      '  consumer@1.0.0:',
      '    dependencies:',
      '      node-forge: 1.4.0',
      '',
      `  node-forge@1.4.0(patch_hash=${patchSha256}): {}`,
      '',
    ].join('\n')
  );

  await assert.rejects(
    filterVerifiedDependabotBackports({
      alerts: [alert()],
      ledger: ledger(),
      repositoryRoot,
    }),
    /unpatched lockfile reference/
  );
});
test('fails closed when installed patched bytes drift from upstream fixed blob', async () => {
  const repositoryRoot = await fixture();
  await writeFile(
    path.join(repositoryRoot, 'node_modules', 'node-forge', upstreamFilePath),
    'different installed bytes\n'
  );

  await assert.rejects(
    filterVerifiedDependabotBackports({
      alerts: [alert()],
      ledger: ledger(),
      repositoryRoot,
    }),
    /installed fixed-file blob mismatch/
  );
});

test('fails closed when patch provenance does not bind declared upstream blobs', async () => {
  const repositoryRoot = await fixture();
  const malformedPatch = patch.replace(upstreamBaseBlob, 'f'.repeat(40));
  const candidateLedger = ledger();
  candidateLedger.backports[0].patchSha256 = createHash('sha256')
    .update(malformedPatch)
    .digest('hex');
  await writeFile(path.join(repositoryRoot, patchPath), malformedPatch);
  await writeFile(
    path.join(repositoryRoot, 'pnpm-lock.yaml'),
    [
      'patchedDependencies:',
      `  node-forge@1.4.0: ${candidateLedger.backports[0].patchSha256}`,
      '',
      'snapshots:',
      '',
      `  node-forge@1.4.0(patch_hash=${candidateLedger.backports[0].patchSha256}): {}`,
      '',
    ].join('\n')
  );

  await assert.rejects(
    filterVerifiedDependabotBackports({
      alerts: [alert()],
      ledger: candidateLedger,
      repositoryRoot,
    }),
    /patch provenance does not bind/
  );
});
