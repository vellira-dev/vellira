#!/usr/bin/env node
'use strict';
// Candidate only. NOT wired to postinstall. Exact source and version are pinned.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'node_modules/expo/node_modules/@expo/cli/build/src/start/server/DevToolsPluginCliExtensionResults.js');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/expo/node_modules/@expo/cli/package.json'), 'utf8'));
assert.equal(manifest.version, '57.0.32');
assert.match(manifest.dependencies.zod, /^\^3\./);
const ORIGINAL = 'ab531966e34f5009d65fab4a00204cc999580d21b921f58ef58e00c568801c02';
const sha = b => createHash('sha256').update(b).digest('hex');
const bytes = fs.readFileSync(target);
const currentHash = sha(bytes);
const PATCHED = 'e9f9417dac2440cdbea5354b8464769c56428bac9eef99ac00243e8d21e01791';
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
  'if (this._totalLength + output.length > 65536) {',
  '  this._truncated = true;',
  '  const message = { type: "text", text: "Plugin cumulative output limit exceeded", level: "error" };',
  '  this._output.push(message);',
  '  this.onOutput?.([message]);',
  '  return;',
  '}',
].join(String.fromCharCode(10)));
assert.notEqual(updated, source);
assert.equal(sha(Buffer.from(updated)), PATCHED, 'Unexpected candidate output bytes');
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
// Negative streaming proof: each chunk is within the per-append limit, yet
// the collector accepts more than the proposed total budget across chunks.
// This must be addressed before enabling a runtime patch.
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
const report = { version: manifest.version, originalSha256: ORIGINAL, patchedSha256: PATCHED, integrityVerified: true, sourceUnmodified: true, candidateOnly: true, cumulativeGuardEnforced: true, accumulatedTextBytes };
if (process.argv.includes('--apply')) {
  const tmp = target + '.vellira-' + process.pid + '.tmp';
  try {
    fs.writeFileSync(tmp, updated, { mode: fs.statSync(target).mode });
    fs.renameSync(tmp, target);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
  assert.equal(sha(fs.readFileSync(target)), PATCHED, 'Patched file integrity mismatch');
}
console.log(JSON.stringify(report, null, 2));
