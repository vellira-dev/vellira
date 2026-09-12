import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkTokenSemantics } from './checker';
import { tokenSemanticExitCode, tokenSemanticRuleIds } from './contract';
import type { TokenSemanticReport } from './contract';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
const cliProcessTimeout = 30_000;
// These two integration cases run the full checkout and preservation oracle.
// Let the bounded child process report its own timeout before Vitest expires.
const cliIntegrationTimeout = cliProcessTimeout + 5_000;

function run(...args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', cli, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: cliProcessTimeout,
  });
}

describe('token semantic CLI', () => {
  it(
    'emits parseable JSON and reports every required rule',
    () => {
      const result = run('--json', '--report');
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      const report: TokenSemanticReport = JSON.parse(result.stdout);
      expect(report.schemaVersion).toBe(1);
      const ruleIds = report.coverage.map((rule) => rule.ruleId);
      expect(ruleIds).toEqual(tokenSemanticRuleIds);
      expect(report.summary.runtimeErrors).toBe(0);
      // Reuse this real CLI report instead of repeating a full repository audit.
      const valueKinds = report.coverage.find(
        (rule) => rule.ruleId === 'tokens.value-kind'
      );
      expect(valueKinds?.coverage).toBe('complete');
      expect(valueKinds?.checked).toBeGreaterThan(0);
      expect(
        report.findings.filter(
          (finding) => finding.ruleId === 'tokens.value-kind'
        )
      ).toEqual([]);
      const consumer = report.coverage.find(
        (rule) => rule.ruleId === 'tokens.consumer-reference'
      );
      expect(consumer?.checked).toBeGreaterThan(0);
      const boundary = report.coverage.find(
        (rule) => rule.ruleId === 'tokens.platform-boundary'
      );
      expect(boundary?.coverage).toBe('complete');
      expect(boundary?.checked).toBeGreaterThan(0);
      const preservation = report.coverage.find(
        (rule) => rule.ruleId === 'tokens.visual-preservation'
      );
      expect(preservation).toMatchObject({ coverage: 'complete', checked: 1 });
      expect(
        report.findings.filter(
          (finding) => finding.ruleId === 'tokens.visual-preservation'
        )
      ).toEqual([]);
    },
    cliIntegrationTimeout
  );

  it(
    'uses the same report contract in strict mode',
    () => {
      const result = run('--json');
      expect(result.error).toBeUndefined();
      const report = JSON.parse(result.stdout);
      expect(result.status).toBe(tokenSemanticExitCode(report, false));
    },
    cliIntegrationTimeout
  );

  it('rejects unknown arguments instead of silently weakening the audit', () => {
    const result = run('--json', '--ignore-errors');
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout).status).toBe('error');
  });

  it('does not mix source authorities from a different checkout', () => {
    expect(() => checkTokenSemantics(root + '/scripts')).toThrow(
      /checkout that owns/
    );
  });
});
