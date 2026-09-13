import { describe, expect, it } from 'vitest';

import { checkTokenSemantics } from './checker';

describe('token semantic ownership coverage', () => {
  it('reports maintained complete-rule coverage without findings', () => {
    const report = checkTokenSemantics(process.cwd());
    const componentOwnership = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.component-ownership'
    );
    const namespaceLifecycle = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.namespace-lifecycle'
    );
    const valueKind = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.value-kind'
    );
    const stateVocabulary = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.state-vocabulary'
    );
    const semanticVocabulary = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.semantic-vocabulary'
    );
    const shadowAuthority = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.shadow-authority'
    );
    const publicApi = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.public-api'
    );
    const consumerReference = report.coverage.find(
      ({ ruleId }) => ruleId === 'tokens.consumer-reference'
    );

    expect(componentOwnership).toMatchObject({ coverage: 'complete' });
    expect(componentOwnership?.checked).toBeGreaterThan(15);
    expect(namespaceLifecycle).toMatchObject({ coverage: 'complete' });
    expect(namespaceLifecycle?.checked).toBeGreaterThan(13);
    expect(valueKind).toMatchObject({ coverage: 'complete' });
    expect(valueKind?.checked).toBeGreaterThan(7000);
    expect(stateVocabulary).toMatchObject({ coverage: 'complete' });
    expect(stateVocabulary?.checked).toBeGreaterThan(200);
    expect(semanticVocabulary).toMatchObject({ coverage: 'complete' });
    expect(semanticVocabulary?.checked).toBeGreaterThan(500);
    expect(shadowAuthority).toMatchObject({ coverage: 'complete' });
    expect(shadowAuthority?.checked).toBeGreaterThan(50);
    expect(publicApi).toMatchObject({ coverage: 'complete' });
    expect(publicApi?.checked).toBeGreaterThan(50);
    expect(consumerReference).toMatchObject({ coverage: 'complete' });
    expect(consumerReference?.checked).toBeGreaterThan(80);
    expect(report.summary).toMatchObject({
      requiredRules: 12,
      completeRules: 12,
      incompleteRules: 0,
      runtimeErrors: 0,
      errors: 0,
      warnings: 0,
    });
    expect(report.status).toBe('pass');
    expect(report.findings).toEqual([]);
  }, 30_000);
});
