#!/usr/bin/env node
'use strict';
// Expo CLI 58.1.18: published @expo/schema-utils validator (no Zod).
// Preserve Vellira's stricter 64 KiB cumulative UTF-8 and 128-item limits.
// npm ci validates package tarball SRI; this guard pins the reviewed parser
// source SHA-256 and fails closed when installed bytes or package identities drift.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'node_modules/expo/node_modules/@expo/cli/build/src/start/server/DevToolsPluginCliExtensionResults.js');
const metadataPath = path.join(root, 'node_modules/expo/node_modules/@expo/cli/package.json');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// Replaced only after inspecting the first authenticated published-tarball
// source fingerprint from CI. Until then this candidate MUST NOT pass CI.
const APPROVED_SOURCE_SHA256 = '0000000000000000000000000000000000000000000000000000000000000000';
const EXPECTED_INTEGRITY = 'sha512-voZUcir9mEwvLKBNqQM6Jy2Yp67z8ONmcINXb6ZrLMayb7yxzwvEnN0eeH8ADzUABKL288pv1eJ1WRqtYxXQ/Q==';
const LOCKED_CLI = 'node_modules/expo/node_modules/@expo/cli';
assert.equal(metadata.version, '58.1.18', 'Unsupported Expo CLI: source review required');
assert.equal(lock.packages[LOCKED_CLI]?.version, '58.1.18');
assert.equal(lock.packages[LOCKED_CLI]?.integrity, EXPECTED_INTEGRITY);
assert.equal(lock.packages['node_modules/expo']?.version, '58.0.22');
assert.equal(lock.packages['node_modules/@expo/metro-config']?.version, '58.0.20');
assert.equal(lock.packages['node_modules/react-native']?.version, '0.88.1');
assert.equal(lock.packages['node_modules/@expo/schema-utils']?.version, '58.0.3');
assert.equal(lock.packages['node_modules/node-forge']?.version, '1.4.2');
assert.equal(metadata.dependencies.zod, undefined, 'Expo CLI still depends on vulnerable Zod');
assert.ok(metadata.dependencies['@expo/schema-utils'], 'Expected published JSON Schema validator');
const zodPaths = Object.keys(lock.packages).filter((p) => /(^|\/)node_modules\/zod$/.test(p));
assert.deepEqual(zodPaths, [], 'An installed vulnerable Zod path remains in the lockfile');

const MARKER = '\n/* VELLIRA_EXPO58_SCHEMA_OUTPUT_GUARD_V2 */';
const PATCH = "\n/* VELLIRA_EXPO58_SCHEMA_OUTPUT_GUARD_V2 */\n;(() => {\n  const Collector = exports.DevToolsPluginCliExtensionResults;\n  if (typeof Collector !== 'function' ||\n      typeof Collector.prototype.append !== 'function' ||\n      typeof Collector.prototype.parseOutputText !== 'function') {\n    throw new Error('Vellira Expo 58 collector contract changed');\n  }\n  const originalAppend = Collector.prototype.append;\n  const originalParse = Collector.prototype.parseOutputText;\n  Collector.prototype.append = function(output, level) {\n    if (this._truncated) return;\n    if (typeof output !== 'string') throw new TypeError('Plugin output must be a string');\n    const bytes = Buffer.byteLength(output, 'utf8');\n    if ((this._velliraReceivedBytes || 0) + bytes > 65536) {\n      this._truncated = true;\n      const message = {type: 'text', text: 'Plugin cumulative output limit exceeded', level: 'error'};\n      this._output.push(message);\n      if (typeof this.onOutput === 'function') this.onOutput([message]);\n      return;\n    }\n    this._velliraReceivedBytes = (this._velliraReceivedBytes || 0) + bytes;\n    return originalAppend.call(this, output, level);\n  };\n  Collector.prototype.parseOutputText = function(txt, level) {\n    let parsed;\n    try { parsed = JSON.parse(txt); } catch {\n      return originalParse.call(this, txt, level);\n    }\n    if (Array.isArray(parsed) && parsed.length > 128) {\n      return [{type: 'text', text: 'Too many output items', level: 'error'}];\n    }\n    return originalParse.call(this, txt, level);\n  };\n})();\n";
const bytes = fs.readFileSync(sourcePath, 'utf8');
const markerAt = bytes.indexOf(MARKER);
const original = markerAt < 0 ? bytes : bytes.slice(0, markerAt);
const alreadyPatched = markerAt >= 0;
assert.ok(!alreadyPatched || bytes === original + PATCH,
  'Unexpected or tampered Expo CLI guard bytes');
