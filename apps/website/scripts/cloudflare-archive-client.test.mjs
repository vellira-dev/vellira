import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createR2S3Bucket,
  resolveR2S3Credentials,
  signR2S3Request,
} from './cloudflare-archive-client.mjs';

const accountId = 'a'.repeat(32);
const accessKeyId = 'b'.repeat(32);
const secretAccessKey = 'c'.repeat(64);
const fixedDate = new Date('2026-09-12T22:00:00.000Z');

test('R2 S3 signer binds method, encoded bucket/key, body and metadata', () => {
  const signed = signR2S3Request({
    accountId,
    bucketName: 'archive-bucket',
    key: 'assets/_next/static/chunks/a b.js',
    method: 'PUT',
    body: Buffer.from('fixture'),
    headers: {
      'if-none-match': '*',
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-amz-meta-sha256': 'd'.repeat(64),
    },
    accessKeyId,
    secretAccessKey,
    now: fixedDate,
  });
  assert.equal(
    signed.url.toString(),
    `https://${accountId}.r2.cloudflarestorage.com/archive-bucket/assets/_next/static/chunks/a%20b.js`
  );
  assert.equal(signed.headers['if-none-match'], '*');
  assert.equal(signed.headers['x-amz-date'], '20260912T220000Z');
  assert.match(
    signed.headers.authorization,
    new RegExp(
      `^AWS4-HMAC-SHA256 Credential=${accessKeyId}/20260912/auto/s3/aws4_request, SignedHeaders=.*if-none-match.*x-amz-meta-sha256.*, Signature=[a-f0-9]{64}$`
    )
  );
});

test('R2 credentials derive S3 keys from the verified Cloudflare API token', async () => {
  const token = 'test-cloudflare-api-token';
  let authorization;
  const credentials = await resolveR2S3Credentials(token, {
    fetchImpl: async (_url, options) => {
      authorization = options.headers.Authorization;
      return new Response(
        JSON.stringify({
          success: true,
          result: { id: accessKeyId, status: 'active' },
        }),
        { headers: { 'content-type': 'application/json' } }
      );
    },
  });
  assert.equal(authorization, `Bearer ${token}`);
  assert.equal(credentials.accessKeyId, accessKeyId);
  assert.equal(
    credentials.secretAccessKey,
    'c7562ddc404e7d4b48ea0f613f113d2a692a6215d7623e133b100267239995cd'
  );
});

test('R2 S3 bucket preserves create-only and metadata contracts without Wrangler proxy', async () => {
  const calls = [];
  const bytes = Buffer.from('fixture');
  const bucket = createR2S3Bucket({
    accountId,
    bucketName: 'archive-bucket',
    accessKeyId,
    secretAccessKey,
    now: () => fixedDate,
    sleepImpl: async () => {},
    fetchImpl: async (url, options) => {
      calls.push({
        url: url.toString(),
        method: options.method,
        headers: options.headers,
      });
      if (options.method === 'PUT') return new Response(null, { status: 412 });
      return new Response(options.method === 'GET' ? bytes : null, {
        headers: {
          'content-length': String(bytes.length),
          'content-type': 'text/javascript; charset=utf-8',
          'cache-control': 'public, max-age=31536000, immutable',
          'x-amz-meta-sha256': 'd'.repeat(64),
          etag: '"etag-a"',
        },
      });
    },
  });
  assert.equal(
    await bucket.put('assets/file.js', bytes, {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: {
        contentType: 'text/javascript; charset=utf-8',
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: { sha256: 'd'.repeat(64) },
    }),
    null
  );
  assert.equal(calls[0].headers['if-none-match'], '*');
  assert.equal(calls[0].headers['x-amz-meta-sha256'], 'd'.repeat(64));
  const object = await bucket.get('assets/file.js');
  assert.equal(object.size, bytes.length);
  assert.equal(object.customMetadata.sha256, 'd'.repeat(64));
  assert.equal(
    object.httpMetadata.contentType,
    'text/javascript; charset=utf-8'
  );
  assert.deepEqual(Buffer.from(await object.arrayBuffer()), bytes);
});

test('R2 S3 bucket retries transient transport failures with bounded attempts', async () => {
  let attempts = 0;
  const bucket = createR2S3Bucket({
    accountId,
    bucketName: 'archive-bucket',
    accessKeyId,
    secretAccessKey,
    maxAttempts: 3,
    now: () => fixedDate,
    sleepImpl: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) throw new TypeError('network reset');
      return new Response('ok', {
        headers: { 'content-length': '2', 'content-type': 'text/plain' },
      });
    },
  });
  assert.equal(await (await bucket.get('deployments/a.json')).text(), 'ok');
  assert.equal(attempts, 3);
});

test('R2 S3 bucket retries request timeouts with bounded attempts', async () => {
  let attempts = 0;
  const bucket = createR2S3Bucket({
    accountId,
    bucketName: 'archive-bucket',
    accessKeyId,
    secretAccessKey,
    maxAttempts: 2,
    now: () => fixedDate,
    sleepImpl: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1)
        throw new DOMException('The operation timed out', 'TimeoutError');
      return new Response('ok', {
        headers: { 'content-length': '2', 'content-type': 'text/plain' },
      });
    },
  });
  assert.equal(await (await bucket.get('deployments/a.json')).text(), 'ok');
  assert.equal(attempts, 2);
});
