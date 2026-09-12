import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';

const REGION = 'auto';
const SERVICE = 's3';
const TERMINATOR = 'aws4_request';
const TOKEN_VERIFY_URL = 'https://api.cloudflare.com/client/v4/user/tokens/verify';
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 4;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();

function encodePathPart(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function amzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function bodyBytes(body) {
  if (body === undefined || body === null) return Buffer.alloc(0);
  if (typeof body === 'string') return Buffer.from(body);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array)
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  throw new TypeError('R2 S3 request body must be bytes or a string');
}

function canonicalHeaderValue(value) {
  return String(value).trim().replace(/\s+/g, ' ');
}

export function signR2S3Request({
  accountId,
  bucketName,
  key,
  method,
  body,
  headers = {},
  accessKeyId,
  secretAccessKey,
  now = new Date(),
}) {
  assert.match(accountId, /^[a-f0-9]{32}$/, 'Invalid Cloudflare account ID');
  assert.ok(bucketName, 'R2 bucket name is required');
  assert.ok(key, 'R2 object key is required');
  assert.ok(accessKeyId, 'R2 access key ID is required');
  assert.ok(secretAccessKey, 'R2 secret access key is required');

  const hostname = `${accountId}.r2.cloudflarestorage.com`;
  const pathname = `/${encodePathPart(bucketName)}/${key
    .split('/')
    .map(encodePathPart)
    .join('/')}`;
  const url = new URL(`https://${hostname}${pathname}`);
  const bytes = bodyBytes(body);
  const payloadHash = sha256(bytes);
  const timestamp = amzDate(now);
  const dateStamp = timestamp.slice(0, 8);

  const normalizedHeaders = new Map([
    ['host', hostname],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', timestamp],
  ]);
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || value === null) continue;
    normalizedHeaders.set(name.toLowerCase(), canonicalHeaderValue(value));
  }

  const sortedHeaders = [...normalizedHeaders.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const canonicalHeaders = `${sortedHeaders
    .map(([name, value]) => `${name}:${value}`)
    .join('\n')}\n`;
  const signedHeaders = sortedHeaders.map(([name]) => name).join(';');
  const canonicalRequest = [
    method,
    pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const scope = `${dateStamp}/${REGION}/${SERVICE}/${TERMINATOR}`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    scope,
    sha256(canonicalRequest),
  ].join('\n');
  const dateKey = hmac(Buffer.from(`AWS4${secretAccessKey}`), dateStamp);
  const regionKey = hmac(dateKey, REGION);
  const serviceKey = hmac(regionKey, SERVICE);
  const signingKey = hmac(serviceKey, TERMINATOR);
  const signature = createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex');

  const requestHeaders = Object.fromEntries(sortedHeaders);
  // `host` participates in SigV4 but the HTTP client owns the wire Host header.
  delete requestHeaders.host;
  requestHeaders.authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url, headers: requestHeaders, body: bytes };
}

export async function resolveR2S3Credentials(
  apiToken,
  { fetchImpl = fetch, signal } = {}
) {
  assert.ok(apiToken?.trim(), 'CLOUDFLARE_API_TOKEN is required');
  const response = await fetchImpl(TOKEN_VERIFY_URL, {
    headers: { Authorization: `Bearer ${apiToken}` },
    signal,
  });
  if (!response.ok) {
    throw new Error(
      `Unable to resolve R2 S3 credentials from Cloudflare token: HTTP ${response.status}`
    );
  }
  const payload = await response.json();
  const accessKeyId = payload?.result?.id;
  assert.match(
    accessKeyId ?? '',
    /^[a-f0-9]{32}$/,
    'Cloudflare token verification did not return a token ID'
  );
  assert.notEqual(
    payload?.result?.status,
    'disabled',
    'Cloudflare token is disabled'
  );
  return {
    accessKeyId,
    secretAccessKey: sha256(apiToken.trim()),
  };
}

