import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { darkTheme } from './dark/theme.js';
import {
  componentTokenPaths,
  themeCssVariableNames,
  themeNames,
} from './generated/token-types.js';
import { highContrastTheme } from './highContrast/theme.js';
import { theme } from './index.js';
import { lightTheme } from './light/theme.js';
import { componentTokenWebCompatibilityAliases } from './platform-output/component-token-web-compatibility.js';
import {
  legacyPublicExportAliasesV1,
  publicThemeContractsV1,
  tokenPublicApiDeprecationPolicyV1,
} from './public-api-policy.js';
import { tokenMigrationManifestV1 } from './preservation/token-migrations.js';

const migrationIds = new Set(tokenMigrationManifestV1.map(({ id }) => id));

describe('public token API V1', () => {
  it('keeps named theme exports aligned with runtime theme names', () => {
    const themesByExport = {
      lightTheme,
      darkTheme,
      highContrastTheme,
    } as const;

    expect(publicThemeContractsV1).toEqual([
      { exportName: 'lightTheme', themeName: 'light' },
      { exportName: 'darkTheme', themeName: 'dark' },
      { exportName: 'highContrastTheme', themeName: 'high-contrast' },
    ]);

    for (const contract of publicThemeContractsV1) {
      expect(themesByExport[contract.exportName].name).toBe(contract.themeName);
    }

    expect(new Set(themeNames)).toEqual(
      new Set(publicThemeContractsV1.map(({ themeName }) => themeName))
    );
  });

  it('keeps the historical theme export exact, deprecated, and bounded', () => {
    expect(theme).toEqual({
      semantic: darkTheme.semantic,
      components: darkTheme.components,
      tokens: darkTheme.tokens,
    });
    expect(theme).not.toHaveProperty('name');
    expect(theme).not.toHaveProperty('colors');

    expect(legacyPublicExportAliasesV1).toEqual([
      expect.objectContaining({
        exportName: 'theme',
        replacementExport: 'darkTheme',
        issue: '#889',
        removeIn: '3.0.0',
      }),
    ]);

    const indexSource = fs.readFileSync(
      fileURLToPath(new URL('./index.ts', import.meta.url)),
      'utf8'
    );
    expect(indexSource).toMatch(
      /@deprecated[\s\S]*Use `darkTheme` directly[\s\S]*3\.0\.0[\s\S]*export const theme/
    );
  });

  it('tracks every Web compatibility alias outside canonical token paths', () => {
    expect(tokenPublicApiDeprecationPolicyV1.removalRelease).toBe('3.0.0');

    for (const alias of componentTokenWebCompatibilityAliases) {
      expect(alias.issue).toBe('#889');
      expect(alias.removeIn).toBe('3.0.0');
      expect(migrationIds.has(alias.migrationId)).toBe(true);

      expect(componentTokenPaths).not.toContain(alias.path);
      expect(componentTokenPaths).toContain(alias.replacementPath);

      expect(themeCssVariableNames).toContain(alias.variable);
      expect(themeCssVariableNames).toContain(alias.replacementVariable);
    }
  });

  it('does not allow an unbounded compatibility alias contract', () => {
    for (const alias of componentTokenWebCompatibilityAliases) {
      expect(alias.removeIn).toBe(
        tokenPublicApiDeprecationPolicyV1.removalRelease
      );
      expect(alias.replacementPath.length).toBeGreaterThan(0);
      expect(alias.replacementVariable.startsWith('--')).toBe(true);
    }

    for (const alias of legacyPublicExportAliasesV1) {
      expect(alias.removeIn).toBe(
        tokenPublicApiDeprecationPolicyV1.removalRelease
      );
      expect(alias.replacementExport.length).toBeGreaterThan(0);
    }
  });
});
