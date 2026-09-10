import { describe, expect, it } from 'vitest';

import {
  auditPublicCompatibilityAlias,
  checkTokenPublicApi,
} from './public-api';

const root = process.cwd();

describe('public token API audit adapter', () => {
  it('checks the maintained #889 public API baseline without findings', () => {
    const result = checkTokenPublicApi(root);
    expect(result.coverage).toBe('partial');
    expect(result.checked).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
  });

  it('rejects an untracked compatibility alias that re-enters canonical paths', () => {
    const result = auditPublicCompatibilityAlias({
      alias: {
        path: 'components.button.legacy',
        replacementPath: 'components.button.current',
        variable: '--button-legacy',
        replacementVariable: '--button-current',
        issue: '#889',
        removeIn: '3.0.0',
        migrationId: 'missing-migration',
      },
      migrationIds: new Set(),
      canonicalPaths: ['components.button.legacy', 'components.button.current'],
      cssVariables: ['--button-legacy', '--button-current'],
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'css-alias-migration-missing' }),
        expect.objectContaining({
          code: 'deprecated-path-reentered-canonical-api',
        }),
      ])
    );
  });

  it('rejects an unbounded alias or missing canonical replacement output', () => {
    const result = auditPublicCompatibilityAlias({
      alias: {
        path: 'components.button.legacy',
        replacementPath: 'components.button.current',
        variable: '--button-legacy',
        replacementVariable: '--button-current',
        issue: '#probe',
        removeIn: '99.0.0',
        migrationId: 'migration-1',
      },
      migrationIds: new Set(['migration-1']),
      canonicalPaths: [],
      cssVariables: ['--button-legacy'],
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unbounded-css-compatibility-alias' }),
        expect.objectContaining({
          code: 'css-alias-replacement-path-missing',
        }),
        expect.objectContaining({ code: 'css-alias-output-missing' }),
      ])
    );
  });
});
