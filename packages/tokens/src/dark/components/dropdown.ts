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
  accent: colors.primary[400],
  accentHover: colors.primary[500],
  accentSoft: colors.primary[900],
  filledBg: colors.primary[950],
  filledHoverBg: colors.primary[900],
  ring: colors.primary[400],
});

const neutral = createInputColorPalette({
  ...dropdownPaletteDefaults,
  accent: colors.vellira[300],
  accentHover: colors.vellira[400],
  accentSoft: colors.vellira[800],
  filledBg: colors.vellira[900],
  filledHoverBg: colors.vellira[800],
  hoverBg: colors.vellira[900],
  ring: colors.vellira[400],
});

const success = createInputColorPalette({
  ...dropdownPaletteDefaults,
  accent: colors.success[400],
  accentHover: colors.success[500],
  accentSoft: colors.success[900],
  filledBg: colors.success[950],
  filledHoverBg: colors.success[900],
  hoverBg: colors.success[950],
  ring: colors.success[500],
});

const warning = createInputColorPalette({
  ...dropdownPaletteDefaults,
  accent: colors.warning[400],
  accentHover: colors.warning[500],
  accentSoft: colors.warning[900],
  filledBg: colors.warning[950],
  filledHoverBg: colors.warning[900],
  hoverBg: colors.warning[950],
  ring: colors.warning[500],
});

const danger = createInputColorPalette({
  ...dropdownPaletteDefaults,
  accent: colors.error[400],
  accentHover: colors.error[500],
  accentSoft: colors.error[900],
  filledBg: colors.error[950],
  filledHoverBg: colors.error[900],
  hoverBg: colors.error[950],
  ring: colors.error[500],
});

export const dropdown = createDropdownTokens({
  primary: createDropdownPalette(primary, {
    contentBorder: 'transparent',
    itemActiveBg: withAlpha(colors.primary[400], 0.18),
    itemActiveRing: 'transparent',
    itemHoverBg: withAlpha(colors.primary[400], 0.14),
    itemPressedBg: withAlpha(colors.primary[400], 0.22),
  }),
  neutral: createDropdownPalette(neutral, {
    contentBorder: 'transparent',
    itemActiveBg: colors.vellira[850],
    itemActiveFg: text.primary,
    itemActiveRing: 'transparent',
    itemHoverBg: colors.vellira[700],
    itemHoverFg: menu.item.hover.fg,
    itemPressedBg: colors.vellira[900],
    itemPressedFg: text.primary,
  }),
  success: createDropdownPalette(success, {
    contentBorder: 'transparent',
    itemActiveBg: withAlpha(colors.success[400], 0.18),
    itemActiveFg: colors.success[300],
    itemActiveRing: 'transparent',
    itemHoverBg: withAlpha(colors.success[400], 0.14),
    itemHoverFg: colors.success[300],
    itemPressedBg: withAlpha(colors.success[400], 0.22),
    itemPressedFg: colors.success[200],
  }),
  warning: createDropdownPalette(warning, {
    contentBorder: 'transparent',
    itemActiveBg: withAlpha(colors.warning[400], 0.18),
    itemActiveFg: colors.warning[300],
    itemActiveRing: 'transparent',
    itemHoverBg: withAlpha(colors.warning[400], 0.14),
    itemHoverFg: colors.warning[300],
    itemPressedBg: withAlpha(colors.warning[400], 0.22),
    itemPressedFg: colors.warning[200],
  }),
  danger: createDropdownPalette(danger, {
    contentBorder: 'transparent',
    itemActiveBg: withAlpha(colors.error[400], 0.18),
    itemActiveFg: colors.error[300],
    itemActiveRing: 'transparent',
    itemHoverBg: withAlpha(colors.error[400], 0.14),
    itemHoverFg: colors.error[300],
    itemPressedBg: withAlpha(colors.error[400], 0.22),
    itemPressedFg: colors.error[200],
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
    default: {
      bg: menu.item.default.bg,
      fg: menu.item.default.fg,
    },

    hover: {
      bg: menu.item.hover.bg,
      fg: menu.item.hover.fg,
    },

    active: {
      bg: menu.item.active.bg,
      fg: menu.item.active.fg,
      ring: 'transparent',
    },

    pressed: {
      bg: menu.item.pressed.bg,
      fg: menu.item.pressed.fg,
    },

    focus: {
      ring: createComponentFocusRing(focus.ring),
    },

    disabled: {
      bg: menu.item.disabled.bg,
      fg: menu.item.disabled.fg,
    },

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
