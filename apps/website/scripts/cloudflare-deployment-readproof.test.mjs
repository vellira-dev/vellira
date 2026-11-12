import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateCloudflareDeployment,
  verifyCloudflareDeploymentReadOnly,
} from './cloudflare-deployment-readproof.mjs';

const sha = 'a'.repeat(40);
const uuid = '11111111-2222-4333-8444-555555555555';
const deploymentId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const active = {
  id: deploymentId,
  created_on: '2026-11-12T10:00:00Z',
  strategy: 'percentage',
  versions: [{ percentage: 100, version_id: uuid }],
};
const list = { success: true, result: { deployments: [active] } };
const detail = { success: true, result: active };

test('confirms exactly one 100% active version matching runtime', () => {
  assert.deepEqual(validateCloudflareDeployment({ list, detail, workerVersion: uuid }), {
    deploymentId,
    workerVersion: uuid,
    createdOn: active.created_on,
  });
});

test('rejects mismatches, mixed traffic and ambiguous API responses', () => {
  const invalid = [
    { list: { ...list, success: false } },
    { list: { success: true, result: { deployments: [] } } },
    { detail: { success: true, result: { ...active, id: uuid } } },
    { workerVersion: 'not-uuid' },
    { list: { success: true, result: { deployments: [{ ...active, versions: [
      { percentage: 50, version_id: uuid }, { percentage: 50, version_id: uuid },
    ] }] } } },
    { detail: { success: true, result: { ...active, versions: [
      { percentage: 99, version_id: uuid },
    ] } } },
    { detail: { success: true, result: { ...active, versions: [
      { percentage: 100, version_id: deploymentId },
    ] } } },
  ];
  for (const change of invalid) {
    assert.throws(() => validateCloudflareDeployment({
      list, detail, workerVersion: uuid, ...change,
    }));
  }
});

function fixture({
  stale = false,
  listResult = list,
  detailResult = detail,
  stagingStatus = 'runtime-identity-verified',
} = {}) {
  const calls = [];
  return {
    calls,
    options: {
      candidateSha: sha,
      stagingRunId: 123,
      stagingRunAttempt: 1,
      accountId: 'a'.repeat(32),
      verifyStaging: async () => ({
        status: stagingStatus,
        buildId: sha + '-123-1',
        workerVersion: uuid,
      }),
      githubGet: async (path) => {
        calls.push(['github', path]);
        return { object: { sha: stale ? 'b'.repeat(40) : sha } };
      },
      cloudflareGet: async (path) => {
        calls.push(['cloudflare', path]);
        return path.endsWith('/deployments?page=1&per_page=2') ? listResult : detailResult;
      },
    },
  };
}

test('queries only read endpoints and returns authoritative deployment ID', async () => {
  const f = fixture();
  const result = await verifyCloudflareDeploymentReadOnly(f.options);
  assert.equal(result.deploymentId, deploymentId);
  assert.equal(result.status, 'active-cloudflare-deployment-verified');
  assert.deepEqual(f.calls.map((x) => x[0]), ['cloudflare', 'cloudflare', 'github']);
  assert.ok(f.calls.every((x) => !/POST|wrangler|dispatch/i.test(x[1])));
});

test('denies stale main, invalid account, failed staging identity and API mismatch', async () => {
  for (const f of [
    fixture({ stale: true }),
    fixture({ stagingStatus: 'failed' }),
    fixture({ detailResult: { success: false } }),
  ]) {
    await assert.rejects(verifyCloudflareDeploymentReadOnly(f.options));
  }
  const invalid = fixture();
  await assert.rejects(verifyCloudflareDeploymentReadOnly({
    ...invalid.options, accountId: 'invalid',
  }));
  assert.equal(invalid.calls.length, 0);
});
