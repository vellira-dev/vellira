import assert from 'node:assert/strict';
import test from 'node:test';

import { fingerprintNewsletterOwnerBundle } from './newsletter-owner-local-bundle-fingerprint.mjs';

const bytes = (value) => Buffer.from(value, 'utf8');
const fixture = () => [
  { path: 'index.mjs', bytes: bytes('export default 42;') },
  { path: 'nested/worker.js', bytes: bytes('export const a = 1;') },
];

test('deterministic owner fingerprint is independent of input listing order', () => {
  const first = fingerprintNewsletterOwnerBundle(fixture());
  const reversed = fingerprintNewsletterOwnerBundle(fixture().reverse());
  assert.deepEqual(first, reversed);
  assert.match(first.bundleSha256, /^[a-f0-9]{64}$/);
  assert.equal(first.javascriptFileCount, 2);
  assert.equal(first.javascriptBytes, 37);
  assert.equal(first.remotelyAttested, false);
  assert.equal(first.cutoverAuthorized, false);
});

test('changed bytes, filenames and file boundaries change the owner fingerprint', () => {
  const reference = fingerprintNewsletterOwnerBundle(fixture()).bundleSha256;
  for (const mutate of [
    (items) => { items[0].bytes = bytes('export default 43;'); },
    (items) => { items[0].path = 'other.mjs'; },
    (items) => { items[1].bytes = bytes('export const a = 1;\n'); },
    (items) => { items.push({ path: 'new.js', bytes: bytes('a') }); },
  ]) {
    const items = fixture();
    mutate(items);
    assert.notEqual(fingerprintNewsletterOwnerBundle(items).bundleSha256, reference);
  }
});

test('duplicate paths, traversal, empty bundles and non-byte values fail closed', () => {
  const invalid = [
    [],
    [{ path: '../secret.js', bytes: bytes('a') }],
    [{ path: '/absolute.js', bytes: bytes('a') }],
    [{ path: './relative.js', bytes: bytes('a') }],
    [{ path: 'other.txt', bytes: bytes('a') }],
    [{ path: 'a.js', bytes: bytes('') }],
    [{ path: 'a.js', bytes: 'a' }],
    [{ path: 'x.js', bytes: bytes('a') }, { path: 'x.js', bytes: bytes('b') }],
  ];
  for (const input of invalid) assert.throws(
    () => fingerprintNewsletterOwnerBundle(input)
  );
});
