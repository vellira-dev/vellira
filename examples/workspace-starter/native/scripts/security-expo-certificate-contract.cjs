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

const intermediateKeys=forge.pki.rsa.generateKeyPair({bits:1024,e:65537});
const intermediate=forge.pki.createCertificate();
intermediate.publicKey=intermediateKeys.publicKey;
intermediate.serialNumber='02';
intermediate.validity.notBefore=new Date(Date.now()-60000);
intermediate.validity.notAfter=new Date(Date.now()+60000);
intermediate.setSubject([{name:'commonName',value:'vellira-intermediate'}]);
intermediate.setIssuer(certificate.subject.attributes);
intermediate.setExtensions([{name:'basicConstraints',cA:true},{name:'keyUsage',keyCertSign:true}]);
intermediate.sign(keys.privateKey,forge.md.sha256.create());
const leafKeys=forge.pki.rsa.generateKeyPair({bits:1024,e:65537});
const leaf=forge.pki.createCertificate();
leaf.publicKey=leafKeys.publicKey;
leaf.serialNumber='03';
leaf.validity.notBefore=new Date(Date.now()-60000);
leaf.validity.notAfter=new Date(Date.now()+60000);
leaf.setSubject([{name:'commonName',value:'vellira-development-leaf'}]);
leaf.setIssuer(intermediate.subject.attributes);
leaf.setExtensions([{name:'basicConstraints',cA:false},{name:'keyUsage',digitalSignature:true},{name:'extKeyUsage',codeSigning:true}]);
leaf.sign(intermediateKeys.privateKey,forge.md.sha256.create());
const store=forge.pki.createCaStore([certificate]);
assert.doesNotThrow(()=>forge.pki.verifyCertificateChain(store,[leaf,intermediate]));
const bad=forge.pki.certificateFromPem(forge.pki.certificateToPem(leaf));
bad.signature=String.fromCharCode(bad.signature.charCodeAt(0)^1)+bad.signature.slice(1);
assert.throws(()=>forge.pki.verifyCertificateChain(store,[bad,intermediate]));

console.log(JSON.stringify({
  result: 'PASS', scope: 'synthetic-root-intermediate-leaf-chain',
  positive: ['valid-self-signed-certificate', 'signed-manifest-buffer'],
  negative: ['tampered-certificate-signature', 'mismatched-key-pair'],
  notProven: ['Expo-EAS-network-certificate-chain', 'attacker-reachability', 'Zod-advisory', 'node-forge-upstream-release'],
}, null, 2));
