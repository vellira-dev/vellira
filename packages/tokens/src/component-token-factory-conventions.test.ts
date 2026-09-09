import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { maintainedComponentFactories } from './token-architecture.js';

const srcDir = dirname(fileURLToPath(import.meta.url));
const factoriesDir = join(srcDir, 'factories');
const themes = ['light', 'dark', 'highContrast'] as const;
const migratedFamilies = [
  'button',
  'checkbox',
  'dropdown',
  'input',
  'radio',
  'select',
] as const;

const expectedCanonicalFactories = [
  'createAccordionTokens',
  'createButtonTokens',
  'createCheckboxTokens',
  'createContextMenuTokens',
  'createDropdownTokens',
  'createFormFieldTokens',
  'createInputTokens',
  'createModalTokens',
  'createPopoverTokens',
  'createRadioGroupTokens',
  'createRadioTokens',
  'createSelectTokens',
  'createSwitchTokens',
  'createTabsTokens',
  'createTooltipTokens',
] as const;

describe('component token factory conventions', () => {
  it('keeps maintained full-component factories on create<Component>Tokens', () => {
    expect(maintainedComponentFactories.map(({ name }) => name)).toEqual(
      expectedCanonicalFactories
    );

    for (const factory of maintainedComponentFactories) {
      expect(factory.name).toMatch(/^create[A-Z][A-Za-z0-9]*Tokens$/);
      expect(factory.name).not.toContain('Palette');
      expect(factory.source).toBe(
        `packages/tokens/src/factories/${factory.name}.ts`
      );
    }
  });

  it('keeps Palette helpers out of the canonical factory root', () => {
    const rootPaletteFiles = readdirSync(factoriesDir).filter((name) =>
      /^create.*Palette\.ts$/.test(name)
    );

    expect(rootPaletteFiles).toEqual([]);

    const paletteHelpers = readdirSync(join(factoriesDir, 'palettes'))
      .filter((name) => name.endsWith('.ts'))
      .sort();

    expect(paletteHelpers).toEqual([
      'createButtonIntentPalette.ts',
      'createCheckboxIntentPalette.ts',
      'createDropdownIntentPalette.ts',
      'createInputIntentPalette.ts',
      'createRadioIntentPalette.ts',
      'createSelectIntentPalette.ts',
    ]);
  });

  it('routes maintained theme construction through canonical factory modules', () => {
    for (const theme of themes) {
      for (const family of migratedFamilies) {
        const componentSource = readFileSync(
          join(srcDir, theme, 'components', `${family}.ts`),
          'utf8'
        );
        const componentName = `${family[0]!.toUpperCase()}${family.slice(1)}`;

        expect(componentSource).toContain(
          `../../factories/create${componentName}Tokens.js`
        );
        expect(componentSource).toContain(`create${componentName}Tokens(`);
        expect(componentSource).not.toContain(
          `../../factories/create${componentName}Palette.js`
        );
      }
    }
  });
});
