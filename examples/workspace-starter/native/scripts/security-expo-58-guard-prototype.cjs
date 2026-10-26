#!/usr/bin/env node
'use strict';
// Read-only Expo 58 migration guard prototype; no postinstall integration yet.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = process.argv[2];
assert.ok(root && path.isAbsolute(root), 'Isolated Expo 58 absolute root required');
const target = path.join(root, 'node_modules/expo/node_modules/@expo/cli/build/src/start/server/DevToolsPluginCliExtensionResults.js');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/expo/node_modules/@expo/cli/package.json'), 'utf8'));
assert.equal(manifest.version, '58.1.15');
assert.match(manifest.dependencies.zod, /^\^3\./);
const ORIGINAL = '669294947c9a2573b9c637eba5d0d5cd4048fa8da16723a7f761d1cb2eb2d7e7';
const sha = b => createHash('sha256').update(b).digest('hex');
const bytes = fs.readFileSync(target);
const currentHash = sha(bytes);
const PATCHED = '785a3fd76070b3f59a1ca2369c89bd4195f07eec772c6870241dc175b44b1600';
assert.ok([ORIGINAL, PATCHED].includes(currentHash),
  'Unrecognized Expo CLI bytes: refuse modification');
if (currentHash === PATCHED) {
  assert.ok(process.argv.includes('--verify') || process.argv.includes('--apply'),
    'Already patched; pass --verify or --apply');
  console.log(JSON.stringify({ patchedSha256: PATCHED, alreadyPatched: true }, null, 2));
  process.exit(0);
}
assert.ok(!process.argv.includes('--verify'), 'Unpatched Expo CLI: patch required');
const source = bytes.toString('utf8');
const entry = /(parseOutputText\(txt(?:,\s*[^)]*)?\)\s*\{)/g;
const entryMatches = [...source.matchAll(entry)];
if (entryMatches.length !== 1) {
  const at = source.indexOf('parseOutputText');
  const excerpt = at < 0 ? '<missing>' : source.slice(Math.max(0, at - 180), at + 400);
  throw new Error('Installed Expo parser entry mismatch; matches=' + entryMatches.length + '; excerpt=' + JSON.stringify(excerpt));
}
let updated = source.replace(entry, '$1\n        if (Buffer.byteLength(txt, "utf8") > 65536) return [{ type: "text", text: "Plugin output limit exceeded", level: "error" }];');
const parse = /DevToolsPluginOutputSchema\.safeParse\(JSON\.parse\(txt\)\)/g;
assert.equal([...updated.matchAll(parse)].length, 1);
const zodEntry = /const\s+result\s*=\s*([^;\n]*DevToolsPluginOutputSchema\.safeParse\(JSON\.parse\(txt\)\));/g;
assert.equal([...updated.matchAll(zodEntry)].length, 1, 'Expected one Zod result assignment');
updated = updated.replace(zodEntry, (_match, call) => [
  'const parsed = JSON.parse(txt);',
  'if (Array.isArray(parsed) && parsed.length > 128) return [{ type: "text", text: "Too many output items", level: "error" }];',
  'const result = ' + call.replace('JSON.parse(txt)', 'parsed') + ';',
].join(String.fromCharCode(10)));
const appendEntry = /(append\(output(?:,\s*[^)]*)?\)\s*\{)/g;
assert.equal([...updated.matchAll(appendEntry)].length, 1, 'Installed append signature changed');
updated = updated.replace(appendEntry, [
  '$1',
  'if (this._truncated) return;',
  'if ((this._velliraOutputBytes || 0) + Buffer.byteLength(output, "utf8") > 65536) {',
  '  this._truncated = true;',
  '  const message = { type: "text", text: "Plugin cumulative output limit exceeded", level: "error" };',
  '  this._output.push(message);',
  '  this.onOutput?.([message]);',
  '  return;',
  '}',
  'this._velliraOutputBytes = (this._velliraOutputBytes || 0) + Buffer.byteLength(output, "utf8");',
].join(String.fromCharCode(10)));
assert.notEqual(updated, source);
assert.notEqual(sha(Buffer.from(updated + '\\n// tampered')), PATCHED,
  'Tampered output must not match pinned bytes');
