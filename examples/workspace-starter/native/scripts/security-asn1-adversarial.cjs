#!/usr/bin/env node
'use strict';
// Diagnostic, NOT a signature forgery: this signs with a key owned by the test.
// Exercise the malformed DigestAlgorithm shape implicated by GHSA-86w9-cpqp-85rv.
// A pass means the diagnostic ran; it DOES NOT mean the advisory is fixed.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { createRequire } = require('node:module');
const forge = createRequire(path.resolve(__dirname, '../package.json'))('node-forge');

const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
const data = Buffer.from('vellira-asn1-structure-proof');
const digest = crypto.createHash('sha256').update(data).digest();
const ASN1 = forge.asn1;
const U = ASN1.Class.UNIVERSAL;
const create = (type, constructed, values) => ASN1.create(U, type, constructed, values);
const algorithm = create(ASN1.Type.SEQUENCE, true, [
  create(ASN1.Type.OID, false, ASN1.oidToDer(forge.pki.oids.sha256).getBytes()),
  create(ASN1.Type.NULL, false, ''),
  // Intentionally extra nested DigestAlgorithm child: not a valid DigestInfo.
  create(ASN1.Type.NULL, false, ''),
]);
const info = create(ASN1.Type.SEQUENCE, true, [
  algorithm,
  create(ASN1.Type.OCTETSTRING, false, digest.toString('binary')),
]);
const der = Buffer.from(ASN1.toDer(info).getBytes(), 'binary');
const rawSignature = crypto.privateEncrypt({
  key: forge.pki.privateKeyToPem(keys.privateKey),
  padding: crypto.constants.RSA_PKCS1_PADDING,
}, der);
let accepted = false;
let thrown = null;
try {
  accepted = keys.publicKey.verify(digest.toString('binary'), rawSignature.toString('binary'));
} catch (error) {
  thrown = error?.message || String(error);
}

const nonEmptyParameters = create(ASN1.Type.SEQUENCE, true, [
  create(ASN1.Type.OID, false, ASN1.oidToDer(forge.pki.oids.sha256).getBytes()),
  create(ASN1.Type.NULL, false, '\x01'),
]);
const malformedNullDigestInfo = create(ASN1.Type.SEQUENCE, true, [
  nonEmptyParameters,
  create(ASN1.Type.OCTETSTRING, false, digest.toString('binary')),
]);
const nullSignature = crypto.privateEncrypt({
  key: forge.pki.privateKeyToPem(keys.privateKey),
  padding: crypto.constants.RSA_PKCS1_PADDING,
}, Buffer.from(ASN1.toDer(malformedNullDigestInfo).getBytes(), 'binary'));
let malformedNullAccepted = false;
try {
  malformedNullAccepted = keys.publicKey.verify(digest.toString('binary'), nullSignature.toString('binary'));
} catch {
  malformedNullAccepted = false;
}

const outcome = {
  test: 'GHSA-86w9-cpqp-85rv-nested-DigestAlgorithm-structure',
  diagnosticOnly: true,
  ownsSigningPrivateKey: true,
  invalidAlgorithmChildren: 3,
  malformedSignatureAccepted: accepted,
  nonEmptyNullParametersAccepted: malformedNullAccepted,
  verifierException: thrown,
  exploitabilityNotProven: true,
};
console.log(JSON.stringify(outcome, null, 2));
assert.equal(typeof accepted, 'boolean');
assert.equal(typeof malformedNullAccepted, 'boolean');
// Future patched behavior must reject the malformed structure. This switch
// deliberately fails on unpatched node-forge 1.4.0.
if (process.argv.includes('--require-rejection')) {
  assert.equal(accepted, false, 'CVE-2026-85393: malformed DigestAlgorithm must be rejected');
  assert.equal(malformedNullAccepted, false, 'CVE-2026-85393: non-empty NULL parameters must be rejected');
}
