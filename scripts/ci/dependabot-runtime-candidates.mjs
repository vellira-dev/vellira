import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Runtime automation is deliberately much narrower than the general alert feed.
// Frameworks with patches (Next/OpenNext) must use an owner-reviewed migration.
const ALLOWLIST = Object.freeze({
  vite: { major: 6, mode: 'vite-range' },
  glob: { major: 10, mode: 'minify-parent' },
  'ip-address': { major: 10, mode: 'exact' },
});

function version(value) {
  if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) return null;
  const parts = value.split('.').map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

function compareVersions(a, b) {
  const x = version(a);
  const y = version(b);
  if (!x || !y) throw new Error('Unsupported runtime patch version');
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

function resolvedVersions(lock, name) {
  const safeName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^  ${safeName}@(\\d+\\.\\d+\\.\\d+):`, 'gm');
  return [...new Set([...lock.matchAll(pattern)].map((match) => match[1]))]
    .sort(compareVersions);
}

function overrideLine(workspace, name) {
  const lines = workspace.split('\n');
  const pattern = name === 'vite'
    ? /^  'vite@<=([0-9]+\.[0-9]+\.[0-9]+)': ([0-9]+\.[0-9]+\.[0-9]+)$/
    : name === 'glob'
      ? /^  '@node-minify\/core>glob': ([0-9]+\.[0-9]+\.[0-9]+)$/
      : /^  ip-address: ([0-9]+\.[0-9]+\.[0-9]+)$/;
  const matching = lines.filter((line) => pattern.test(line));
  if (matching.length > 1) throw new Error(`Ambiguous ${name} override`);
  if (!matching.length) return null;
  const found = matching[0].match(pattern);
  return { line: matching[0], from: found[found.length - 1] };
}

export function planRuntimeCandidates(alerts, workspace, lock) {
  assert.ok(Array.isArray(alerts), 'Expected Dependabot alert array');
  assert.ok(workspace.includes('\noverrides:\n'), 'Missing pnpm workspace override section');
  const changes = [];
  const ownerReview = [];
  const alreadyPatched = [];
  const open = alerts.filter((a) => a?.state === 'open' &&
    a?.dependency?.package?.ecosystem === 'npm' &&
    a?.dependency?.scope === 'runtime' &&
    ['critical', 'high', 'moderate', 'low'].includes(a?.security_advisory?.severity));
  for (const name of [...new Set(open.map((a) => a.dependency.package.name))].sort()) {
    const relevant = open.filter((a) => a.dependency.package.name === name);
    const alertNumbers = relevant.map((a) => a.number).filter(Number.isSafeInteger).sort((a, b) => a - b);
    const fixes = relevant.map((a) => a?.security_vulnerability?.first_patched_version?.identifier);
    const installed = resolvedVersions(lock, name);
    if (!fixes.length || fixes.some((v) => !version(v)) || !installed.length) {
      ownerReview.push({ name, alertNumbers, reason: 'Unknown published fix or resolution' });
      continue;
    }
    const target = fixes.sort(compareVersions).at(-1);
    const vulnerable = installed.filter((v) => compareVersions(v, target) < 0);
    if (!vulnerable.length) {
      alreadyPatched.push({ name, alertNumbers, installed, firstPatched: target });
      continue;
    }
    const allow = ALLOWLIST[name];
    if (!allow || version(target)[0] !== allow.major ||
        vulnerable.some((v) => version(v)[0] !== allow.major) ||
        new Set(vulnerable).size !== 1) {
      ownerReview.push({ name, alertNumbers, reason: 'Not an allowed same-major transitive patch' });
      continue;
    }
    const from = vulnerable[0];
    let original = overrideLine(workspace, name);
    if (name === 'glob' && !original && lock.includes('@node-minify/core@')) {
      original = { line: null, from };
    }
    if (!original || original.from !== from || compareVersions(target, from) <= 0) {
      ownerReview.push({ name, alertNumbers, reason: 'Unexpected existing workspace override' });
      continue;
    }
    changes.push({ name, from, to: target, mode: allow.mode, line: original.line, alertNumbers });
  }
  return { schemaVersion: 1, changes, ownerReview, alreadyPatched };
}

export function applyRuntimeCandidates(workspace, plan) {
  assert.equal(plan?.schemaVersion, 1);
  assert.ok(Array.isArray(plan.changes));
  let next = workspace;
  const visited = new Set();
  for (const entry of plan.changes) {
    const rule = ALLOWLIST[entry.name];
    assert.ok(rule && rule.mode === entry.mode && !visited.has(entry.name));
    visited.add(entry.name);
    assert.ok(version(entry.from) && version(entry.to));
    assert.equal(version(entry.from)[0], rule.major);
    assert.equal(version(entry.to)[0], rule.major);
    assert.ok(compareVersions(entry.to, entry.from) > 0);
    const original = overrideLine(next, entry.name);
    if (entry.name === 'glob' && !original && entry.line === null) {
      assert.ok(next.includes('\noverrides:\n'));
      next = next.replace('\noverrides:\n', `\noverrides:\n  '@node-minify/core>glob': ${entry.to}\n`);
      continue;
    }
    assert.ok(original && original.line === entry.line && original.from === entry.from,
      `Stale ${entry.name} candidate`);
    const replacement = entry.name === 'vite'
      ? `  'vite@<=${entry.from}': ${entry.to}`
      : entry.name === 'glob'
        ? `  '@node-minify/core>glob': ${entry.to}`
        : `  ip-address: ${entry.to}`;
    next = next.replace(original.line, replacement);
  }
  return next;
}

export function verifyRuntimeResolution(lock, plan) {
  assert.equal(plan?.schemaVersion, 1);
  for (const entry of plan.changes) {
    const installed = resolvedVersions(lock, entry.name);
    assert.ok(installed.includes(entry.to), `Missing ${entry.name}@${entry.to}`);
    assert.ok(!installed.some((v) => version(v)[0] === version(entry.from)[0] && compareVersions(v, entry.to) < 0),
      `Vulnerable ${entry.name} resolution remains`);
  }
  assert.match(lock, /next@16\.4\.2\(patch_hash=/, 'Next custom patch missing');
  assert.match(lock, /node-forge@1\.4\.0\(patch_hash=/, 'Forge verified backport missing');
  assert.match(lock, /sharp: 0\.35\.5/, 'Pinned sharp security fix missing');
}

// Called only after an authenticated scan against a checked-out main SHA.
// Apply additionally re-plans from the original alerts rather than trusting JSON.
function cli(args) {
  const [command, alertsPath, planPath] = args;
  if (!['plan', 'apply', 'verify'].includes(command) || !alertsPath || !planPath) {
    throw new Error('Usage: dependabot-runtime-candidates.mjs plan|apply|verify <alerts.json> <plan.json>');
  }
  const alerts = JSON.parse(readFileSync(alertsPath, 'utf8'));
  const originalPlan = planRuntimeCandidates(alerts,
    readFileSync('pnpm-workspace.yaml', 'utf8'), readFileSync('pnpm-lock.yaml', 'utf8'));
  if (command === 'plan') {
    writeFileSync(planPath, `${JSON.stringify(originalPlan, null, 2)}\n`, { flag: 'wx' });
    return;
  }
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  if (command === 'apply') {
    assert.deepEqual(plan, originalPlan, 'Candidate plan no longer matches source authority');
    writeFileSync('pnpm-workspace.yaml', applyRuntimeCandidates(
      readFileSync('pnpm-workspace.yaml', 'utf8'), plan));
  } else {
    verifyRuntimeResolution(readFileSync('pnpm-lock.yaml', 'utf8'), plan);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli(process.argv.slice(2));
}
