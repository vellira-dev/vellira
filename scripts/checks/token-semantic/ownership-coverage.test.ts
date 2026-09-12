import { describe, expect, it } from 'vitest';

import { checkTokenSemantics } from './checker';

describe('token semantic ownership coverage', () => {
  it('reports maintained complete-rule coverage without findings', () => {
    const report = checkTokenSemantics(process.cwd());
    const valueKind = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.value-kind'
    );
    const componentOwnership = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.component-ownership'
    );
    const namespaceLifecycle = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.namespace-lifecycle'
    );
    const shadowAuthority = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.shadow-authority'
    );
    const publicApi = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.public-api'
    );

    expect(valueKind).toMatchObject({ coverage: 'complete' });
    expect(valueKind?.checked).toBeGreaterThan(7000);
    expect(componentOwnership).toMatchObject({ coverage: 'complete' });
    expect(componentOwnership?.checked).toBeGreaterThan(15);
    expect(namespaceLifecycle).toMatchObject({ coverage: 'complete' });
    expect(namespaceLifecycle?.checked).toBeGreaterThan(13);
    expect(shadowAuthority).toMatchObject({ coverage: 'complete' });
    expect(shadowAuthority?.checked).toBeGreaterThan(50);
    expect(publicApi).toMatchObject({ coverage: 'complete' });
    expect(publicApi?.checked).toBeGreaterThan(50);
    expect(report.summary).toMatchObject({
      requiredRules: 12,
      completeRules: 9,
      incompleteRules: 3,
      runtimeErrors: 0,
      errors: 0,
      warnings: 0,
    });
    expect(report.status).toBe('incomplete');
    expect(report.findings).toEqual([]);
  }, 30_000);
});
