#!/usr/bin/env node
'use strict';
// Read-only installed package evidence. No patch or advisory dismissal.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const record = lock.packages['node_modules/expo/node_modules/@expo/cli'];
assert.equal(record?.version, '57.0.32', 'Re-review on Expo CLI update');
const cli = path.join(root, 'node_modules/expo/node_modules/@expo/cli');
const pkg = JSON.parse(fs.readFileSync(path.join(cli, 'package.json'), 'utf8'));
assert.equal(pkg.version, record.version);
assert.match(pkg.dependencies.zod, /^\^3\./);
const relative = 'build/src/start/server/DevToolsPluginCliExtensionResults.js';
const sourceFile = path.join(cli, relative);
const bytes = fs.readFileSync(sourceFile);
const source = bytes.toString('utf8');
assert.ok(source.includes('DevToolsPluginOutputSchema') && source.includes('safeParse'),
  'Installed Zod output parse chain changed');
assert.ok(source.includes('JSON.parse'), 'Installed JSON parser chain changed');
assert.ok(source.includes('MAX_OUTPUT_LENGTH'), 'Installed string-length guard changed');
const report = {
  advisory: 'GHSA-mrhx-c7xc-m3w5',
  status: 'source-evidence-only-not-remediated',
  expoCliVersion: pkg.version,
  zodConstraint: pkg.dependencies.zod,
  path: relative,
  byteLength: bytes.length,
  sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  findings: ['plugin output JSON is parsed and Zod-validated', 'V8 string-length guard exists'],
  limitations: ['No patched bytes yet', 'No proof of remote attacker reachability', 'Do not close Dependabot #142'],
};
console.log(JSON.stringify(report, null, 2));
