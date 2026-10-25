#!/usr/bin/env node
// Read-only cross-manifest security triage. Never mutates dependencies or alerts.
import fs from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('Usage: node dependabot-cross-lockfile-triage.mjs <alerts.json> <report.md>');
}
const alerts = JSON.parse(fs.readFileSync(input, 'utf8'));
if (!Array.isArray(alerts)) throw new Error('Dependabot payload must be an array');

const severityRank = { critical: 4, high: 3, moderate: 2, low: 1 };
const clean = (value) => String(value ?? 'unknown').replace(/[\r\n|\x00-\x1f]/g, ' ').replace(/[`<>]/g, '').slice(0, 180);
const groups = new Map();

for (const a of alerts) {
  if (a.state !== 'open' || a.dependency?.package?.ecosystem !== 'npm') continue;
  const name = a.dependency.package.name;
  const manifest = a.dependency.manifest_path || 'unknown';
  const scope = a.dependency.scope === 'development' ? 'development' : 'runtime-or-unknown';
  const severity = String(a.security_advisory?.severity ?? 'unknown').toLowerCase();
  const number = a.number;
  if (!name || !Number.isSafeInteger(number)) throw new Error('Malformed security alert identity');
  const key = JSON.stringify([name, manifest, scope]);
  if (!groups.has(key)) groups.set(key, { name, manifest, scope, alerts: [] });
  groups.get(key).alerts.push({
    number,
    severity,
    patched: a.security_vulnerability?.first_patched_version?.identifier || null,
    advisory: a.security_advisory?.ghsa_id || null,
  });
}

const rows = [...groups.values()].map((group) => ({
  ...group,
  alerts: group.alerts.sort((a, b) =>
    (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0) || a.number - b.number
  ),
})).sort((a, b) => {
  const ar = Math.max(...a.alerts.map(x => severityRank[x.severity] || 0));
  const br = Math.max(...b.alerts.map(x => severityRank[x.severity] || 0));
  return br - ar || a.name.localeCompare(b.name) || a.manifest.localeCompare(b.manifest);
});

const lines = [
  '## Open npm Dependabot alerts across all manifests',
  '',
  'Read-only inventory; this report does not claim fixes or authorize auto-merge.',
  '',
  '| Package | Manifest | Scope | Alert numbers / severity | First patched versions |',
  '| --- | --- | --- | --- | --- |',
];
for (const row of rows) {
  const numbers = row.alerts.map(a => `#${a.number} (${clean(a.severity)})`).join(', ');
  const fixes = [...new Set(row.alerts.map(a => a.patched || 'unavailable'))].map(clean).join(', ');
  lines.push(`| ${clean(row.name)} | ${clean(row.manifest)} | ${clean(row.scope)} | ${numbers} | ${fixes} |`);
}
if (rows.length === 0) lines.push('| None | — | — | — | — |');
lines.push('', 'Runtime or unknown scope and separate lockfiles are **review-only**.', 'No alert is dismissed by this workflow.', '');
fs.writeFileSync(output, lines.join('\n'));
console.log(JSON.stringify({
  groups: rows.length,
  alerts: rows.reduce((sum, x) => sum + x.alerts.length, 0),
  runtimeOrUnknown: rows.filter(x => x.scope !== 'development').length,
  separateLockfiles: rows.filter(x => x.manifest !== 'pnpm-lock.yaml').length,
}));
