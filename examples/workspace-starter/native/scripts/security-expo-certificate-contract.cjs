#!/usr/bin/env node
'use strict';
// Package-exact Expo certificate API contract. Not a substitute for full Expo EAS chain validation.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(path.resolve(__dirname, '../package.json'));
const forge = req('node-forge');
const expo = req('@expo/code-signing-certificates');
const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
const certificate = forge.pki.createCertificate();
certificate.publicKey = keys.publicKey;
certificate.serialNumber = '01';
certificate.validity.notBefore = new Date(Date.now() - 60_000);
certificate.validity.notAfter = new Date(Date.now() + 60_000);
const dn = [{ name: 'commonName', value: 'vellira-isolated-expo-proof' }];
certificate.setSubject(dn);
certificate.setIssuer(dn);
certificate.setExtensions([
  { name: 'keyUsage', digitalSignature: true },
  { name: 'extKeyUsage', codeSigning: true },
]);
certificate.sign(keys.privateKey, forge.md.sha256.create());
assert.doesNotThrow(() => expo.validateSelfSignedCertificate(certificate, keys));
const message = Buffer.from('vellira-expo-certificate-signing');
const signature = expo.signBufferRSASHA256AndVerify(keys.privateKey, certificate, message);
assert.ok(typeof signature === 'string' && signature.length > 0);
const tampered = forge.pki.certificateFromPem(forge.pki.certificateToPem(certificate));
tampered.signature = String.fromCharCode(tampered.signature.charCodeAt(0) ^ 1) + tampered.signature.slice(1);
assert.throws(() => expo.validateSelfSignedCertificate(tampered, keys));
const mismatched = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
assert.throws(() => expo.validateSelfSignedCertificate(certificate, mismatched));
console.log(JSON.stringify({
  result: 'PASS', scope: 'self-signed-certificate-only',
  positive: ['valid-self-signed-certificate', 'signed-manifest-buffer'],
  negative: ['tampered-certificate-signature', 'mismatched-key-pair'],
  notProven: ['Expo-EAS-network-certificate-chain', 'attacker-reachability', 'Zod-advisory', 'node-forge-upstream-release'],
}, null, 2));
