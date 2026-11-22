import assert from 'node:assert/strict';
import test from 'node:test';

import {
  inspectNewsletterOwnerWithProtectedReader,
  makeNewsletterOwnerReadonlyReader,
} from './newsletter-owner-protected-readonly.mjs';

const accountId = 'a'.repeat(32);
const deploymentId = '11111111-1111-4111-8111-111111111111';
const versionId = '22222222-2222-4222-8222-222222222222';
const root = '/accounts/' + accountId + '/workers/scripts/vellira-newsletter-budget-owner';

function fakeCloudflare() {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    assert.equal(url.origin, 'https://api.cloudflare.com');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Accept, 'application/json');
    assert.equal(options.headers.Authorization, 'Bearer private-token');
    assert.equal(options.body, undefined);
    assert.ok(options.signal instanceof AbortSignal);
    const path = url.pathname + url.search;
    const result = path.endsWith('/deployments?page=1&per_page=2')
      ? { deployments: [{
        id: deploymentId,
        strategy: 'percentage',
        versions: [{ version_id: versionId, percentage: 100 }],
      }] }
      : path.endsWith('/deployments/' + deploymentId)
        ? {
          id: deploymentId,
          strategy: 'percentage',
          versions: [{ version_id: versionId, percentage: 100 }],
        }
        : path.endsWith('/versions/' + versionId)
          ? { id: versionId, resources: { script: { etag: 'hidden-etag' } } }
          : null;
    if (!result) throw new Error('Unexpected Cloudflare route');
    return Response.json({ success: true, result });
  };
  return { fetcher, calls };
}

test('real reader is GET-only, fixed-host and serves the existing continuity proof', async () => {
  const cloudflare = fakeCloudflare();
  const result = await inspectNewsletterOwnerWithProtectedReader({
    accountId,
    token: 'private-token',
    fetcher: cloudflare.fetcher,
  });
  assert.deepEqual(result, {
    status: 'stable_single_version_observed',
    servingVersionCount: 1,
    sourceBytesVerified: false,
    remotelyAttested: false,
    cutoverAuthorized: false,
  });
  assert.equal(cloudflare.calls.length, 4);
  assert.equal(cloudflare.calls[0].url.pathname + cloudflare.calls[0].url.search,
    '/client/v4' + root + '/deployments?page=1&per_page=2');
  const output = JSON.stringify(result);
  for (const secret of ['private-token', 'hidden-etag', deploymentId, versionId, accountId]) {
    assert.equal(output.includes(secret), false);
  }
});

test('reader accepts complete five-group UUIDs and rejects truncated identifiers', async () => {
  const cloudflare = fakeCloudflare();
  const read = makeNewsletterOwnerReadonlyReader({
    accountId, token: 'private-token', fetcher: cloudflare.fetcher,
  });
  const detail = await read(root + '/deployments/' + deploymentId);
  const version = await read(root + '/versions/' + versionId);
  assert.equal(detail.result.id, deploymentId);
  assert.equal(version.result.id, versionId);
  assert.equal(cloudflare.calls.length, 2);
  const truncated = '22222222-2222-4222-222222222222';
  await assert.rejects(read(root + '/versions/' + truncated));
  assert.equal(cloudflare.calls.length, 2);
});

test('reader rejects unexpected endpoints, account crossover and path traversal before fetch', async () => {
  const cloudflare = fakeCloudflare();
  const read = makeNewsletterOwnerReadonlyReader({
    accountId, token: 'private-token', fetcher: cloudflare.fetcher,
  });
  for (const path of [
    root + '/versions',
    root + '/versions/' + versionId + '/content',
    root + '/deployments?page=2&per_page=2',
    root + '/deployments/' + versionId + '?unexpected=1',
    root + '/versions/../secrets',
    '/accounts/' + 'b'.repeat(32) + '/workers/scripts/vellira-newsletter-budget-owner/deployments?page=1&per_page=2',
    root + '/versions/' + versionId + '/../../other',
    'https://example.com/',
    '/client/v4' + root + '/deployments?page=1&per_page=2',
  ]) {
    await assert.rejects(read(path));
  }
  assert.equal(cloudflare.calls.length, 0);
});

test('missing credentials reject locally; Cloudflare 403 and network errors fail closed', async () => {
  assert.throws(
    () => makeNewsletterOwnerReadonlyReader({ accountId, token: '' })
  );
  let requests = 0;
  const failed = await inspectNewsletterOwnerWithProtectedReader({
    accountId,
    token: 'private-token',
    fetcher: async (_url, options) => {
      requests += 1;
      assert.equal(options.method, 'GET');
      return Response.json({ success: false, errors: [{ message: 'private-secret' }] },
        { status: 403 });
    },
  });
  assert.equal(requests, 1);
  assert.equal(failed.status, 'unverified');
  assert.equal(failed.cutoverAuthorized, false);
  assert.equal(JSON.stringify(failed).includes('private-secret'), false);
});
