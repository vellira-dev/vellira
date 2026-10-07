import { describe, expect, it } from 'vitest';

import { highContrastTheme } from '../highContrast/theme';
import { lightTheme } from '../light/theme';

import { darkTheme } from './theme';

const relativeLuminance = (hex: string) => {
  const [red = 0, green = 0, blue = 0] = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => {
      const value = parseInt(channel, 16) / 255;

      return value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrastRatio = (foreground: string, background: string) => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
  ['high-contrast', highContrastTheme],
])('%s theme', (themeName, theme) => {
  it('exposes theme metadata', () => {
    expect(theme.name).toBe(themeName);
  });

  it('exposes theme contract', () => {
    expect(theme.colors).toBeDefined();
    expect(theme.semantic).toBeDefined();
    expect(theme.components).toBeDefined();
    expect(theme.tokens).toBeDefined();

    expect(theme.tokens.spacing).toBeDefined();
    expect(theme.tokens.radius).toBeDefined();
    expect(theme.tokens.shadows).toBeDefined();
    expect(theme.tokens.typography).toBeDefined();
    expect(theme.tokens.zIndex).toBeDefined();

    expect(theme.semantic.surface.default).toBeDefined();
    expect(theme.semantic.text.primary).toBeDefined();
    expect(theme.semantic.border.default).toBeDefined();
    expect(theme.semantic.focus.ring).toBeDefined();
    expect(theme.semantic.status.error.fg).toBeDefined();

    expect(theme.components.button.primary.solid.default.bg).toBeDefined();
    expect(theme.components.button.primary.outline.default.bg).toBeDefined();
    expect(theme.components.button.primary.ghost.default.bg).toBeDefined();

    expect(theme.components.input.default.bg).toBeDefined();
    expect(theme.components.checkbox.primary.default.bg).toBeDefined();
    expect(theme.components.checkbox.danger.default.bg).toBe(
      theme.components.button.danger.solid.default.bg
    );
    expect(theme.components.select.trigger.default.bg).toBeDefined();
    expect(theme.components.select.clearButton.hoverBg).toBeDefined();
    expect(theme.components.radio.size.md.controlSize).toBeDefined();
    expect(theme.components.radio.motion.controlDuration).toBeDefined();
    expect(theme.components.tabs.primary.trigger.default.bg).toBeDefined();
    expect(theme.components.tabs.success.indicator.bg).toBeDefined();
    expect(theme.components.tabs.disabled.fg).toBeDefined();
    expect(theme.components.tooltip.content.bg).toBeDefined();
  });
});

describe('dark theme select', () => {
  it('keeps option hover visible against the dropdown background', () => {
    expect(
      darkTheme.components.select.primary.outline.option.hover.bg
    ).not.toBe(darkTheme.components.select.dropdown.bg);
  });

  it('keeps filled hover placeholder contrast at AA level', () => {
    const colors = [
      'primary',
      'neutral',
      'success',
      'warning',
      'danger',
    ] as const;

    for (const color of colors) {
      const state = darkTheme.components.select[color].filled.hover;

      expect(contrastRatio(state.placeholder, state.bg)).toBeGreaterThanOrEqual(
        4.5
      );
    }
  });
});

describe('high contrast theme', () => {
  it('keeps primary component accents on the brand primary scale', () => {
    expect(highContrastTheme.components.button.primary.solid.default.bg).toBe(
      highContrastTheme.colors.primary[600]
    );
    expect(highContrastTheme.components.checkbox.primary.default.bg).toBe(
      highContrastTheme.colors.primary[600]
    );
    expect(highContrastTheme.components.radio.primary.default.bg).toBe(
      highContrastTheme.colors.primary[600]
    );
    expect(
      highContrastTheme.components.input.primary.outline.default.border
    ).toBe(highContrastTheme.colors.primary[300]);
    expect(
      highContrastTheme.components.select.primary.outline.default.border
    ).toBe(highContrastTheme.colors.primary[300]);
    expect(highContrastTheme.components.dropdown.primary.ring).toBe(
      highContrastTheme.colors.primary[300]
    );
    expect(highContrastTheme.components.tabs.primary.indicator.bg).toBe(
      highContrastTheme.colors.primary[300]
    );
  });

  it('keeps primary and warning component accents distinct', () => {
    expect(
      highContrastTheme.components.button.primary.solid.default.bg
    ).not.toBe(highContrastTheme.components.button.warning.solid.default.bg);
    expect(highContrastTheme.components.checkbox.primary.default.bg).not.toBe(
      highContrastTheme.components.checkbox.warning.default.bg
    );
    expect(highContrastTheme.components.radio.primary.default.bg).not.toBe(
      highContrastTheme.components.radio.warning.default.bg
    );
    expect(
      highContrastTheme.components.input.primary.outline.default.border
    ).not.toBe(
      highContrastTheme.components.input.warning.outline.default.border
    );
    expect(
      highContrastTheme.components.select.primary.outline.default.border
    ).not.toBe(
      highContrastTheme.components.select.warning.outline.default.border
    );
    expect(highContrastTheme.components.dropdown.primary.ring).not.toBe(
      highContrastTheme.components.dropdown.warning.ring
    );
    expect(highContrastTheme.components.tabs.primary.indicator.bg).not.toBe(
      highContrastTheme.components.tabs.warning.indicator.bg
    );
  });
});


describe('button link interaction', () => {
  it('keeps primary link hover visibly distinct from the default state', () => {
    for (const theme of [lightTheme, darkTheme]) {
      expect(theme.components.button.primary.link.hover.fg).not.toBe(
        theme.components.button.primary.link.default.fg
      );
    }
  });
});
