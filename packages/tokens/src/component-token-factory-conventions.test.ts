import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { componentTokenFactoryConventionV1 } from './component-token-factory-conventions.js';
import { maintainedComponentFactories } from './token-architecture.js';

const srcDir = dirname(fileURLToPath(import.meta.url));
const factoriesDir = join(srcDir, 'factories');
const componentsDir = join(factoriesDir, 'components');
const palettesDir = join(factoriesDir, 'palettes');
const sharedDir = join(factoriesDir, 'shared');
const themes = ['light', 'dark', 'highContrast'] as const;

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
        `packages/tokens/src/factories/components/${factory.name}.ts`
      );
    }

    expect(
      readdirSync(componentsDir)
        .filter((name) => name.endsWith('.ts'))
        .sort()
    ).toEqual(expectedCanonicalFactories.map((name) => `${name}.ts`).sort());
  });

  it('keeps factory responsibilities in the canonical shared inventory', () => {
    const rootEntries = readdirSync(factoriesDir, { withFileTypes: true })
      .map((entry) => ({
        name: entry.name,
        kind: entry.isDirectory() ? 'directory' : 'file',
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    expect(rootEntries).toEqual(
      [...componentTokenFactoryConventionV1.rootEntries].sort((left, right) =>
        left.name.localeCompare(right.name)
      )
    );

    expect(
      readdirSync(palettesDir)
        .filter((name) => name.endsWith('.ts'))
        .sort()
    ).toEqual(
      componentTokenFactoryConventionV1.paletteFamilies
        .map(({ helper }) => helper)
        .sort()
    );

    expect(
      readdirSync(sharedDir)
        .filter((name) => name.endsWith('.ts'))
        .sort()
    ).toEqual([...componentTokenFactoryConventionV1.sharedHelpers].sort());
  });

  it('routes palette-backed theme construction through canonical factory modules', () => {
    for (const theme of themes) {
      for (const family of componentTokenFactoryConventionV1.paletteFamilies) {
        const componentSource = readFileSync(
          join(srcDir, theme, 'components', family.themeFile),
          'utf8'
        );

        expect(componentSource).toContain(
          `../../factories/components/${family.factory}.js`
        );
        expect(componentSource).toContain(`${family.factory}(`);
        expect(componentSource).not.toContain(
          `../../factories/${family.factory}.js`
        );
        expect(componentSource).not.toContain(
          `../../factories/create${family.componentName}Palette.js`
        );
      }
    }
  });
});
