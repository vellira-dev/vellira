import { describe, expect, it } from 'vitest';

import {
  auditSemanticMigrationPaths,
  checkTokenSemanticVocabulary,
  getSemanticVocabularyRolePaths,
} from './semantic-vocabulary';

describe('semantic vocabulary audit adapter', () => {
  it('checks the maintained repository vocabulary without findings', () => {
    const result = checkTokenSemanticVocabulary();
    expect(result.coverage).toBe('partial');
    expect(result.checked).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
  });

  it('derives nested roles from the canonical V1 vocabulary', () => {
    const paths = getSemanticVocabularyRolePaths();
    expect(paths).toEqual(
      expect.arrayContaining([
        'semantic.action.accent.pressed',
        'semantic.focus.ring.offsetColor',
        'semantic.status.warning.emphasisFg',
      ])
    );
  });

  it('fails closed when a recorded rename keeps its source or loses its target', () => {
    const migrations = [
      {
        kind: 'rename' as const,
        issue: '#883',
        from: 'semantic.icons.primary',
        to: 'semantic.icons.interactive',
      },
      {
        kind: 'remove' as const,
        issue: '#883',
        from: 'semantic.navigation.border',
      },
    ];
    const findings = auditSemanticMigrationPaths(
      {
        icons: { primary: '#fff' },
        navigation: { border: '#000' },
      },
      migrations,
      'fixture',
      'fixture.ts'
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'deprecated-semantic-path-present',
          tokenPath: 'semantic.icons.primary',
        }),
        expect.objectContaining({
          code: 'semantic-rename-target-missing',
          tokenPath: 'semantic.icons.interactive',
        }),
        expect.objectContaining({
          code: 'deprecated-semantic-path-present',
          tokenPath: 'semantic.navigation.border',
        }),
      ])
    );
  });

  it('accepts a completed recorded rename/removal migration', () => {
    expect(
      auditSemanticMigrationPaths(
        { icons: { interactive: '#fff' } },
        [
          {
            kind: 'rename',
            issue: '#883',
            from: 'semantic.icons.primary',
            to: 'semantic.icons.interactive',
          },
          {
            kind: 'remove',
            issue: '#883',
            from: 'semantic.navigation.border',
          },
        ],
        'fixture',
        'fixture.ts'
      )
    ).toEqual([]);
  });
});
