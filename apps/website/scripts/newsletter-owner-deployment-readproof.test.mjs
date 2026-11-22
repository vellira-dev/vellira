import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectNewsletterOwnerDeploymentReadOnly } from './newsletter-owner-deployment-readproof.mjs';

const accountId = 'a'.repeat(32);
const deployId = '11111111-1111-4111-8111-111111111111';
const versionId = '22222222-2222-4222-8222-222222222222';
const oldId = '33333333-3333-4333-8333-333333333333';
const base = '/accounts/' + accountId + '/workers/scripts/vellira-newsletter-budget-owner';
const response = (result) => ({ success: true, result });
function fixture(overrides = {}) {
  const calls = [];
  let listCount = 0;
  const get = async (path) => {
    calls.push(path);
    if (path === base + '/deployments?page=1&per_page=2') {
      listCount += 1;
      const deployment = {
        id: listCount === 2 && overrides.changedDeployment ? oldId : deployId,
        strategy: 'percentage',
        versions: overrides.mixed
          ? [{ version_id: versionId, percentage: 99.99 },
            { version_id: oldId, percentage: 0.01 }]
          : [{ version_id: versionId, percentage: 100 }],
      };
      return response({ deployments: [deployment] });
    }
    if (path === base + '/deployments/' + deployId) {
      return response({
        id: deployId,
        strategy: 'percentage',
        versions: [{
          version_id: overrides.detailWrongVersion ? oldId : versionId,
          percentage: 100,
        }],
      });
    }
    if (path === base + '/versions/' + versionId) {
      if (overrides.deniedVersion) throw new Error('sensitive token');
      return response({
        id: overrides.versionWrongId ? oldId : versionId,
        resources: { script: overrides.missingEtag ? {} : { etag: 'private-etag' } },
        bindings: { API_TOKEN: 'private-secret' },
      });
    }
    throw new Error('unexpected API URL');
  };
  return { get, calls };
}

test('owner deployment continuity uses only four GET reads and never claims source attestation', async () => {
  const mock = fixture();
  const evidence = await inspectNewsletterOwnerDeploymentReadOnly({
    accountId,
    cloudflareGet: mock.get,
  });
  assert.deepEqual(evidence, {
    status: 'stable_single_version_observed',
    servingVersionCount: 1,
    sourceBytesVerified: false,
    remotelyAttested: false,
    cutoverAuthorized: false,
  });
  assert.deepEqual(mock.calls, [
    base + '/deployments?page=1&per_page=2',
    base + '/deployments/' + deployId,
    base + '/versions/' + versionId,
    base + '/deployments?page=1&per_page=2',
  ]);
  const output = JSON.stringify(evidence);
  for (const secret of [accountId, deployId, versionId, 'private-etag', 'private-secret']) {
    assert.equal(output.includes(secret), false);
  }
});

test('mixed serving traffic and changed deployment always deny cutover', async () => {
  for (const changed of [fixture({ mixed: true }), fixture({ changedDeployment: true })]) {
    const evidence = await inspectNewsletterOwnerDeploymentReadOnly({
      accountId, cloudflareGet: changed.get,
    });
    assert.equal(evidence.status, 'unverified');
    assert.equal(evidence.cutoverAuthorized, false);
  }
});

test('mismatched detail, forged version ID, missing etag and API failure fail closed', async () => {
  for (const options of [
    { detailWrongVersion: true },
    { versionWrongId: true },
    { missingEtag: true },
    { deniedVersion: true },
  ]) {
    const mock = fixture(options);
    const evidence = await inspectNewsletterOwnerDeploymentReadOnly({
      accountId, cloudflareGet: mock.get,
    });
    assert.equal(evidence.status, 'unverified');
    assert.equal(evidence.remotelyAttested, false);
    assert.equal(evidence.cutoverAuthorized, false);
    assert.equal(JSON.stringify(evidence).includes('sensitive token'), false);
  }
});

test('without trusted reader credentials no remote call is attempted', async () => {
  let calls = 0;
  const evidence = await inspectNewsletterOwnerDeploymentReadOnly({
    accountId: 'not-an-account',
    cloudflareGet: () => { calls += 1; },
  });
  assert.equal(evidence.status, 'unverified');
  assert.equal(calls, 0);
});
