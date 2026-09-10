import { describe, expect, it } from 'vitest';

import { runTokenSemanticAudit } from './contract';
import { checkTokenValueKinds } from './value-kind-repository';

/** Exercise real themes and controlSizes, never a fixture-only baseline. */
describe('maintained value-kind inventory', () => {
  it('checks all theme layers and shared control sizes without findings', () => {
    const result = checkTokenValueKinds();
    expect(result.checked).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
    expect(result.coverage).toBe('partial');
  });

  it('connects the adapter without claiming unrelated rules passed', () => {
    const report = runTokenSemanticAudit([
      { ruleId: 'tokens.value-kind', run: checkTokenValueKinds },
    ]);
    expect(report.summary.runtimeErrors).toBe(0);
    expect(report.summary.completeRules).toBe(0);
    expect(report.status).toBe('incomplete');
    expect(report.coverage[0].coverage).toBe('partial');
  });
});
