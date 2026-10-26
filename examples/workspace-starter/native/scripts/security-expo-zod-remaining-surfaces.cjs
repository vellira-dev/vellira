#!/usr/bin/env node
'use strict';
// Read-only inventory of Zod trust boundaries in the exact installed Expo CLI.
// Not a fix, exploit demonstration, or advisory dismissal.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const cli = lock.packages['node_modules/expo/node_modules/@expo/cli'];
assert.equal(cli?.version, '57.0.32', 'Re-review after Expo CLI update');
assert.equal(lock.packages['node_modules/zod']?.version, '3.25.76');
const cliRoot = path.join(root, 'node_modules/expo/node_modules/@expo/cli');
const read = (name) => fs.readFileSync(path.join(cliRoot, 'build/src/start/server', name), 'utf8');
const schema = read('DevToolsPlugin.schema.js');
const plugin = read('DevToolsPlugin.js');
const manager = read('DevToolsPluginManager.js');
const results = read('DevToolsPluginCliExtensionResults.js');
assert.ok(schema.includes('PluginSchema') && schema.includes('DevToolsPluginOutputSchema'));
assert.ok(plugin.includes('PluginSchema.safeParse'), 'Plugin metadata validation changed');
assert.ok(manager.includes('scanExpoModuleResolutionsForPlatform'), 'Autolinking entrypoint changed');
assert.ok(results.includes('DevToolsPluginOutputSchema.safeParse'), 'Output validation changed');
// This guard is intentionally only on output results; do not confuse it with
// a global Zod 3 patch or a guard on plugin metadata.
assert.ok(results.includes('Plugin cumulative output limit exceeded'),
  'Pinned output mitigation missing (requires normal npm ci)');
const reports = [
  { surface: 'autolinked plugin metadata', schema: 'PluginSchema',
    source: 'DevToolsPluginManager -> DevToolsPlugin constructor',
    bound: false, trust: 'local installed package metadata; attacker reachability unproven' },
  { surface: 'CLI plugin output', schema: 'DevToolsPluginOutputSchema',
    source: 'DevToolsPluginCliExtensionResults',
    bound: true, trust: 'child-process output; locally pinned guard, not global Zod fix' },
];
console.log(JSON.stringify({
  installedCli: cli.version, zod: '3.25.76',
  advisory: 'GHSA-mrhx-c7xc-m3w5',
  verdict: 'remaining-callsite-audit-only', reports,
  limitations: ['No remote-input reachability proof', 'No Zod 3 dependency remediation', 'No unsafe large payloads'],
}, null, 2));
