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
// Lock the trust-boundary trace to the installed Expo CLI, not upstream main.
// These are source-shape checks; they do not assert network exploitability.
function installedBuildSource(name) {
  const file = path.join(cliRoot, 'build', 'src', 'start', 'server', name);
  assert.ok(fs.existsSync(file), 'Installed Expo CLI source moved: ' + name);
  return fs.readFileSync(file, 'utf8');
}
const pluginSource = installedBuildSource('DevToolsPlugin.js');
const managerSource = installedBuildSource('DevToolsPluginManager.js');
const schemaSource = installedBuildSource('DevToolsPlugin.schema.js');
assert.match(pluginSource, /PluginSchema\.safeParse\(plugin\)/,
  'No direct PluginSchema.safeParse(plugin) in installed DevToolsPlugin');
assert.match(managerSource, /queryAutolinkedPluginsAsync/,
  'Installed DevTools plugin loader changed');
assert.match(managerSource, /scanExpoModuleResolutionsForPlatform/,
  'Installed DevTools plugin autolinking source changed');
assert.match(managerSource, /DevToolsPlugin\(pluginInfo/,
  'Installed plugin metadata to constructor handoff changed');
assert.match(schemaSource, /commands:\s*[^\n]*\.array\(/,
  'Installed commands array schema changed');
// Exact installed-source trace for plugin subprocess output -> JSON -> Zod.
const executorSource = installedBuildSource('DevToolsPluginCliExtensionExecutor.js');
const resultsSource = installedBuildSource('DevToolsPluginCliExtensionResults.js');
assert.ok(executorSource.includes('DevToolsPluginCliExtensionResults'),
  'Installed plugin executor no longer creates output collector');
assert.ok(executorSource.includes('.stdout.on(') && executorSource.includes('.stderr.on('),
  'Installed plugin subprocess output handlers moved');
assert.ok(resultsSource.includes('DevToolsPluginOutputSchema.safeParse'),
  'Installed plugin output validation entrypoint changed');
assert.ok(resultsSource.includes('JSON.parse('),
  'Installed plugin JSON input parsing changed');
assert.ok(resultsSource.includes('MAX_OUTPUT_LENGTH'),
  'Installed output length guard changed');
assert.ok(schemaSource.includes('DevToolsPluginOutputSchema') &&
  schemaSource.includes('.array('),
  'Installed DevTools output array schema changed');
const outputBoundary = {
  origin: 'installed DevTools CLI plugin child-process stdout/stderr',
  collector: 'build/src/start/server/DevToolsPluginCliExtensionResults.js',
  executor: 'build/src/start/server/DevToolsPluginCliExtensionExecutor.js',
  parser: 'JSON.parse(text) then DevToolsPluginOutputSchema.safeParse(...)',
  observation: 'An overall string-length guard exists; the schema itself is an array without a proven element-count cap',
  caveat: 'Static trace only. No proof of network exposure, arbitrary plugin installation, or bounded worst-case resource use.',
};
const trustBoundary = {
  source: 'local autolinked DevTools plugin metadata',
  loader: 'build/src/start/server/DevToolsPluginManager.js',
  validator: 'build/src/start/server/DevToolsPlugin.js',
  schema: 'build/src/start/server/DevToolsPlugin.schema.js',
  evidence: [
    'scanExpoModuleResolutionsForPlatform',
    'queryAutolinkedPluginsAsync',
    'new DevToolsPlugin(pluginInfo, ...)',
    'PluginSchema.safeParse(plugin)',
    'commands: z.array(...)',
  ],
  caveat: 'This is a static installed-source trace, not proof that attacker-controlled remote data can reach Zod.',
};
const summary = {
  installedExpoCli: meta.version,
  trustBoundary,
  outputBoundary,
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
