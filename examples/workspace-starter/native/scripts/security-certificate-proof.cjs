#!/usr/bin/env node
'use strict';

// Diagnostic only. A valid/tampered RSA signature smoke test does NOT prove
// GHSA-86w9-cpqp-85rv (nested DigestAlgorithm structure) is fixed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const requireFromStarter = createRequire(path.join(root, 'package.json'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const locked = (name) => {
  const record = lock.packages['node_modules/' + name];
  assert.ok(record?.version, 'Missing exact lockfile package: ' + name);
  return record.version;
};

assert.equal(locked('node-forge'), '1.4.0');
assert.equal(locked('zod'), '3.25.76');
assert.equal(locked('@expo/code-signing-certificates'), '0.0.7');

const forge = requireFromStarter('node-forge');
const certificates = requireFromStarter('@expo/code-signing-certificates');
assert.equal(typeof certificates.validateSelfSignedCertificate, 'function');
assert.equal(typeof certificates.signBufferRSASHA256AndVerify, 'function');

const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
const sha256 = (message) => forge.md.sha256.create().update(message, 'utf8');
const signature = keys.privateKey.sign(sha256('vellira-native-proof'));
assert.equal(
  keys.publicKey.verify(sha256('vellira-native-proof').digest().getBytes(), signature),
  true,
  'Expected valid local signature to verify'
);

let rejected = false;
try {
  rejected = keys.publicKey.verify(
    sha256('vellira-native-proof-tampered').digest().getBytes(),
    signature
  ) === false;
} catch {
  rejected = true;
}
assert.equal(rejected, true, 'A modified message must fail RSA verification');

const summary = {
  status: 'diagnostic-pass-not-remediated',
  lock: {
    forge: locked('node-forge'),
    zod: locked('zod'),
    certificates: locked('@expo/code-signing-certificates'),
  },
  checks: ['exact-locked-packages', 'code-signing-entrypoints', 'rsa-valid-signature', 'rsa-modified-message-rejected'],
  unproven: ['nested-DigestAlgorithm-RSA-adversarial-case', 'attacker-controlled-input-reachability', 'zod-oversized-collection-case'],
};
console.log(JSON.stringify(summary, null, 2));
