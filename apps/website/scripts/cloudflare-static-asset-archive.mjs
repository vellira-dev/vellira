import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  IMMUTABLE_CACHE_CONTROL,
  staticAssetKey,
} from '../cloudflare/cache-policy.mjs';

// Match Workers Assets' MIME 4 mapping plus its UTF-8 suffix for text types.
// Unknown extensions fail closed instead of silently serving octet-stream.
export const ASSET_CONTENT_TYPES = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/vnd.microsoft.icon',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};
export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');

export async function assetInventory(staticRoot) {
  const files = [];
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`Symlink in immutable assets: ${filename}`);
      if (entry.isDirectory()) await visit(filename);
      else if (entry.isFile()) {
        const relative = path
          .relative(staticRoot, filename)
          .split(path.sep)
          .join('/');
        const pathname = `/_next/static/${relative}`;
        const key = staticAssetKey(
          pathname.split('/').map(encodeURIComponent).join('/')
        );
        assert.ok(key, `Invalid asset path: ${pathname}`);
        const contentType = ASSET_CONTENT_TYPES[path.extname(filename)];
        assert.ok(contentType, `Unreviewed asset MIME type: ${filename}`);
        const bytes = await fs.readFile(filename);
        files.push({
          filename,
          pathname,
          key,
          contentType,
          sha256: sha256(bytes),
          size: bytes.length,
        });
      }
    }
  }
  await visit(staticRoot);
  assert.ok(files.length, 'Refusing to archive an empty static asset graph');
  return files.sort((a, b) => a.key.localeCompare(b.key));
}

export async function verifyArchivedAssets(bucket, inventory) {
  assert.ok(inventory.length, 'Archive inventory must not be empty');
  for (const asset of inventory) {
    const stored = await bucket.get(asset.key);
    assert.ok(stored, `Archive object missing: ${asset.pathname}`);
    // Consume the R2 body within its RPC method. Iterating a remote-proxied
    // stream from Node can outlive the request context and hang the proxy.
    // This is build-time verification only; Worker asset responses still stream.
    const bytes = Buffer.from(await stored.arrayBuffer());
    assert.equal(
      sha256(bytes),
      asset.sha256,
      `IMMUTABLE ASSET COLLISION: ${asset.pathname}`
    );
    assert.equal(
      stored.size,
      asset.size,
      `Archive size mismatch: ${asset.pathname}`
    );
    assert.equal(
      stored.customMetadata?.sha256,
      asset.sha256,
      `Archive digest metadata mismatch: ${asset.pathname}`
    );
    assert.equal(
      stored.httpMetadata?.contentType,
      asset.contentType,
      `Archive MIME mismatch: ${asset.pathname}`
    );
    assert.equal(
      stored.httpMetadata?.cacheControl,
      IMMUTABLE_CACHE_CONTROL,
      `Archive cache policy mismatch: ${asset.pathname}`
    );
  }
}

export async function recordArchivedDeployment(bucket, buildId, inventory) {
  assert.match(
    buildId,
    /^[a-zA-Z0-9_-]+$/,
    'Unsafe archived deployment identity'
  );
  await verifyArchivedAssets(bucket, inventory);
  const body = JSON.stringify({ buildId, assets: inventory });
  const key = `deployments/${buildId}.json`;
  await bucket.put(key, body, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'application/json' },
  });
  assert.equal(
    await (await bucket.get(key)).text(),
    body,
    'Archived deployment identity reused for a different graph'
  );
}

export async function requireArchivedDeployment(bucket, buildId) {
  assert.match(buildId, /^[a-zA-Z0-9_-]+$/);
  const object = await bucket.get(`deployments/${buildId}.json`);
  assert.ok(
    object,
    `Active deployment ${buildId} has not been archived. Backfill its original build artifacts before activation.`
  );
  const record = await object.json();
  assert.equal(record.buildId, buildId);
  await verifyArchivedAssets(bucket, record.assets);
}

export async function archiveAssets(bucket, inventory) {
  for (const asset of inventory) {
    const bytes = await fs.readFile(asset.filename);
    assert.equal(
      sha256(bytes),
      asset.sha256,
      `Asset changed during archive upload: ${asset.pathname}`
    );
    // Atomic create-only. A concurrent publisher can never overwrite an existing
    // path. Verify actual stored bytes even when its digest metadata matches.
    await bucket.put(asset.key, bytes, {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: {
        contentType: asset.contentType,
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      },
      customMetadata: { sha256: asset.sha256 },
    });
    await verifyArchivedAssets(bucket, [asset]);
  }
  return inventory.map((asset) =>
    Object.fromEntries(
      Object.entries(asset).filter(([key]) => key !== 'filename')
    )
  );
}
