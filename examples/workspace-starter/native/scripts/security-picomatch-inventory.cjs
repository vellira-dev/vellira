#!/usr/bin/env node
'use strict';

// Read-only provenance inventory for GHSA-fc5q-39xc-vjpf / CVE-2026-112366.
// A passing inventory is NOT a remediation or a reachability proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const expected = {
  'node_modules/picomatch': '4.0.7',
  'node_modules/expo': '58.0.26',
  'node_modules/expo/node_modules/@expo/cli': '58.1.21',
  'node_modules/@expo/metro-config': '58.0.23',
  'node_modules/tinyglobby': '0.2.17',
  'node_modules/react-native': '0.88.1',
};
for (const [key, version] of Object.entries(expected)) {
  assert.equal(lock.packages[key]?.version, version,
    'Dependency graph changed: independently review Picomatch advisory and call sites before updating this inventory: ' + key);
}
const picomatchPaths = Object.entries(lock.packages)
  .filter(([key]) => /(?:^|\/)node_modules\/picomatch$/.test(key))
  .map(([key, metadata]) => ({ path: key, version: metadata.version }));
assert.ok(picomatchPaths.some((entry) => entry.version === '4.0.7'),
  'Picomatch 4 graph changed; audit before dropping the current finding');

const sourceChecks = [
  {
    path: 'node_modules/@expo/metro-config/build/serializer/sideEffects.js',
    markers: ['packageJson.sideEffects', 'sideEffectMatcher', 'picomatch'],
    source: 'dependency package.json sideEffects',
  },
  {
    path: 'node_modules/expo/node_modules/@expo/cli/build/src/export/exportAssets.js',
    markers: ['assetPatternsToBeBundled', 'fullPatterns', 'picomatch'],
    source: 'Expo project asset-bundling configuration',
  },
  {
    path: 'node_modules/expo/node_modules/@expo/cli/build/src/utils/createFileTransform.js',
    markers: ['createGlobFilter', 'globPattern', 'picomatch'],
    source: 'CLI caller-provided globPattern',
  },
];
for (const check of sourceChecks) {
  const fullPath = path.join(root, check.path);
  const source = fs.readFileSync(fullPath, 'utf8');
  for (const marker of check.markers) {
    assert.ok(source.includes(marker),
      'Installed Expo call site changed; source review required: ' + check.path + ' / ' + marker);
  }
}
console.log(JSON.stringify({
  advisory: 'GHSA-fc5q-39xc-vjpf',
  cve: 'CVE-2026-112366',
  manifest: 'examples/workspace-starter/native/package-lock.json',
  status: 'UNRESOLVED_VULNERABLE_DEPENDENCY_PRESENT',
  note: 'Verified callsite inventory only. No remote exploitability, mitigation, or advisory closure is claimed.',
  picomatchPaths,
  callsites: sourceChecks.map(({ path, source }) => ({ path, patternOrigin: source })),
}, null, 2));
