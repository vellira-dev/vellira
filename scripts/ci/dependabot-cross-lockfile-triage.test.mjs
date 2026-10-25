import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const script = fileURLToPath(new URL('./dependabot-cross-lockfile-triage.mjs', import.meta.url));
const alert = (number, name, manifest, scope, severity, patched = null) => ({
  number, state: 'open',
  dependency: { package: { ecosystem: 'npm', name }, manifest_path: manifest, scope },
  security_advisory: { severity },
  security_vulnerability: { first_patched_version: patched ? { identifier: patched } : null },
});

test('retains runtime and dev alerts from distinct lockfiles', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-alerts-'));
  try {
    const input = path.join(dir, 'alerts.json');
    const output = path.join(dir, 'report.md');
    const source = [
      alert(93, 'node-forge', 'pnpm-lock.yaml', 'runtime', 'high'),
      alert(141, 'node-forge', 'examples/workspace-starter/native/package-lock.json', 'runtime', 'high'),
      alert(152, 'undici', 'pnpm-lock.yaml', 'development', 'high', '7.30.0'),
      alert(153, 'undici', 'pnpm-lock.yaml', 'development', 'high', '7.30.0'),
      { ...alert(9, 'ignored', 'pnpm-lock.yaml', 'runtime', 'critical'), state: 'fixed' },
    ];
    fs.writeFileSync(input, JSON.stringify(source));
    const summary = JSON.parse(execFileSync(process.execPath, [script, input, output], { encoding: 'utf8' }));
    const report = fs.readFileSync(output, 'utf8');
    assert.deepEqual(summary, { groups: 3, alerts: 4, runtimeOrUnknown: 2, separateLockfiles: 1 });
    for (const n of [93, 141, 152, 153]) assert.ok(report.includes('#' + n + ' ('));
    assert.ok(!report.includes('#9 ('));
    assert.match(report, /examples\/workspace-starter\/native\/package-lock.json/);
    assert.match(report, /review-only/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
