import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateNewsletterOwnerArtifactChain } from '../cloudflare/newsletter-owner-artifact-chain.mjs';

const version = '11111111-1111-4111-8111-111111111111';
const old = '22222222-2222-4222-8222-222222222222';
const worker = 'vellira-newsletter-budget-owner';

function fixture() {
  const gitSha = 'a'.repeat(40);
  const bundleSha256 = 'b'.repeat(64);
  return {
    gitSha,
    build: { worker, gitSha, bundleSha256 },
    upload: { worker, gitSha, bundleSha256, versionId: version },
    serving: { worker, versions: [{ versionId: version, percent: 100 }] },
  };
}

test('consistent untrusted chain NEVER authenticates remote source or cutover', () => {
  assert.deepEqual(evaluateNewsletterOwnerArtifactChain(fixture()), {
    consistent: true,
    reason: 'untrusted_chain_consistent',
    remotelyAttested: false,
    cutoverAuthorized: false,
  });
});

test('every mismatch between git, bundle, uploaded version and serving deployment denies', () => {
  const cases = [
    (value) => { value.build.gitSha = 'c'.repeat(40); },
    (value) => { value.build.bundleSha256 = 'not-a-digest'; },
    (value) => { value.upload.bundleSha256 = 'c'.repeat(64); },
    (value) => { value.upload.gitSha = 'c'.repeat(40); },
    (value) => { value.upload.worker = 'unexpected-worker'; },
    (value) => { value.upload.versionId = 'wrong-id'; },
    (value) => { value.serving.versions[0].versionId = old; },
    (value) => { value.serving.worker = 'unexpected-worker'; },
    (value) => { value.gitSha = 'not-a-sha'; },
  ];
  for (const mutate of cases) {
    const data = fixture();
    mutate(data);
    const result = evaluateNewsletterOwnerArtifactChain(data);
    assert.equal(result.consistent, false);
    assert.equal(result.remotelyAttested, false);
    assert.equal(result.cutoverAuthorized, false);
  }
});

test('tiny legacy traffic, duplicate versions, malformed or partial percentages deny', () => {
  for (const versions of [
    [{ versionId: version, percent: 99.99 }, { versionId: old, percent: 0.01 }],
    [{ versionId: version, percent: 50 }, { versionId: version, percent: 50 }],
    [{ versionId: version, percent: 90 }],
    [{ versionId: version, percent: '100' }],
    [{ versionId: version, percent: Number.NaN }],
    [{ versionId: version, percent: 0 }],
    [],
    undefined,
  ]) {
    const data = fixture();
    data.serving.versions = versions;
    assert.equal(evaluateNewsletterOwnerArtifactChain(data).consistent, false);
  }
});

test('no evidence or incomplete receipts fail closed', () => {
  assert.equal(evaluateNewsletterOwnerArtifactChain(undefined).consistent, false);
  for (const field of ['build', 'upload', 'serving']) {
    const data = fixture();
    delete data[field];
    assert.equal(evaluateNewsletterOwnerArtifactChain(data).consistent, false);
  }
});