function shouldRetry(errorOrStatus) {
  if (typeof errorOrStatus === 'number')
    return errorOrStatus === 408 || errorOrStatus === 429 || errorOrStatus >= 500;
  return (
    errorOrStatus?.name === 'TypeError' ||
    errorOrStatus?.name === 'AbortError' ||
    errorOrStatus?.code === 'ECONNRESET' ||
    errorOrStatus?.code === 'ETIMEDOUT'
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function objectFromResponse(response, bytes = null) {
  const sizeHeader = response.headers.get('content-length');
  const size = sizeHeader === null ? bytes?.byteLength ?? 0 : Number(sizeHeader);
  const customSha = response.headers.get('x-amz-meta-sha256');
  const contentType = response.headers.get('content-type');
  const cacheControl = response.headers.get('cache-control');
  const etag = response.headers.get('etag');
  return {
    size,
    etag: etag?.replace(/^"|"$/g, '') ?? undefined,
    httpEtag: etag ?? undefined,
    customMetadata: customSha ? { sha256: customSha } : {},
    httpMetadata: {
      ...(contentType ? { contentType } : {}),
      ...(cacheControl ? { cacheControl } : {}),
    },
    body: response.body,
    async arrayBuffer() {
      assert.ok(bytes, 'Object body was not loaded');
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      );
    },
    async text() {
      assert.ok(bytes, 'Object body was not loaded');
      return bytes.toString();
    },
    async json() {
      return JSON.parse(await this.text());
    },
  };
}

export function createR2S3Bucket({
  accountId,
  bucketName,
  accessKeyId,
  secretAccessKey,
  fetchImpl = fetch,
  now = () => new Date(),
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  sleepImpl = sleep,
}) {
  assert.match(accountId, /^[a-f0-9]{32}$/);
  assert.ok(bucketName);
  assert.ok(Number.isInteger(maxAttempts) && maxAttempts >= 1);

  async function request(method, key, { body, headers = {} } = {}) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const signed = signR2S3Request({
        accountId,
        bucketName,
        key,
        method,
        body,
        headers,
        accessKeyId,
        secretAccessKey,
        now: now(),
      });
      try {
        const response = await fetchImpl(signed.url, {
          method,
          headers: signed.headers,
          body: method === 'GET' || method === 'HEAD' ? undefined : signed.body,
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
        if (
          response.ok ||
          response.status === 412 ||
          (response.status === 404 && (method === 'GET' || method === 'HEAD'))
        )
          return response;
        if (attempt < maxAttempts && shouldRetry(response.status)) {
          await response.body?.cancel();
          await sleepImpl(250 * 2 ** (attempt - 1));
          continue;
        }
        await response.body?.cancel();
        throw new Error(`R2 S3 ${method} ${key} failed: HTTP ${response.status}`);
      } catch (error) {
        if (attempt < maxAttempts && shouldRetry(error)) {
          await sleepImpl(250 * 2 ** (attempt - 1));
          continue;
        }
        throw error;
      }
    }
    throw new Error(`R2 S3 ${method} ${key} exhausted retries`);
  }

  return {
    async head(key) {
      const response = await request('HEAD', key);
      if (response.status === 404) return null;
      return objectFromResponse(response);
    },
    async get(key) {
      const response = await request('GET', key);
      if (response.status === 404) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      return objectFromResponse(response, bytes);
    },
    async put(key, body, options = {}) {
      const headers = {};
      if (options.onlyIf?.etagDoesNotMatch)
        headers['if-none-match'] = options.onlyIf.etagDoesNotMatch;
      if (options.httpMetadata?.contentType)
        headers['content-type'] = options.httpMetadata.contentType;
      if (options.httpMetadata?.cacheControl)
        headers['cache-control'] = options.httpMetadata.cacheControl;
      for (const [name, value] of Object.entries(options.customMetadata ?? {}))
        headers[`x-amz-meta-${name}`] = value;
      const response = await request('PUT', key, { body, headers });
      if (response.status === 412) return null;
      await response.body?.cancel();
      return { etag: response.headers.get('etag')?.replace(/^"|"$/g, '') };
    },
  };
}

export async function withRemoteArchive(config, operation, options = {}) {
  const binding = config.r2_buckets?.find(
    (entry) => entry.binding === 'STATIC_ASSET_ARCHIVE'
  );
  assert.ok(binding?.bucket_name, 'Missing immutable archive configuration');
  const accountId = config.account_id ?? process.env.CLOUDFLARE_ACCOUNT_ID;
  assert.match(
    accountId ?? '',
    /^[a-f0-9]{32}$/,
    'Invalid Cloudflare account ID'
  );
  const apiToken = options.apiToken ?? process.env.CLOUDFLARE_API_TOKEN;
  const fetchImpl = options.fetchImpl ?? fetch;
  const credentials =
    options.credentials ??
    (await resolveR2S3Credentials(apiToken, {
      fetchImpl,
      signal: AbortSignal.timeout(15_000),
    }));
  const bucket = createR2S3Bucket({
    accountId,
    bucketName: binding.bucket_name,
    ...credentials,
    fetchImpl,
    ...(options.bucketOptions ?? {}),
  });
  return operation(bucket, binding.bucket_name);
}
