import { describe, expect, it } from 'vitest';

import { darkTheme } from './dark/theme.js';
import { highContrastTheme } from './highContrast/theme.js';
import { lightTheme } from './light/theme.js';
import { colors } from './primitives/colors.js';
import { semanticVocabularyV1 } from './token-architecture.js';

const themes = [
  ['light', lightTheme],
  ['dark', darkTheme],
  ['high-contrast', highContrastTheme],
] as const;

describe('Semantic Vocabulary V1', () => {
  it.each(themes)('%s exposes only canonical renamed roles', (_name, theme) => {
    expect(theme.semantic.surface).not.toHaveProperty('background');
    expect(theme.semantic.surface).toHaveProperty('panel');
    expect(theme.semantic.action).toHaveProperty('accent');
    expect(theme.semantic.action).toHaveProperty('neutral');
    expect(theme.semantic.action).not.toHaveProperty('secondary');
    expect(theme.semantic.action).not.toHaveProperty('close');
    expect(theme.semantic.icons).toHaveProperty('interactive');
    expect(theme.semantic.icons).toHaveProperty('interactiveHover');
    expect(theme.semantic.icons).not.toHaveProperty('primary');
    expect(theme.semantic.icons).not.toHaveProperty('hover');
    expect(theme.semantic.border).toHaveProperty('interactive');
    expect(theme.semantic.border).not.toHaveProperty('focus');
    expect(theme.semantic.focus.ring).toHaveProperty('offsetColor');
    expect(theme.semantic.focus.ring).not.toHaveProperty('offset');
    expect(theme.semantic.overlay).toHaveProperty('floating');
    expect(theme.semantic.overlay).toHaveProperty('dialog');
    expect(theme.semantic.overlay).not.toHaveProperty('popover');
    expect(theme.semantic.overlay).not.toHaveProperty('modal');
    expect(theme.semantic).not.toHaveProperty('navigation');

    for (const status of Object.values(theme.semantic.status)) {
      expect(status).toHaveProperty('emphasisFg');
      expect(status).not.toHaveProperty('strong');
    }
  });

  it('publishes machine-readable purpose boundaries for every V1 namespace', () => {
    expect(Object.keys(semanticVocabularyV1)).toEqual([
      'surface',
      'text',
      'icons',
      'border',
      'divider',
      'focus',
      'status',
      'action',
      'control',
      'menu',
      'overlay',
      'shadow',
    ]);
    expect(semanticVocabularyV1.surface.roles).toContain('panel');
    expect(semanticVocabularyV1.action.roles).toEqual([
      'primary',
      'accent',
      'neutral',
      'danger',
    ]);
    expect(semanticVocabularyV1.focus.roles).toContain('ring.offsetColor');
    expect(semanticVocabularyV1.shadow.roles).toEqual([
      'sm',
      'md',
      'lg',
      'xl',
      'inset',
    ]);
  });

  it('keeps panel separate from canvas and preserves the former bounded-container values', () => {
    expect(lightTheme.semantic.surface.canvas).toBe(colors.vellira[50]);
    expect(lightTheme.semantic.surface.panel).toBe(colors.mono[50]);
    expect(darkTheme.semantic.surface.canvas).toBe(colors.mono[950]);
    expect(darkTheme.semantic.surface.panel).toBe(colors.vellira[950]);
    expect(highContrastTheme.semantic.surface.canvas).toBe(colors.mono[950]);
    expect(highContrastTheme.semantic.surface.panel).toBe(colors.grayBlue[950]);
  });

  it('keeps muted stronger than subtle in corrected dark foreground hierarchies', () => {
    expect(darkTheme.semantic.text.muted).toBe(colors.mono[500]);
    expect(darkTheme.semantic.text.subtle).toBe(colors.vellira[400]);
    expect(highContrastTheme.semantic.icons.muted).toBe(colors.gray[300]);
    expect(highContrastTheme.semantic.icons.subtle).toBe(colors.gray[400]);
  });

  it('uses each Dark status palette for its own ring', () => {
    expect(darkTheme.semantic.status.warning.ring).toBe(colors.warning[300]);
    expect(darkTheme.semantic.status.info.ring).toBe(colors.info[200]);
    expect(darkTheme.semantic.status.warning.ring).not.toBe(colors.error[400]);
    expect(darkTheme.semantic.status.info.ring).not.toBe(colors.error[400]);
  });
});
