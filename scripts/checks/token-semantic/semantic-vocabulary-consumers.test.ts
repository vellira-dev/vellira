import { describe, expect, it } from 'vitest';

import {
  auditDeprecatedSemanticConsumerSource,
  auditSemanticWebMigrationIdentity,
  checkTokenSemanticVocabularyCompletion,
  semanticPathToCssVariable,
} from './semantic-vocabulary-consumers';

const root = process.cwd();

describe('semantic vocabulary consumer and Web identity completion', () => {
  it('checks maintained production consumers and #883 Web identities without findings', () => {
    const result = checkTokenSemanticVocabularyCompletion(root);
    expect(result.checked).toBeGreaterThan(100);
    expect(result.findings).toEqual([]);
  });

  it('derives canonical semantic CSS identities deterministically', () => {
    expect(
      semanticPathToCssVariable('semantic.icons.interactiveHover')
    ).toBe('--icons-interactive-hover');
    expect(semanticPathToCssVariable('semantic.focus.ring.offsetColor')).toBe(
      '--focus-ring-offset-color'
    );
  });

  it('fails closed when a production consumer revives a deprecated semantic role', () => {
    const findings = auditDeprecatedSemanticConsumerSource(
      'apps/example/source.ts',
      'const background = theme.semantic.surface.background;\n',
      ['semantic.surface.background']
    );

    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: 'tokens.semantic-vocabulary',
        code: 'deprecated-semantic-consumer',
        severity: 'error',
        tokenPath: 'semantic.surface.background',
      }),
    ]);
  });

  it('keeps the real #883 Web migration identities synchronized', () => {
    const result = auditSemanticWebMigrationIdentity();
    expect(result.checked).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
  });
});
