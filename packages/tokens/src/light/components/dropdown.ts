import {
  createDropdownPalette,
  createDropdownTokens,
} from '../../factories/components/createDropdownTokens.js';
import { createInputColorPalette } from '../../factories/components/createInputTokens.js';
import { createComponentFocusRing } from '../../factories/shared/componentFocusRing.js';
import { createComponentShadowIntent } from '../../platform-output/component-token-intents.js';
import { colors } from '../../primitives/colors.js';
import { withAlpha } from '../../utils/color.js';
import { border } from '../semantic/border.js';
import { focus } from '../semantic/focus.js';
import { menu } from '../semantic/menu.js';
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
  accent: colors.primary[500],
  accentHover: colors.primary[700],
  accentSoft: colors.primary[50],
  filledBg: colors.primary[100],
  filledHoverBg: colors.primary[200],
  ring: colors.primary[400],
});

const neutral = createInputColorPalette({
  ...dropdownPaletteDefaults,
  accent: colors.vellira[400],
  accentHover: colors.vellira[600],
  accentSoft: colors.vellira[100],
  filledBg: colors.vellira[150],
  filledHoverBg: colors.vellira[200],
  hoverBg: colors.vellira[100],
  ring: colors.vellira[400],
});

const success = createInputColorPalette({
  ...dropdownPaletteDefaults,
  accent: colors.success[600],
  accentHover: colors.success[800],
  accentSoft: colors.success[50],
  filledBg: colors.success[100],
  filledHoverBg: colors.success[200],
  hoverBg: colors.success[50],
  ring: colors.success[500],
});

const warning = createInputColorPalette({
  ...dropdownPaletteDefaults,
  accent: colors.warning[600],
  accentHover: colors.warning[800],
  accentSoft: colors.warning[50],
  filledBg: colors.warning[100],
  filledHoverBg: colors.warning[200],
  hoverBg: colors.warning[50],
  ring: colors.warning[500],
});

const danger = createInputColorPalette({
  ...dropdownPaletteDefaults,
  accent: colors.error[600],
  accentHover: colors.error[800],
  accentSoft: colors.error[50],
  filledBg: colors.error[100],
  filledHoverBg: colors.error[200],
  hoverBg: colors.error[50],
  ring: colors.error[500],
});

export const dropdown = createDropdownTokens({
  primary: createDropdownPalette(primary, {
    contentBorder: 'transparent',
    itemActiveBg: colors.primary[100],
    itemActiveRing: 'transparent',
    itemHoverBg: colors.primary[50],
    itemPressedBg: colors.primary[200],
  }),
  neutral: createDropdownPalette(neutral, {
    contentBorder: 'transparent',
    itemActiveBg: colors.vellira[150],
    itemActiveRing: 'transparent',
    itemHoverBg: colors.vellira[100],
    itemPressedBg: colors.vellira[200],
  }),
  success: createDropdownPalette(success, {
    contentBorder: 'transparent',
    itemActiveBg: withAlpha(colors.success[600], 0.14),
    itemActiveFg: colors.success[700],
    itemActiveRing: 'transparent',
    itemHoverBg: withAlpha(colors.success[600], 0.1),
    itemHoverFg: colors.success[700],
    itemPressedBg: withAlpha(colors.success[600], 0.18),
    itemPressedFg: colors.success[800],
  }),
  warning: createDropdownPalette(warning, {
    contentBorder: 'transparent',
    itemActiveBg: withAlpha(colors.warning[600], 0.14),
    itemActiveFg: colors.warning[700],
    itemActiveRing: 'transparent',
    itemHoverBg: withAlpha(colors.warning[600], 0.1),
    itemHoverFg: colors.warning[700],
    itemPressedBg: withAlpha(colors.warning[600], 0.18),
    itemPressedFg: colors.warning[800],
  }),
  danger: createDropdownPalette(danger, {
    contentBorder: 'transparent',
    itemActiveBg: withAlpha(colors.error[600], 0.14),
    itemActiveFg: colors.error[700],
    itemActiveRing: 'transparent',
    itemHoverBg: withAlpha(colors.error[600], 0.1),
    itemHoverFg: colors.error[700],
    itemPressedBg: withAlpha(colors.error[600], 0.18),
    itemPressedFg: colors.error[800],
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
      border: 'transparent',
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
    bg: border.muted,
    fg: text.muted,
  },
});
