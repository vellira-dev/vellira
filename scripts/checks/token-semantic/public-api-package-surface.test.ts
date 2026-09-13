import { describe, expect, it } from 'vitest';

import {
  auditRemovalBoundary,
  auditTokenPackagePublicSurface,
  checkTokenPackagePublicSurface,
  isVersionAtOrAfter,
} from './public-api-package-surface';

const root = process.cwd();

const canonicalSurface = {
  version: '2.104.12',
  main: './dist/index.js',
  types: './dist/index.d.ts',
  exports: {
    '.': {
      'react-native': {
        types: './dist/index.d.ts',
        default: './dist/index.js',
      },
      'vellira-source': './src/index.ts',
      types: './dist/index.d.ts',
      import: './dist/index.js',
    },
    './css': {
      types: './css.d.ts',
      default: './dist/css/tokens.css',
    },
  },
};

describe('token package public surface audit', () => {
  it('checks the maintained #889 package surface and removal window', () => {
    const result = checkTokenPackagePublicSurface(root);
    expect(result.checked).toBeGreaterThan(4);
    expect(result.findings).toEqual([]);
  });

  it('rejects an undocumented package export subpath and target drift', () => {
    const packageJson = {
      ...canonicalSurface,
      exports: {
        ...canonicalSurface.exports,
        '.': {
          ...canonicalSurface.exports['.'],
          import: './dist/legacy.js',
        },
        './legacy': './dist/legacy.js',
      },
    };

    expect(auditTokenPackagePublicSurface(packageJson)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'package-export-subpath-drift' }),
        expect.objectContaining({ code: 'package-export-target-drift' }),
      ])
    );
  });

  it('expires registered compatibility aliases at their removal boundary', () => {
    const findings = auditRemovalBoundary('3.0.0', [
      { kind: 'public-export', name: 'theme', removeIn: '3.0.0' },
      {
        kind: 'css-variable',
        name: '--legacy-shadow',
        removeIn: '3.0.0',
      },
    ]);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'expired-public-export-alias' }),
        expect.objectContaining({ code: 'expired-css-compatibility-alias' }),
      ])
    );
  });

  it('keeps aliases valid before the removal boundary and compares prereleases conservatively', () => {
    expect(
      auditRemovalBoundary('2.104.12', [
        { kind: 'public-export', name: 'theme', removeIn: '3.0.0' },
      ])
    ).toEqual([]);
    expect(isVersionAtOrAfter('3.0.0-next.1', '3.0.0')).toBe(true);
    expect(isVersionAtOrAfter('2.999.999', '3.0.0')).toBe(false);
  });
});