const nextHash = sha(Buffer.from(updated));
console.log('Expo transformed candidate SHA-256: ' + nextHash);
assert.equal(nextHash, PATCHED, 'Expo 58 candidate hash changed; review source before proceeding');
assert.equal([...updated.matchAll(entry)].length, 1, 'Patched parser must retain one entrypoint');
assert.equal([...updated.matchAll(zodEntry)].length, 0, 'Original unbounded Zod call must be replaced');
assert.equal([...updated.matchAll(/Plugin output limit exceeded/g)].length, 1);
assert.equal([...updated.matchAll(/Too many output items/g)].length, 1);
assert.equal(sha(fs.readFileSync(target)), ORIGINAL, 'Source must remain untouched');
const Module = require('node:module');
const runtime = new Module(target, module);
runtime.filename = target;
runtime.paths = Module._nodeModulePaths(path.dirname(target));
runtime._compile(updated, target);
const Collector = runtime.exports.DevToolsPluginCliExtensionResults;
assert.equal(typeof Collector, 'function');
const valid = new Collector();
valid.append(JSON.stringify([{type:'text', text:'ok', level:'info'}]));
assert.equal(valid.getOutput()[0].text, 'ok');
const longInput = new Collector();
longInput.append('x'.repeat(65537));
assert.deepEqual(longInput.getOutput().map(x => x.text), ['Plugin cumulative output limit exceeded']);
assert.equal(longInput.isTruncated(), true);
const many = new Collector();
many.append(JSON.stringify(Array.from({length:129}, () => ({type:'text', text:'x', level:'info'}))));
assert.deepEqual(many.getOutput().map(x => x.text), ['Too many output items']);
const malformed = new Collector();
malformed.append('hello');
assert.equal(malformed.getOutput()[0].text, 'hello');
// Verify cumulative streaming budget over multiple independently valid chunks.
const stream = new Collector();
const piece = 's'.repeat(32768);
for (let i = 0; i < 4; i += 1) stream.append(piece);
const accumulatedTextBytes = stream.getOutput().reduce((sum, item) =>
  sum + (item.level === 'error' && item.text === 'Plugin cumulative output limit exceeded' ? 0 : Buffer.byteLength(item.text || '', 'utf8')), 0);
assert.ok(accumulatedTextBytes <= 65536, 'Cumulative bytes exceeded budget');
assert.equal(stream.isTruncated(), true);
assert.equal(stream.getOutput().at(-1).text, 'Plugin cumulative output limit exceeded');
const oldCount = stream.getOutput().length;
stream.append('ignored');
assert.equal(stream.getOutput().length, oldCount, 'Collector accepted output after truncation');
const unicode = new Collector();
unicode.append('é'.repeat(24000));
unicode.append('é'.repeat(12000));
assert.equal(unicode.isTruncated(), true, 'UTF-8 byte budget bypassed by multibyte output');
assert.deepEqual(unicode.getOutput().map(item => item.text), [
  'é'.repeat(24000), 'Plugin cumulative output limit exceeded',
]);
const exact = new Collector();
exact.append('a'.repeat(65536));
assert.equal(exact.isTruncated(), false, 'Exact boundary should be allowed');
exact.append('b');
assert.equal(exact.isTruncated(), true, 'One byte past boundary should truncate');
const report = { version: manifest.version, originalSha256: ORIGINAL, patchedSha256: PATCHED, integrityVerified: true, sourceUnmodified: true, candidateOnly: true, cumulativeGuardEnforced: true, accumulatedTextBytes };
assert.ok(!process.argv.includes('--apply'), 'Isolated migration candidate must remain read-only');
assert.equal(sha(fs.readFileSync(target)), ORIGINAL, 'Installed Expo 58 source modified unexpectedly');
console.log(JSON.stringify({ ...report, patchedSha256: nextHash, candidateOnly: true }, null, 2));
