import { describe, expect, it } from 'vitest';

import type { RuleResult } from './contract';
import {
  checkTokenCssReferencesComplete,
  enforceCompleteConsumerReferenceCoverage,
} from './consumer-reference-completeness';

describe('complete CSS consumer-reference coverage', () => {
  it('keeps the maintained repository fully proven without findings', () => {
    const result = checkTokenCssReferencesComplete(process.cwd());
    expect(result.coverage).toBe('complete');
    expect(result.checked).toBeGreaterThan(80);
    expect(result.findings).toEqual([]);
  });

  it('promotes every unresolved coverage warning to a blocking error', () => {
    const partial: RuleResult = {
      coverage: 'partial',
      scope: 'fixture',
      checked: 1,
      findings: [
        {
          ruleId: 'tokens.consumer-reference',
          code: 'unresolved-css-variable-expression',
          severity: 'warning',
          sourcePath: 'fixture.scss',
          tokenPath: '--probe-#{$state}',
          line: 1,
          column: 1,
          layer: 'consumer',
          theme: null,
          platform: 'web',
          evidence: 'Cannot statically resolve the fixture expression.',
          expected: 'A complete static name.',
          migrationStatus: 'untracked',
          suggestedAction: 'Make the expression statically resolvable.',
        },
      ],
    };

    const result = enforceCompleteConsumerReferenceCoverage(partial);
    expect(result.coverage).toBe('complete');
    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleId: 'tokens.consumer-reference',
        code: 'unresolved-css-variable-expression',
        severity: 'error',
      }),
    ]);
  });

  it('does not weaken existing errors', () => {
    const partial: RuleResult = {
      coverage: 'partial',
      scope: 'fixture',
      checked: 1,
      findings: [
        {
          ruleId: 'tokens.consumer-reference',
          code: 'missing-token-variable',
          severity: 'error',
          sourcePath: 'fixture.css',
          tokenPath: '--surface-missing',
          line: 1,
          column: 1,
          layer: 'consumer',
          theme: null,
          platform: 'web',
          evidence: 'Missing token.',
          expected: 'A canonical token.',
          migrationStatus: 'untracked',
          suggestedAction: 'Use a canonical token.',
        },
      ],
    };

    const result = enforceCompleteConsumerReferenceCoverage(partial);
    expect(result.findings[0]).toMatchObject({
      code: 'missing-token-variable',
      severity: 'error',
      evidence: 'Missing token.',
    });
  });
});
