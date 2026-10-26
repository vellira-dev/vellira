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
assert.equal(sha(bytes), ORIGINAL, 'Unrecognized Expo CLI bytes: refuse modification');
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
assert.notEqual(updated, source);
const PATCHED = 'afc4eb1ed0a9b3c119d2a07cc15eb038ef306e7165e0ca77717caa1d7ad84ab9';
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
assert.deepEqual(longInput.getOutput().map(x => x.text), ['Plugin output limit exceeded']);
const many = new Collector();
many.append(JSON.stringify(Array.from({length:129}, () => ({type:'text', text:'x', level:'info'}))));
assert.deepEqual(many.getOutput().map(x => x.text), ['Too many output items']);
const malformed = new Collector();
malformed.append('hello');
assert.equal(malformed.getOutput()[0].text, 'hello');
const report = { version: manifest.version, originalSha256: ORIGINAL, patchedSha256: PATCHED, integrityVerified: true, sourceUnmodified: true, candidateOnly: true };
assert.ok(!process.argv.includes('--apply'), 'Candidate is diagnostic only; applying would not enforce protection');
console.log(JSON.stringify(report, null, 2));
