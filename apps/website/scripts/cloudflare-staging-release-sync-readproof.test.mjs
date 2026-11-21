import assert from 'node:assert/strict';
import test from 'node:test';

import {
  verifyStagingReleaseSyncAdvance,
} from './cloudflare-staging-release-sync-readproof.mjs';
import { RELEASE_SYNC_MANIFESTS } from '../../../scripts/ci/release-sync-contract.mjs';

const candidateSha = 'a'.repeat(40);
const mainSha = 'b'.repeat(40);
const paths = [...RELEASE_SYNC_MANIFESTS];
function fixture({ files = paths, status = 'ahead', proof = true, relevantPaths = [], evidencePaths = files } = {}) {
  const calls = [];
  return {
    calls,
    options: {
      candidateSha,
      mainSha,
      githubGet: async (path) => {
        calls.push(['compare', path]);
        return {
          status,
          files: files.map(filename => ({ filename, status: 'modified' })),
          total_commits: 1,
          ahead_by: 1,
          behind_by: 0,
        };
      },
      assess: async (args) => {
        calls.push(['assess', args]);
        return {
          checked: true,
          mode: 'staging',
          mainSha,
          deploymentEquivalent: proof,
          relevantPaths,
          changedPaths: evidencePaths,
        };
      },
    },
  };
}

test('requires authenticated release-sync evidence and exact file list', async () => {
  const f = fixture();
  const result = await verifyStagingReleaseSyncAdvance(f.options);
  assert.equal(result.mainSha, mainSha);
  assert.deepEqual(result.changedPaths, paths.slice().sort());
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1][1].candidateSource, 'staging');
});

test('rejects unrelated website change before authority assessment', async () => {
  const f = fixture({ files: [...paths, 'apps/website/cloudflare/newsletter-owner-artifact-chain.mjs'] });
  await assert.rejects(verifyStagingReleaseSyncAdvance(f.options), /only exact release-sync paths/);
  assert.equal(f.calls.length, 1);
});

test('rejects malicious diff, non-ancestor or pagination truncation', async () => {
  for (const config of [
    { status: 'diverged' },
    { files: new Array(300).fill('package.json') },
    { files: ['apps/website/wrangler.jsonc'] },
  ]) {
    await assert.rejects(verifyStagingReleaseSyncAdvance(fixture(config).options));
  }
});

test('denies unverified, relevant or inconsistent authenticated proof', async () => {
  for (const config of [
    { proof: false },
    { relevantPaths: ['package.json'] },
    { evidencePaths: ['package.json'] },
  ]) {
    await assert.rejects(verifyStagingReleaseSyncAdvance(fixture(config).options));
  }
});

test('exact current main cannot manufacture release-sync advance', async () => {
  await assert.rejects(verifyStagingReleaseSyncAdvance({
    ...fixture().options, mainSha: candidateSha,
  }));
});
