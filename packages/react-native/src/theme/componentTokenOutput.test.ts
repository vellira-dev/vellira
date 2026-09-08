import { describe, expect, it } from 'vitest';

import { resolveComponentTokenPlatformOutputs } from './componentTokenOutput';
import { nativeThemes } from './themes';

const themes = [
  ['light', nativeThemes.light],
  ['dark', nativeThemes.dark],
  ['high-contrast', nativeThemes.highContrast],
] as const;

describe('React Native component token platform output', () => {
  for (const [themeName, theme] of themes) {
    it(`preserves model-derived elevation output for ${themeName}`, () => {
      const popover = resolveComponentTokenPlatformOutputs(
        theme,
        theme.components.popover.content
      );
      expect(popover.web.shadow).toBe(theme.semantic.shadow.lg);
      expect(popover.reactNative.shadow).toEqual(theme.tokens.shadows.lg);

      const modal = resolveComponentTokenPlatformOutputs(
        theme,
        theme.components.modal.content
      );
      expect(modal.web.shadow).toBe(theme.semantic.shadow.xl);
      expect(modal.reactNative.shadow).toEqual(theme.tokens.shadows.lg);

      const elevationProbe = {
        sm: { kind: 'shadow', role: 'elevation', level: 'sm' },
        md: { kind: 'shadow', role: 'elevation', level: 'md' },
        lg: { kind: 'shadow', role: 'elevation', level: 'lg' },
        xl: { kind: 'shadow', role: 'elevation', level: 'xl' },
      } as const;
      const elevationOutput = resolveComponentTokenPlatformOutputs(
        theme,
        elevationProbe
      );

      expect(elevationOutput.reactNative).toEqual({
        sm: theme.tokens.shadows.sm,
        md: theme.tokens.shadows.md,
        lg: theme.tokens.shadows.lg,
        xl: theme.tokens.shadows.lg,
      });
      expect(elevationOutput.web).toEqual({
        sm: theme.semantic.shadow.sm,
        md: theme.semantic.shadow.md,
        lg: theme.semantic.shadow.lg,
        xl: theme.semantic.shadow.xl,
      });
    });
  }

  it('keeps viewport and non-elevation intent renderer-specific only at output', () => {
    const theme = nativeThemes.dark;
    const probe = {
      viewport: { kind: 'viewport-height', ratio: 0.9 },
      focus: { kind: 'shadow', role: 'focus-ring' },
      none: { kind: 'shadow', role: 'none' },
    } as const;

    const output = resolveComponentTokenPlatformOutputs(theme, probe);

    expect(output.web).toEqual({
      viewport: '90vh',
      focus: theme.semantic.focus.ring.shadow,
      none: 'none',
    });
    expect(output.reactNative).toEqual({
      viewport: '90%',
      focus: null,
      none: null,
    });
  });
});
