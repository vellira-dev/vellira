import { createComponentFocusRing } from '../../factories/componentFocusRing.js';
import {
  createDropdownPalette,
  createDropdownTokens,
} from '../../factories/createDropdownTokens.js';
import { createInputColorPalette } from '../../factories/createInputTokens.js';
import { createComponentShadowIntent } from '../../platform-output/component-token-intents.js';
import { colors } from '../../primitives/colors.js';
import { border } from '../semantic/border.js';
import { focus } from '../semantic/focus.js';
import { menu } from '../semantic/menu.js';
import { status } from '../semantic/status.js';
import { surface } from '../semantic/surface.js';
import { text } from '../semantic/text.js';

const dropdownPaletteDefaults = {
  fg: text.primary,
  placeholder: text.secondary,
  filledFocusBg: surface.subtle,
  hoverBg: surface.hover,
};

const primary = createInputColorPalette({
  ...dropdownPaletteDefaults,
  accent: colors.primary[300],
  accentHover: colors.primary[200],
  accentSoft: colors.primary[950],
  filledBg: colors.primary[900],
  filledHoverBg: colors.primary[800],
  ring: colors.primary[300],
});

const neutral = createInputColorPalette({
  ...dropdownPaletteDefaults,
  accent: colors.vellira[100],
  accentHover: colors.vellira[50],
  accentSoft: colors.vellira[900],
  filledBg: colors.vellira[850],
  filledHoverBg: colors.vellira[800],
  hoverBg: colors.vellira[850],
  ring: colors.vellira[100],
});

const success = createInputColorPalette({
  ...dropdownPaletteDefaults,
  accent: colors.success[300],
  accentHover: colors.success[200],
  accentSoft: colors.success[950],
  filledBg: colors.success[900],
  filledHoverBg: colors.success[800],
  hoverBg: colors.success[950],
  ring: colors.success[300],
});

const warning = createInputColorPalette({
  ...dropdownPaletteDefaults,
  accent: colors.warning[300],
  accentHover: colors.warning[200],
  accentSoft: colors.warning[950],
  filledBg: colors.warning[900],
  filledHoverBg: colors.warning[800],
  hoverBg: colors.warning[950],
  ring: colors.warning[300],
});

const danger = createInputColorPalette({
  ...dropdownPaletteDefaults,
  accent: colors.error[300],
  accentHover: colors.error[200],
  accentSoft: colors.error[950],
  filledBg: colors.error[900],
  filledHoverBg: colors.error[800],
  hoverBg: colors.error[950],
  ring: colors.error[300],
});

export const dropdown = createDropdownTokens({
  primary: createDropdownPalette(primary, {
    contentBorder: border.default,
    itemActiveRing: status.warning.border,
  }),
  neutral: createDropdownPalette(neutral, {
    contentBorder: border.default,
    itemActiveRing: status.warning.border,
  }),
  success: createDropdownPalette(success, {
    contentBorder: border.default,
    itemActiveRing: status.warning.border,
  }),
  warning: createDropdownPalette(warning, {
    contentBorder: border.default,
    itemActiveRing: status.warning.border,
  }),
  danger: createDropdownPalette(danger, {
    contentBorder: border.default,
    itemActiveRing: status.warning.border,
  }),

  trigger: {
    default: {
      bg: 'transparent',
      fg: text.interactive,
      border: 'transparent',
    },

    hover: {
      bg: surface.hover,
      fg: text.interactiveHover,
      border: status.warning.border,
      ring: 'transparent',
    },

    focus: {
      bg: 'transparent',
      fg: text.interactive,
      border: border.interactive,
      ring: createComponentFocusRing(focus.ring),
    },

    disabled: {
      bg: surface.disabled,
      fg: text.disabled,
      border: border.disabled,
    },
  },

  content: {
    bg: menu.background,
    fg: menu.item.default.fg,
    border: menu.border,
    shadow: createComponentShadowIntent('lg'),
  },

  item: {
    default: menu.item.default,
    hover: menu.item.hover,

    active: {
      ...menu.item.active,
      ring: 'transparent',
    },

    pressed: menu.item.pressed,

    focus: {
      ring: createComponentFocusRing(focus.ring),
    },

    disabled: menu.item.disabled,

    danger: {
      default: menu.item.danger.default,
      hover: menu.item.danger.hover,

      active: {
        ...menu.item.danger.active,
        ring: 'transparent',
      },

      disabled: menu.item.danger.disabled,
    },
  },

  groupLabel: {
    fg: text.secondary,
  },

  separator: {
    bg: border.default,
    fg: text.muted,
  },
});
