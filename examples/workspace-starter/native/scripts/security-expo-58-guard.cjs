#!/usr/bin/env node
'use strict';
// Expo CLI 58.1.19: published @expo/schema-utils validator (no Zod).
// Preserve Vellira's stricter 64 KiB cumulative UTF-8 and 128-item limits.
// npm ci validates package tarball SRI; this guard pins the reviewed parser
// source SHA-256 and fails closed when installed bytes or package identities drift.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'node_modules/expo/node_modules/@expo/cli/build/src/start/server/devtools/DevToolsPluginCliExtensionResults.js');
const metadataPath = path.join(root, 'node_modules/expo/node_modules/@expo/cli/package.json');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// Attested against the exact clean npm CI install and published CLI tarball
// verified with the package-lock SRI (GitHub Action run 41349253964).
const APPROVED_SOURCE_SHA256 = 'b1b370abd2c05a281a7fa8bc8600702002bc69bf4079026bdf12b074a1ee60fa';
const EXPECTED_INTEGRITY = 'sha512-zoLhSlFnln0xn1fiW0+kb1J0lNv06HAy+FQ27HHwEEWoAClCE13FnTQBOW5bOVYc3c7hsGM8ypKcZGS7RGqjQA==';
const LOCKED_CLI = 'node_modules/expo/node_modules/@expo/cli';
assert.equal(metadata.version, '58.1.19', 'Unsupported Expo CLI: source review required');
assert.equal(lock.packages[LOCKED_CLI]?.version, '58.1.19');
assert.equal(lock.packages[LOCKED_CLI]?.integrity, EXPECTED_INTEGRITY);
assert.equal(lock.packages['node_modules/expo']?.version, '58.0.24');
assert.equal(lock.packages['node_modules/@expo/metro-config']?.version, '58.0.21');
assert.equal(lock.packages['node_modules/react-native']?.version, '0.88.1');
assert.equal(lock.packages['node_modules/@expo/schema-utils']?.version, '58.0.3');
assert.equal(lock.packages['node_modules/node-forge']?.version, '1.4.2');
assert.equal(metadata.dependencies.zod, undefined, 'Expo CLI still depends on vulnerable Zod');
assert.ok(metadata.dependencies['@expo/schema-utils'], 'Expected published JSON Schema validator');
const zodPaths = Object.keys(lock.packages).filter((p) => /(^|\/)node_modules\/zod$/.test(p));
assert.deepEqual(zodPaths, [], 'An installed vulnerable Zod path remains in the lockfile');

const MARKER = '\n/* VELLIRA_EXPO58_SCHEMA_OUTPUT_GUARD_V3 */';
const PATCH = "\n/* VELLIRA_EXPO58_SCHEMA_OUTPUT_GUARD_V3 */\n;(() => {\n  const Collector = exports.DevToolsPluginCliExtensionResults;\n  if (typeof Collector !== 'function' ||\n      typeof Collector.prototype.append !== 'function' ||\n      typeof Collector.prototype.parseOutputText !== 'function') {\n    throw new Error('Vellira Expo 58 collector contract changed');\n  }\n  const originalParse = Collector.prototype.parseOutputText;\n  const MAX_BYTES = 65536;\n  const MAX_ITEMS = 128;\n  function truncate(reason) {\n    this._truncated = true;\n    // The diagnostic is part of the total 128-item budget. If the prior\n    // output already filled the budget, do not append or emit a 129th item.\n    if (this._output.length < MAX_ITEMS) {\n      const message = {type: 'text', text: reason, level: 'error'};\n      this._output.push(message);\n      this.onOutput?.([message]);\n    }\n  }\n  Collector.prototype.append = function(output, level = 'info') {\n    if (this._truncated) return;\n    if (typeof output !== 'string') throw new TypeError('Plugin output must be a string');\n    const bytes = Buffer.byteLength(output, 'utf8');\n    const total = this._velliraReceivedBytes || 0;\n    if (total + bytes > MAX_BYTES) {\n      truncate.call(this, 'Plugin cumulative output limit exceeded');\n      return;\n    }\n    this._velliraReceivedBytes = total + bytes;\n    const remaining = MAX_ITEMS - this._output.length;\n    // Reject large batches before the upstream JSON Schema validator allocates\n    // output objects. It is conservative for malformed schema arrays.\n    let parsed;\n    let isJson = false;\n    try {\n      parsed = JSON.parse(output);\n      isJson = true;\n    } catch {}\n    if (isJson && Array.isArray(parsed) && parsed.length > remaining) {\n      truncate.call(this, 'Too many output items');\n      return;\n    }\n    // Expo turns plain-text lines into one object per nonempty line. Count\n    // these BEFORE allocating objects, including across stdout/stderr calls.\n    if (!isJson) {\n      let count = 0;\n      let start = 0;\n      for (let i = 0; i <= output.length; i++) {\n        if (i === output.length || output[i] === '\\n') {\n          if (i > start && ++count > remaining) {\n            truncate.call(this, 'Too many output items');\n            return;\n          }\n          start = i + 1;\n        }\n      }\n    }\n    const results = originalParse.call(this, output, level);\n    if (!Array.isArray(results)) throw new Error('Expo parser output contract changed');\n    if (results.length > remaining) {\n      truncate.call(this, 'Too many output items');\n      return;\n    }\n    this._totalLength += output.length;\n    this._output.push(...results);\n    this.onOutput?.(results);\n  };\n})();\n";
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
const malformed = new Collector();
malformed.append('hello');
assert.equal(malformed.getOutput()[0]?.text, 'hello');
const oversized = new Collector();
oversized.append('x'.repeat(65537));
assert.equal(oversized.isTruncated(), true, 'Missing 64 KiB input bound');
assert.deepEqual(oversized.getOutput().map((o) => o.text), ['Plugin cumulative output limit exceeded']);
const many = new Collector();
many.append(JSON.stringify(Array.from({length: 129}, () => ({type: 'text', text: 'x', level: 'info'}))));
assert.equal(many.isTruncated(), true);
assert.deepEqual(many.getOutput().map((o) => o.text), ['Too many output items']);

