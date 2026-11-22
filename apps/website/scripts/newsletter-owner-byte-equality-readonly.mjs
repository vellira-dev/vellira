import { createHash } from 'node:crypto';

// Compare a locally pinned raw script file with a Cloudflare script-scoped
// content/v2 snapshot. NOT the domain-separated multi-file Wrangler fingerprint.
// Equal bytes do not prove that the snapshot belongs to the serving version.
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_BYTES = 8 * 1024 * 1024;

export function compareNewsletterOwnerScriptBytes({ snapshot, localBytes } = {}) {
  const denied = (reason) => ({
    status: 'unverified', reason, scriptScopedByteEquality: false,
    servingVersionBytesVerified: false, sourceBytesVerified: false,
    remotelyAttested: false, cutoverAuthorized: false,
  });
  if (snapshot?.status !== 'script_scoped_content_snapshot_observed' ||
      snapshot?.contentSnapshotObserved !== true ||
      snapshot?.versionBoundContent !== false ||
      snapshot?.sourceBytesVerified !== false ||
      snapshot?.remotelyAttested !== false ||
      snapshot?.cutoverAuthorized !== false ||
      !SHA256.test(snapshot?.contentSha256 ?? '') ||
      !Number.isSafeInteger(snapshot?.contentBytes) ||
      snapshot.contentBytes < 1 || snapshot.contentBytes > MAX_BYTES) {
    return denied('snapshot_unverified');
  }
  if (!Buffer.isBuffer(localBytes) || localBytes.length < 1 ||
      localBytes.length > MAX_BYTES) return denied('local_bytes_unverified');
  const localSha256 = createHash('sha256').update(localBytes).digest('hex');
  // Even if hashes match, the source is script-scoped, not version-bound.
  const matches = localBytes.length === snapshot.contentBytes &&
    localSha256 === snapshot.contentSha256;
  return {
    status: matches ? 'script_scoped_byte_equality_observed' : 'script_scoped_byte_mismatch',
    scriptScopedByteEquality: matches,
    localBytes: localBytes.length,
    servingVersionBytesVerified: false,
    sourceBytesVerified: false,
    remotelyAttested: false,
    cutoverAuthorized: false,
  };
}
