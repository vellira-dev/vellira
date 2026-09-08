import { describe, expect, it } from 'vitest';

import { darkTheme } from './dark/theme.js';
import { highContrastTheme } from './highContrast/theme.js';
import { lightTheme } from './light/theme.js';
import {
  componentTokenFamilyOwnershipV1,
  semanticTokenNamespaceOwnershipV1,
  tokenLifecycleStatuses,
} from './token-ownership.js';

const themes = [
  ['light', lightTheme],
  ['dark', darkTheme],
  ['high-contrast', highContrastTheme],
] as const;

const expectedPresentFamilies = (registry: Record<string, { presentInTheme: boolean }>) =>
  Object.entries(registry)
    .filter(([, ownership]) => ownership.presentInTheme)
    .map(([name]) => name)
    .sort();

describe('token ownership lifecycle registry', () => {
  it('uses only the canonical lifecycle vocabulary', () => {
    const allowed = new Set(tokenLifecycleStatuses);

    for (const ownership of [
      ...Object.values(componentTokenFamilyOwnershipV1),
      ...Object.values(semanticTokenNamespaceOwnershipV1),
    ]) {
      expect(allowed.has(ownership.lifecycle)).toBe(true);
    }
  });

  it('classifies every public component token family in every theme', () => {
    const expected = expectedPresentFamilies(componentTokenFamilyOwnershipV1);

    for (const [themeName, theme] of themes) {
      expect(Object.keys(theme.components).sort(), themeName).toEqual(expected);
    }
  });

  it('classifies every public semantic namespace in every theme', () => {
    const expected = expectedPresentFamilies(semanticTokenNamespaceOwnershipV1);

    for (const [themeName, theme] of themes) {
      expect(Object.keys(theme.semantic).sort(), themeName).toEqual(expected);
    }
  });

  it('keeps current component token families attached to canonical metadata owners', () => {
    for (const [family, ownership] of Object.entries(
      componentTokenFamilyOwnershipV1
    )) {
      if (ownership.lifecycle !== 'current') continue;

      expect(ownership.owner, family).toBe('component-metadata');
      expect(ownership.metadataComponent, family).not.toBeNull();
    }
  });

  it('records ContextMenu as compatibility-only instead of inventing metadata ownership', () => {
    expect(componentTokenFamilyOwnershipV1.contextMenu).toMatchObject({
      lifecycle: 'deprecated',
      owner: 'tokens-compatibility',
      metadataComponent: null,
      presentInTheme: true,
    });
  });

  it('prevents the removed semantic.navigation namespace from returning silently', () => {
    expect(semanticTokenNamespaceOwnershipV1.navigation).toMatchObject({
      lifecycle: 'deprecated',
      presentInTheme: false,
    });

    for (const [themeName, theme] of themes) {
      expect(theme.semantic, `${themeName} reintroduced semantic.navigation`).not.toHaveProperty(
        'navigation'
      );
    }
  });

  it('makes legacy semantic.action explicit instead of treating shape parity as authority', () => {
    expect(semanticTokenNamespaceOwnershipV1.action).toMatchObject({
      lifecycle: 'deprecated',
      owner: 'tokens-compatibility',
      presentInTheme: true,
    });
  });
});
