import { createHash } from 'node:crypto';

// Offline deterministic digest of the emitted JavaScript bundle, not a
// Cloudflare version attestation. Caller supplies bytes from a pinned dry-run.
export function fingerprintNewsletterOwnerBundle(files) {
  if (!Array.isArray(files) || files.length < 1) {
    throw new Error('Owner bundle files are missing');
  }
  const validated = files.map((entry) => {
    if (!entry || typeof entry !== 'object' ||
        typeof entry.path !== 'string' ||
        !/^[a-zA-Z0-9_./-]+\\.(?:mjs|js)$/.test(entry.path) ||
        entry.path.startsWith('/') ||
        entry.path.split('/').some((part) => part === '.' || part === '..' || !part) ||
        !Buffer.isBuffer(entry.bytes) ||
        entry.bytes.length < 1) {
      throw new Error('Owner bundle contains invalid entry');
    }
    return entry;
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

  const digest = createHash('sha256');
  digest.update('vellira-owner-js-bundle-v1\\0', 'utf8');
  let totalBytes = 0;
  let previous;
  for (const entry of validated) {
    if (entry.path === previous) throw new Error('Owner bundle has duplicate paths');
    previous = entry.path;
    totalBytes += entry.bytes.length;
    if (!Number.isSafeInteger(totalBytes)) throw new Error('Owner bundle size overflow');
    // Length prefixes prevent (path, bytes) boundary ambiguity.
    const header = Buffer.alloc(16);
    header.writeBigUInt64BE(BigInt(Buffer.byteLength(entry.path)), 0);
    header.writeBigUInt64BE(BigInt(entry.bytes.length), 8);
    digest.update(header);
    digest.update(entry.path, 'utf8');
    digest.update(entry.bytes);
  }
  return {
    schemaVersion: 1,
    algorithm: 'sha256',
    bundleSha256: digest.digest('hex'),
    javascriptFileCount: validated.length,
    javascriptBytes: totalBytes,
    remotelyAttested: false,
    cutoverAuthorized: false,
  };
}
