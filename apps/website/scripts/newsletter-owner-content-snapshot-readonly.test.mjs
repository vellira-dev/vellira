import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { inspectNewsletterOwnerContentSnapshotReadOnly as inspect } from './newsletter-owner-content-snapshot-readonly.mjs';

const accountId = 'a'.repeat(32);
const token = 'private-token';
const deploymentId = '11111111-1111-4111-8111-111111111111';
const versionId = '22222222-2222-4222-8222-222222222222';

function fixtures({ bytes = 'worker bundle', status = 200, metadataFault = false } = {}) {
  const calls = [];
  let listCount = 0;
  const metadataFetcher = async (url, options) => {
    calls.push({ type: 'metadata', url: String(url), options });
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    const path = url.pathname + url.search;
    const list = path.endsWith('/deployments?page=1&per_page=2');
    if (list) listCount++;
    const result = list ? { deployments: [{
      id: deploymentId, strategy: 'percentage',
      versions: [{ version_id: versionId, percentage: 100 }],
    }] } : path.endsWith('/deployments/' + deploymentId)
      ? { id: deploymentId, strategy: 'percentage',
        versions: [{ version_id: versionId, percentage: 100 }] }
      : { id: versionId, resources: { script: { etag: 'private-etag' } } };
    if (metadataFault && listCount > 2) return Response.json({ success: false }, { status: 403 });
    return Response.json({ success: true, result });
  };
  const contentFetcher = async (url, options) => {
    calls.push({ type: 'content', url: String(url), options });
    assert.equal(url.origin, 'https://api.cloudflare.com');
    assert.equal(url.pathname, '/client/v4/accounts/' + accountId +
      '/workers/scripts/vellira-newsletter-budget-owner/content/v2');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, 'Bearer ' + token);
    assert.equal(options.body, undefined);
    return new Response(bytes, { status });
  };
  return { calls, metadataFetcher, contentFetcher };
}

test('GET-only bounded script snapshot; remains explicitly unverified for serving-version bytes', async () => {
  const f = fixtures();
  const result = await inspect({ accountId, token, ...f });
  assert.equal(result.status, 'script_scoped_content_snapshot_observed');
  assert.equal(result.contentSha256, createHash('sha256').update('worker bundle').digest('hex'));
  assert.equal(result.contentBytes, Buffer.byteLength('worker bundle'));
  assert.equal(result.versionBoundContent, false);
  assert.equal(result.sourceBytesVerified, false);
  assert.equal(result.remotelyAttested, false);
  assert.equal(result.cutoverAuthorized, false);
  assert.equal(f.calls.length, 9);
  assert.deepEqual(f.calls.map(c => c.type), [
    'metadata','metadata','metadata','metadata','content',
    'metadata','metadata','metadata','metadata',
  ]);
  const output = JSON.stringify(result);
  for (const secret of [token, accountId, versionId, deploymentId, 'worker bundle', 'private-etag'])
    assert.equal(output.includes(secret), false);
});

test('invalid credentials fail closed before network calls', async () => {
  const f = fixtures();
  const result = await inspect({ accountId, token: '', ...f });
  assert.equal(result.status, 'unverified');
  assert.equal(result.cutoverAuthorized, false);
  assert.equal(f.calls.length, 0);
});

test('content HTTP failure fails closed and never performs provider writes', async () => {
  const f = fixtures({ status: 403 });
  const result = await inspect({ accountId, token, ...f });
  assert.equal(result.status, 'unverified');
  assert.equal(result.contentSnapshotObserved, false);
  assert.equal(result.cutoverAuthorized, false);
  assert.equal(f.calls.filter(c => c.type === 'content').length, 1);
});

test('missing or oversized source fails closed', async () => {
  for (const bytes of ['', 'x'.repeat(8 * 1024 * 1024 + 1)]) {
    const f = fixtures({ bytes });
    const result = await inspect({ accountId, token, ...f });
    assert.equal(result.status, 'unverified');
    assert.equal(result.sourceBytesVerified, false);
  }
});

test('post-read metadata failure fails closed', async () => {
  const f = fixtures({ metadataFault: true });
  const result = await inspect({ accountId, token, ...f });
  assert.equal(result.status, 'unverified');
  assert.equal(result.cutoverAuthorized, false);
});
