import { describe, expect, it } from 'vitest';

import {
  createFinding,
  formatTokenSemanticReport,
  runTokenSemanticAudit,
  tokenSemanticExitCode,
  tokenSemanticRuleIds,
} from './contract';
import type { FindingInput, RuleAdapter } from './contract';

const input: FindingInput = {
  ruleId: 'tokens.consumer-reference',
  code: 'missing-token-variable',
  severity: 'error',
  sourcePath: 'apps/probe/style.css',
  tokenPath: '--surface-background',
  line: 1,
  column: 4,
  layer: 'consumer',
  theme: null,
  platform: 'web',
  evidence: 'Missing generated variable.',
  expected: '--surface-canvas',
  migrationStatus: 'untracked',
  suggestedAction: 'Use the canonical replacement.',
};

function completeAdapters(): RuleAdapter[] {
  return tokenSemanticRuleIds.map((ruleId) => ({
    ruleId,
    run: () => ({
      coverage: 'complete',
      scope: 'Fixture',
      checked: 1,
      findings: [],
    }),
  }));
}

describe('token semantic report coverage', () => {
  it('never turns missing rules into a clean architecture pass', () => {
    const report = runTokenSemanticAudit([]);
    expect(report.status).toBe('incomplete');
    expect(report.summary.incompleteRules).toBe(tokenSemanticRuleIds.length);
    expect(tokenSemanticExitCode(report, false)).toBe(1);
    expect(tokenSemanticExitCode(report, true)).toBe(0);
    expect(formatTokenSemanticReport(report)).toContain('[not-run]');
  });

  it('requires every required rule to complete for a strict pass', () => {
    const report = runTokenSemanticAudit(completeAdapters());
    expect(report.status).toBe('pass');
    expect(tokenSemanticExitCode(report, false)).toBe(0);
  });

  it('keeps partial coverage visible even with no findings', () => {
    const adapters = completeAdapters();
    adapters[0].run = () => ({
      coverage: 'partial',
      scope: 'Fixture',
      checked: 1,
      findings: [],
    });
    const report = runTokenSemanticAudit(adapters);
    expect(report.status).toBe('incomplete');
    expect(tokenSemanticExitCode(report, false)).toBe(1);
  });

  it('makes execution errors fatal even in report mode', () => {
    const adapters = completeAdapters();
    adapters[0].run = () => {
      throw new Error('Unreadable authority');
    };
    const report = runTokenSemanticAudit(adapters);
    expect(report.status).toBe('error');
    expect(report.summary.completeRules).toBe(tokenSemanticRuleIds.length - 1);
    expect(tokenSemanticExitCode(report, true)).toBe(2);
  });

  it('rejects a claimed complete rule that scanned nothing', () => {
    const adapters = completeAdapters();
    adapters[0].run = () => ({
      coverage: 'complete',
      scope: 'Fixture',
      checked: 0,
      findings: [],
    });
    expect(runTokenSemanticAudit(adapters).status).toBe('error');
  });

  it('does not accept duplicate adapters', () => {
    const adapters = completeAdapters();
    expect(() => runTokenSemanticAudit([...adapters, adapters[0]])).toThrow(
      /Duplicate/
    );
  });

  it('keeps finding IDs and JSON independent from adapter order', () => {
    const adapters = completeAdapters();
    adapters[adapters.length - 1].run = () => ({
      coverage: 'complete',
      scope: 'Fixture',
      checked: 2,
      findings: [input],
    });
    const report = runTokenSemanticAudit(adapters);
    expect(report.status).toBe('fail');
    expect(tokenSemanticExitCode(report, false)).toBe(1);
    expect(tokenSemanticExitCode(report, true)).toBe(0);
    expect(JSON.stringify(report)).toBe(
      JSON.stringify(runTokenSemanticAudit([...adapters].reverse()))
    );
    expect(createFinding(input).id).toBe(createFinding({ ...input }).id);
  });

  it('does not attribute one rule failure to a different rule', () => {
    const adapters = completeAdapters();
    adapters[0].run = () => ({
      coverage: 'complete',
      scope: 'Fixture',
      checked: 1,
      findings: [input],
    });
    expect(runTokenSemanticAudit(adapters).status).toBe('error');
  });
});
