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
const pattern = /(\bDevToolsPluginOutputSchema\.safeParse\()\s*JSON\.parse\(txt\)\s*(\))/g;
const hits = [...source.matchAll(pattern)];
assert.equal(hits.length, 1, 'Expected exactly one installed Zod output parse call');
const replacement = [
  '$1(() => {',
  "                if (Buffer.byteLength(txt, 'utf8') > 65536) {",
  "                    throw new RangeError('Plugin JSON exceeds 64 KiB');",
  '                }',
  '                const parsed = JSON.parse(txt);',
  '                if (!Array.isArray(parsed) || parsed.length > 128) {',
  "                    throw new RangeError('Plugin JSON array exceeds 128 entries or is not an array');",
  '                }',
  '                return parsed;',
  '            })()$2',
].join('\n');
const updated = source.replace(pattern, replacement);
assert.notEqual(updated, source);
const report = { version: manifest.version, originalSha256: ORIGINAL, patchedSha256: sha(Buffer.from(updated)), candidateOnly: true };
assert.ok(!process.argv.includes('--apply'), 'Candidate is diagnostic only; applying would not enforce protection');
console.log(JSON.stringify(report, null, 2));