// Regression: item budget is TOTAL across chunks, not per JSON array.
const item = {type: 'text', text: 'x', level: 'info'};
const chunk128 = JSON.stringify(Array.from({length: 128}, () => item));
assert.ok(Buffer.byteLength(chunk128, 'utf8') * 2 < 65536);
const callbacks = [];
const chunked = new Collector((items) => callbacks.push(items));
chunked.append(chunk128);
assert.equal(chunked.getOutput().length, 128);
chunked.append(chunk128, 'error');
assert.equal(chunked.isTruncated(), true, '128+128 messages must truncate');
assert.equal(chunked.getOutput().length, 128, 'No 129th diagnostic is allowed');
assert.equal(callbacks.flat().length, 128, 'Callbacks must also respect the item ceiling');
chunked.append('ignored');
assert.equal(chunked.getOutput().length, 128);
assert.equal(callbacks.length, 1, 'No callback after truncation at a full budget');

// Before the limit fills, emit one bounded diagnostic and stop.
const chunksWithRoom = new Collector();
chunksWithRoom.append(JSON.stringify(Array.from({length: 100}, () => item)), 'info');
chunksWithRoom.append(JSON.stringify(Array.from({length: 29}, () => item)), 'error');
assert.equal(chunksWithRoom.isTruncated(), true);
assert.equal(chunksWithRoom.getOutput().length, 101);
assert.equal(chunksWithRoom.getOutput().at(-1).text, 'Too many output items');

// Regression: text fallback can fan out into thousands of objects under 64KiB.
const textCallbacks = [];
const manyLines = new Collector((items) => textCallbacks.push(...items));
manyLines.append('x\n'.repeat(30000), 'error');
assert.equal(manyLines.isTruncated(), true, 'Short plain-text lines must be capped');
assert.deepEqual(manyLines.getOutput().map((o) => o.text), ['Too many output items']);
assert.equal(textCallbacks.length, 1, 'No unbounded line callback allocation');

// stdout and stderr share the same global item limit.
const mixed = new Collector();
mixed.append('hello\n'.repeat(100), 'info');
mixed.append('error\n'.repeat(29), 'error');
assert.equal(mixed.isTruncated(), true);
assert.equal(mixed.getOutput().length, 101);
assert.equal(mixed.getOutput().at(-1).text, 'Too many output items');

// Both limits preserve a true exact-boundary success.
const boundary = new Collector();
boundary.append('a'.repeat(65536));
assert.equal(boundary.isTruncated(), false);
boundary.append('b');
assert.equal(boundary.isTruncated(), true);
assert.ok(boundary.getOutput().length <= 128);
const unicode = new Collector();
unicode.append('é'.repeat(24000));
unicode.append('é'.repeat(12000));
assert.equal(unicode.isTruncated(), true, 'UTF-8 multibyte byte-budget bypass');
assert.ok(unicode.getOutput().length <= 128);
console.log(JSON.stringify({
  status: 'verified-published-expo-cli-schema-validator-and-bounded-output',
  cli: metadata.version, originalSha256, installedSha256: sha256(fs.readFileSync(sourcePath)),
  zodPaths: zodPaths.length, cumulativeBytesMax: 65536, outputItemsMax: 128
}, null, 2));
