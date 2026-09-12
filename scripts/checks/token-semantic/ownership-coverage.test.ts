import { describe, expect, it } from 'vitest';

import { checkTokenSemantics } from './checker';

describe('token semantic ownership coverage', () => {
  it(
    'reports component ownership and namespace lifecycle as complete on the maintained repository',
    () => {
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
      expect(
        report.findings.filter(
          ({ ruleId }) =>
            ruleId === 'tokens.component-ownership' ||
            ruleId === 'tokens.namespace-lifecycle'
        )
      ).toEqual([]);
    },
    30_000
  );
});
