#!/usr/bin/env node
'use strict';
// Bounded, read-only investigation. Do not run unbounded/large memory-exhaustion payloads.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(root, 'package.json'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const installed = req('zod');
const meta = req('zod/package.json');
const cli = lock.packages['node_modules/expo/node_modules/@expo/cli'];
assert.ok(cli?.dependencies?.zod, 'Expo CLI must declare Zod dependency');
assert.equal(meta.version, lock.packages['node_modules/zod']?.version,
  'Installed Zod must match lockfile');
assert.equal(meta.version, '3.25.76', 'Re-review on new Zod version');
assert.match(cli.dependencies.zod, /^\^3\./, 'Unexpected Expo CLI Zod contract');

const schema = installed.z.array(installed.z.number()).max(8);
const oversized = Array.from({ length: 64 }, () => 'invalid');
const result = schema.safeParse(oversized);
assert.equal(result.success, false);
assert.ok(result.error.issues.length > 0);
assert.ok(result.error.issues.length <= 65, 'Unexpected issue explosion for bounded fixture');
const unlimitedResult = installed.z.array(installed.z.number()).safeParse(oversized);
assert.equal(unlimitedResult.success, false);
assert.equal(unlimitedResult.error.issues.length, 64,
  'Unbounded Zod 3 parser diagnostics changed unexpectedly');

console.log(JSON.stringify({
  advisory: 'GHSA-mrhx-c7xc-m3w5',
  installedZod: meta.version,
  expoCli: cli.version,
  expoConstraint: cli.dependencies.zod,
  fixtureItems: oversized.length,
  boundedIssues: result.error.issues.length,
  unboundedIssues: unlimitedResult.error.issues.length,
  verdict: 'bounded-diagnostic-only-not-a-remediation',
  limitations: [
    'Does not show attacker-controlled network reachability into Expo CLI',
    'Does not test dangerous memory exhaustion',
    'Does not prove a safe Zod 3 patch or compatibility with Zod 4',
  ],
}, null, 2));
