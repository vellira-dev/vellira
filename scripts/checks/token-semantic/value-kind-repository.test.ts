import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkTokenSemantics } from './checker';
import { checkTokenValueKinds } from './value-kind-repository';

/** Exercise real themes and controlSizes, never a fixture-only baseline. */
describe('maintained value-kind inventory', () => {
  it('checks all theme layers and shared control sizes without findings', () => {
    const result = checkTokenValueKinds();
    expect(result.checked).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
    expect(result.coverage).toBe('partial');
  });

  it('is registered in the real repository audit entrypoint', () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const report = checkTokenSemantics(root);
    expect(report.summary.runtimeErrors).toBe(0);
    const coverage = report.coverage.find(
      (rule) => rule.ruleId === 'tokens.value-kind'
    );
    expect(coverage).toMatchObject({
      coverage: 'partial',
      checked: checkTokenValueKinds().checked,
    });
    expect(
      report.findings.filter(
        (finding) => finding.ruleId === 'tokens.value-kind'
      )
    ).toEqual([]);
  });
});
