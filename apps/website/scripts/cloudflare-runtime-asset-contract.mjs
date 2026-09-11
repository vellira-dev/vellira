import assert from 'node:assert/strict';
import path from 'node:path';
import { IMMUTABLE_CACHE_CONTROL } from '../cloudflare/cache-policy.mjs';
import { sha256 } from './cloudflare-static-asset-archive.mjs';

// Only these observed Workers Assets wire formats differ from the immutable
// archive metadata. Do not normalize archive objects or relax other MIME types.
const UTF8_TEXT_TYPES = new Map([
  ['.js', 'text/javascript'],
  ['.css', 'text/css'],
]);

function assertAssetContentType(asset, actual, bytes) {
  const mediaType = UTF8_TEXT_TYPES.get(path.extname(asset.pathname));
  if (mediaType && asset.contentType === `${mediaType}; charset=utf-8`) {
    // Full-string allowlist: one optional UTF-8 charset, no unknown, duplicate,
    // malformed or non-UTF-8 parameters. MIME tokens are case-insensitive.
    const allowed = new RegExp(
      `^${mediaType}(?:[\\t ]*;[\\t ]*charset=(?:utf-8|"utf-8"))?[\\t ]*$`,
      'i'
    );
    assert.ok(
      typeof actual === 'string' && allowed.test(actual),
      `${asset.pathname}: unexpected Content-Type ${JSON.stringify(actual)}`
    );
    assert.doesNotThrow(
      () => new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      `${asset.pathname}: asset is not valid UTF-8`
    );
    return;
  }
  assert.equal(actual, asset.contentType, `${asset.pathname}: Content-Type`);
}

export function assertRuntimeAsset(asset, { response, bytes }) {
  assert.equal(response.status, 200, `${asset.pathname}: HTTP status`);
  assert.equal(sha256(bytes), asset.sha256, `${asset.pathname}: SHA-256`);
  assertAssetContentType(asset, response.headers.get('content-type'), bytes);
  assert.equal(
    response.headers.get('cache-control'),
    IMMUTABLE_CACHE_CONTROL,
    `${asset.pathname}: immutable caching`
  );
}
