import { describe, expect, it } from 'vitest';

import { checkTokenSemantics } from './checker';

describe('token semantic ownership coverage', () => {
  it('reports component ownership and namespace lifecycle as complete on the maintained repository', () => {
    const report = checkTokenSemantics(process.cwd());
    const componentOwnership = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.component-ownership'
    );
    const namespaceLifecycle = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.namespace-lifecycle'
    );

    expect(componentOwnership).toMatchObject({ coverage: 'complete' });
    expect(componentOwnership?.checked).toBeGreaterThan(15);
    expect(namespaceLifecycle).toMatchObject({ coverage: 'complete' });
    expect(namespaceLifecycle?.checked).toBeGreaterThan(13);
    expect(report.summary).toMatchObject({
      requiredRules: 12,
      completeRules: 3,
      incompleteRules: 9,
      runtimeErrors: 0,
      errors: 0,
      warnings: 0,
    });
    expect(report.status).toBe('incomplete');
    expect(report.findings).toEqual([]);
  }, 30_000);
});
