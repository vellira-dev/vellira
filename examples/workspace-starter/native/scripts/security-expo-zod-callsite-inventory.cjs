#!/usr/bin/env node
'use strict';
// Package-exact source inventory only: no unbounded parsing or untrusted calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const record = lock.packages['node_modules/expo/node_modules/@expo/cli'];
assert.equal(record?.version, '57.0.32', 'Re-review this proof for a new Expo CLI');
const cliRoot = path.join(root, 'node_modules/expo/node_modules/@expo/cli');
const meta = JSON.parse(fs.readFileSync(path.join(cliRoot, 'package.json'), 'utf8'));
assert.equal(meta.version, record.version);
assert.match(meta.dependencies.zod, /^\^3\./);
const queue = [path.join(cliRoot, 'build')];
const findings = [];
let scanned = 0;
while (queue.length) {
  const dir = queue.pop();
  if (!fs.existsSync(dir)) continue;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      queue.push(full);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    scanned++;
    assert.ok(scanned <= 12000, 'Unbounded Expo CLI source inventory');
    const source = fs.readFileSync(full, 'utf8');
    if (!source.includes('zod')) continue;
    const relative = path.relative(cliRoot, full).split(path.sep).join('/');
    const arrays = [...source.matchAll(/\bz(?:od)?(?:_\d+)?\.(?:array)\(/g)].length;
    const parses = [...source.matchAll(/\.(?:safeParse|parse)\(/g)].length;
    findings.push({ file: relative, zodArrayCalls: arrays, parseCallSites: parses });
  }
}
assert.ok(scanned > 0, 'No installed Expo CLI build files found');
assert.ok(findings.length > 0, 'No bundled Zod imports found; inspect updated CLI structure');
const summary = {
  installedExpoCli: meta.version,
  installedZodConstraint: meta.dependencies.zod,
  scannedJsFiles: scanned,
  filesReferencingZod: findings.length,
  sample: findings.filter(x => x.zodArrayCalls || x.parseCallSites).slice(0, 30),
  limitations: [
    'Static references are not evidence that externally supplied data reaches a schema',
    'Regex call counts include unrelated parse methods and may miss transpiler aliases',
    'No memory exhaustion or network input was used',
  ],
};
console.log(JSON.stringify(summary, null, 2));
