import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { compareNewsletterOwnerScriptBytes as compare } from './newsletter-owner-byte-equality-readonly.mjs';

const bytes = Buffer.from('pinned single emitted script');
const digest = createHash('sha256').update(bytes).digest('hex');
const snapshot = {
  status: 'script_scoped_content_snapshot_observed',
  contentSnapshotObserved: true,
  contentBytes: bytes.length,
  contentSha256: digest,
  versionBoundContent: false,
  sourceBytesVerified: false,
  remotelyAttested: false,
  cutoverAuthorized: false,
};

test('equal raw bytes give only script-scoped equality, never version attestation', () => {
  const result = compare({ snapshot, localBytes: bytes });
  assert.equal(result.status, 'script_scoped_byte_equality_observed');
  assert.equal(result.scriptScopedByteEquality, true);
  assert.equal(result.servingVersionBytesVerified, false);
  assert.equal(result.sourceBytesVerified, false);
  assert.equal(result.remotelyAttested, false);
  assert.equal(result.cutoverAuthorized, false);
  assert.equal(JSON.stringify(result).includes(digest), false);
});

test('mismatching local bytes or length cannot pass', () => {
  for (const localBytes of [Buffer.from('x'), Buffer.from('pinned single emitted scripu')]) {
    const result = compare({ snapshot, localBytes });
    assert.equal(result.status, 'script_scoped_byte_mismatch');
    assert.equal(result.scriptScopedByteEquality, false);
    assert.equal(result.cutoverAuthorized, false);
  }
});

test('unverified or fabricated snapshot flags fail closed', () => {
  for (const altered of [
    { ...snapshot, status: 'unverified' },
    { ...snapshot, versionBoundContent: true },
    { ...snapshot, sourceBytesVerified: true },
    { ...snapshot, remotelyAttested: true },
    { ...snapshot, cutoverAuthorized: true },
    { ...snapshot, contentSha256: 'not-a-hash' },
    { ...snapshot, contentBytes: 0 },
    { ...snapshot, contentBytes: 8 * 1024 * 1024 + 1 },
  ]) {
    const result = compare({ snapshot: altered, localBytes: bytes });
    assert.equal(result.status, 'unverified');
    assert.equal(result.scriptScopedByteEquality, false);
    assert.equal(result.cutoverAuthorized, false);
  }
});

test('wrong input type, empty and oversized local buffers are rejected', () => {
  for (const localBytes of ['string', Buffer.alloc(0), Buffer.alloc(8 * 1024 * 1024 + 1)]) {
    assert.equal(compare({ snapshot, localBytes }).status, 'unverified');
  }
});