for (const token of [
  '@expo/schema-utils',
  'DevToolsPluginCliExtensionResults',
  'DevToolsPluginOutputSchema',
  'MAX_OUTPUT_LENGTH',
  '_totalLength',
  'parseOutputText',
  'JSON.parse(txt)'
]) {
  assert.ok(original.includes(token), 'Unrecognized Expo CLI source shape: ' + token);
}
assert.ok(!original.includes('DevToolsPluginOutputSchema.safeParse'),
  'Old Zod parsing remains in the installed CLI');
const originalSha256 = sha256(Buffer.from(original));
if (process.argv.includes('--report-source-hash')) {
  console.log(JSON.stringify({
    status: 'fingerprint-only-not-remediated',
    cli: metadata.version,
    originalSha256,
    expectedSha256: APPROVED_SOURCE_SHA256,
    installedIntegrity: EXPECTED_INTEGRITY,
    patched: alreadyPatched
  }, null, 2));
  process.exit(0);
}
assert.equal(originalSha256, APPROVED_SOURCE_SHA256,
  'Expo CLI parser source is not the approved published SHA-256; observed=' + originalSha256);
const apply = process.argv.includes('--apply');
const verify = process.argv.includes('--verify');
assert.ok(apply !== verify, 'Pass exactly one of --apply or --verify');
if (verify) {
  assert.ok(alreadyPatched, 'Unpatched Expo CLI: apply source-pinned output guard');
} else if (!alreadyPatched) {
  const temporary = sourcePath + '.vellira-' + process.pid + '.tmp';
  try {
    fs.writeFileSync(temporary, original + PATCH, {mode: fs.statSync(sourcePath).mode});
    fs.renameSync(temporary, sourcePath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
assert.equal(fs.readFileSync(sourcePath, 'utf8'), original + PATCH,
  'Installed Expo CLI guard differs from verified candidate');

// Exercise the *installed* module after applying the patch, not an isolated copy.
delete require.cache[sourcePath];
const Collector = require(sourcePath).DevToolsPluginCliExtensionResults;
assert.equal(typeof Collector, 'function');
const valid = new Collector();
valid.append(JSON.stringify([{type: 'text', text: 'ok', level: 'info'}]));
assert.equal(valid.getOutput()[0]?.text, 'ok');
const oversized = new Collector();
oversized.append('x'.repeat(65537));
assert.equal(oversized.isTruncated(), true, 'Missing 64 KiB input bound');
assert.deepEqual(oversized.getOutput().map((o) => o.text), ['Plugin cumulative output limit exceeded']);
const many = new Collector();
many.append(JSON.stringify(Array.from({length: 129}, () => ({type: 'text', text: 'x', level: 'info'}))));
assert.deepEqual(many.getOutput().map((o) => o.text), ['Too many output items']);
const boundary = new Collector();
boundary.append('a'.repeat(65536));
assert.equal(boundary.isTruncated(), false);
boundary.append('b');
assert.equal(boundary.isTruncated(), true);
const unicode = new Collector();
unicode.append('é'.repeat(24000));
unicode.append('é'.repeat(12000));
assert.equal(unicode.isTruncated(), true, 'UTF-8 multibyte bound bypass');
console.log(JSON.stringify({
  status: 'verified-published-expo-cli-schema-validator-and-bounded-output',
  cli: metadata.version, originalSha256, installedSha256: sha256(fs.readFileSync(sourcePath)),
  zodPaths: zodPaths.length, cumulativeBytesMax: 65536, outputItemsMax: 128
}, null, 2));
