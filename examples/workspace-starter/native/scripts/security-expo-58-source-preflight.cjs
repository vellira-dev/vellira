#!/usr/bin/env node
'use strict';
// Expo 58 read-only source-shape gate. No runtime modification or claimed remediation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dir = process.argv[2];
assert.ok(dir && path.isAbsolute(dir), 'Supply absolute isolated Expo 58 candidate path');
const cli = path.join(dir, 'node_modules/expo/node_modules/@expo/cli');
const meta = JSON.parse(fs.readFileSync(path.join(cli,'package.json'),'utf8'));
assert.equal(meta.version, '58.1.15');
assert.equal(meta.dependencies.zod, '^3.25.76');
const file = path.join(cli,'build/src/start/server/DevToolsPluginCliExtensionResults.js');
const raw = fs.readFileSync(file);
const originalHash = crypto.createHash('sha256').update(raw).digest('hex');
assert.equal(originalHash, '669294947c9a2573b9c637eba5d0d5cd4048fa8da16723a7f761d1cb2eb2d7e7');
const source = raw.toString('utf8');
const checks = {
  collector: /class DevToolsPluginCliExtensionResults/.test(source),
  append: /append\(output/.test(source),
  json: /JSON\.parse\(txt\)/.test(source),
  zod: /DevToolsPluginOutputSchema\.safeParse/.test(source),
};
assert.ok(Object.values(checks).every(Boolean),'Expo 58 parser source structure changed');
const output = {status:'source-shape-only-not-remediation',expoCli:meta.version,originalHash,checks,
  limitation:'Do not apply Expo 57 patched bytes to Expo 58; candidate patch and integration tests still required'};
console.log(JSON.stringify(output,null,2));
