#!/usr/bin/env node
'use strict';
// Negative integration regression: prove this candidate is NOT safe for deployment.
// Runs on installed Expo CLI only; no mutation of node_modules or dangerous payloads.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'node_modules/expo/node_modules/@expo/cli/build/src/start/server/DevToolsPluginCliExtensionResults.js');
const raw = fs.readFileSync(target);
assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),
  'ab531966e34f5009d65fab4a00204cc999580d21b921f58ef58e00c568801c02');
const original = raw.toString('utf8');
const pattern = /(\bDevToolsPluginOutputSchema\.safeParse\()\s*JSON\.parse\(txt\)\s*(\))/g;
assert.equal([...original.matchAll(pattern)].length, 1);
const candidate = original.replace(pattern, [
  '$1(() => {',
  "  if (Buffer.byteLength(txt, 'utf8') > 65536) throw new RangeError('oversized JSON');",
  '  const parsed = JSON.parse(txt);',
  "  if (!Array.isArray(parsed) || parsed.length > 128) throw new RangeError('oversized array');",
  '  return parsed;',
  '})()$2',
].join('\n'));
const load = (source) => {
  const mod = new Module(target, module);
  mod.filename = target;
  mod.paths = Module._nodeModulePaths(path.dirname(target));
  mod._compile(source, target);
  assert.equal(typeof mod.exports.DevToolsPluginCliExtensionResults, 'function');
  return mod.exports.DevToolsPluginCliExtensionResults;
};
const Original = load(original);
const Candidate = load(candidate);
const sample = JSON.stringify([{ type: 'text', text: 'ok', level: 'info' }]);
const a = new Original();
const b = new Candidate();
a.append(sample);
b.append(sample);
assert.deepEqual(b.getOutput(), a.getOutput(), 'Small valid plugin output should remain compatible');
// Small bounded test: array cardinality exceeds 128 without large memory allocation.
const rejected = JSON.stringify(Array.from({ length: 129 }, () => ({type:'text', text:'x', level:'info'})));
const result = new Candidate();
result.append(rejected);
const entries = result.getOutput();
assert.ok(entries.length > 0);
// Candidate's RangeError is caught by Expo's fallback and returns attacker-supplied text.
// This *must* be observed until a proper guard outside catch is implemented.
assert.ok(entries.some(entry => typeof entry.text === 'string' && entry.text.includes('"type":"text"')),
  'Expected to expose fallback bypass; if changed, re-review threat model');
console.log(JSON.stringify({
  result: 'candidate-rejected-fallback-bypass-confirmed',
  liveInstalledExpoCli: true,
  sourceUnmodified: true,
  tests: ['valid-json-compatibility', '129-item-array-guard-falls-through-to-plaintext'],
  securityStatus: 'unremediated',
}, null, 2));
