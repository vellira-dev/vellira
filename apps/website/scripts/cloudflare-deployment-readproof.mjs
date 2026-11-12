import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

import { verifyStagingActivationReadOnly } from './cloudflare-staging-readonly-verify.mjs';

const OWNER = 'vellira-dev/vellira';
const SCRIPT_NAME = 'vellira-website-staging';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT = /^[a-f0-9]{32}$/i;

export function validateCloudflareDeployment({ list, detail, workerVersion }) {
  assert.ok(list?.success === true, 'Cloudflare deployment listing failed');
  assert.ok(Array.isArray(list.result?.deployments), 'Missing deployment list');
  assert.ok(list.result.deployments.length > 0, 'No active deployment');
  const active = list.result.deployments[0];
  assert.match(active.id ?? '', UUID, 'Invalid active deployment ID');
  assert.ok(detail?.success === true, 'Cloudflare deployment detail failed');
  assert.equal(detail.result?.id, active.id, 'Cloudflare deployment changed between reads');
  assert.match(workerVersion ?? '', UUID, 'Runtime Worker version ID is not a UUID');
  for (const deployment of [active, detail.result]) {
    assert.equal(deployment.strategy, 'percentage', 'Unrecognized deployment strategy');
    assert.equal(deployment.versions?.length, 1, 'Mixed traffic is not verified');
    assert.equal(deployment.versions[0].percentage, 100, 'Deployment is not 100% active');
    assert.equal(
      deployment.versions[0].version_id,
      workerVersion,
      'Cloudflare active version and runtime version mismatch'
    );
  }
  return {
    deploymentId: active.id,
    workerVersion,
    createdOn: active.created_on,
  };
}

export async function verifyCloudflareDeploymentReadOnly({
  candidateSha,
  stagingRunId,
  stagingRunAttempt,
  accountId,
  githubGet,
  cloudflareGet,
  verifyStaging = verifyStagingActivationReadOnly,
}) {
  assert.match(accountId ?? '', ACCOUNT, 'Invalid Cloudflare account identifier');
  assert.equal(typeof githubGet, 'function');
  assert.equal(typeof cloudflareGet, 'function');
  // This verifies the actual Wrangler step and live build identity first.
  const staging = await verifyStaging({
    candidateSha,
    stagingRunId,
    stagingRunAttempt,
    githubGet,
  });
  assert.equal(staging.status, 'runtime-identity-verified');
  const base = '/accounts/' + accountId + '/workers/scripts/' + SCRIPT_NAME + '/deployments';
  const list = await cloudflareGet(base + '?page=1&per_page=2');
  assert.match(list?.result?.deployments?.[0]?.id ?? '', UUID);
  const detail = await cloudflareGet(base + '/' + list.result.deployments[0].id);
  const remote = validateCloudflareDeployment({
    list,
    detail,
    workerVersion: staging.workerVersion,
  });
  // Fail closed if Cloudflare was redeployed while detail was being read.
  const latestDeployment = await cloudflareGet(base + '?page=1&per_page=2');
  validateCloudflareDeployment({
    list: latestDeployment,
    detail,
    workerVersion: staging.workerVersion,
  });
  // Prevent old evidence from being accepted after main advances during API reads.
  const latest = await githubGet('/repos/' + OWNER + '/git/ref/heads/main');
  assert.equal(latest.object?.sha, candidateSha, 'Main advanced during Cloudflare verification');
  return {
    status: 'active-cloudflare-deployment-verified',
    sourceSha: candidateSha,
    buildId: staging.buildId,
    ...remote,
    note: 'Read-only deployment identity only; not full staging acceptance or production authorization',
  };
}

async function githubGet(path) {
  const token = process.env.GITHUB_TOKEN;
  assert.ok(token, 'GITHUB_TOKEN is required');
  const response = await fetch('https://api.github.com' + path, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, 'GitHub read failed: ' + response.status);
  return response.json();
}

async function cloudflareGet(path) {
  const token = process.env.CLOUDFLARE_WORKERS_READ_TOKEN;
  assert.ok(token, 'Dedicated Cloudflare read-only token is required');
  const response = await fetch('https://api.cloudflare.com/client/v4' + path, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, 'Cloudflare read failed: ' + response.status);
  return response.json();
}

async function main() {
  assert.equal(process.env.GITHUB_REPOSITORY, OWNER);
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  const result = await verifyCloudflareDeploymentReadOnly({
    candidateSha: process.env.EXPECTED_SOURCE_SHA,
    stagingRunId: Number(process.env.STAGING_RUN_ID),
    stagingRunAttempt: Number(process.env.STAGING_RUN_ATTEMPT),
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    githubGet,
    cloudflareGet,
  });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
