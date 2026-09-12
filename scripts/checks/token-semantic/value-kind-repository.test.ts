import { describe, expect, it } from 'vitest';

import {
  auditGeneratedTokenCssOutput,
  auditTokenCssGenerationWiring,
  checkTokenValueKinds,
} from './value-kind-repository';

/** Exercise real themes and controlSizes, never a fixture-only baseline. */
describe('maintained value-kind inventory', () => {
  it(
    'checks all theme layers, shared control sizes, emitted CSS, and package wiring without findings',
    () => {
      const result = checkTokenValueKinds();
      expect(result.checked).toBeGreaterThan(7000);
      expect(result.findings).toEqual([]);
      expect(result.coverage).toBe('complete');
    },
    30_000
  );

  it('fails closed when emitted generated CSS diverges from canonical output maps', () => {
    const result = auditGeneratedTokenCssOutput('/* stale CSS */\n');
    expect(result.checked).toBe(1);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      ruleId: 'tokens.value-kind',
      code: 'generated-css-output-drift',
      severity: 'error',
      sourcePath: 'packages/tokens/scripts/token-css-output.ts',
      platform: 'web',
    });
  });

  it('keeps the real package build wired to canonical CSS generation', () => {
    const result = auditTokenCssGenerationWiring(process.cwd());
    expect(result.checked).toBe(5);
    expect(result.findings).toEqual([]);
  });

  // cli.test.ts proves registration using its existing full repository report.
});
