import { createInputColorPalette } from '../../factories/components/createInputTokens.js';
import {
  createSelectPalette,
  createSelectTokens,
} from '../../factories/components/createSelectTokens.js';
import {
  createComponentNoShadowIntent,
  createComponentShadowIntent,
} from '../../platform-output/component-token-intents.js';
import { colors } from '../../primitives/colors.js';
import { border } from '../semantic/border.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';
import { icons } from '../semantic/icons.js';
import { menu } from '../semantic/menu.js';
import { status } from '../semantic/status.js';
import { surface } from '../semantic/surface.js';
import { text } from '../semantic/text.js';

const selectPaletteDefaults = {
  fg: text.primary,
  placeholder: text.secondary,
  filledFocusBg: surface.subtle,
  hoverBg: surface.hover,
};

const primary = createInputColorPalette({
  ...selectPaletteDefaults,
  accent: colors.primary[300],
  accentHover: colors.primary[400],

  accentSoft: colors.primary[900],

  filledBg: colors.primary[950],
  filledHoverBg: colors.primary[900],

  filledDefaultBorder: colors.primary[300],
  filledHoverBorder: colors.primary[400],

  softDefaultBorder: colors.primary[300],
  softHoverBorder: colors.primary[400],

  ring: colors.primary[400],
});

const neutral = createInputColorPalette({
  ...selectPaletteDefaults,
  accent: colors.grayBlue[200],
  accentHover: colors.gray[200],

  accentSoft: colors.grayBlue[800],

  filledBg: colors.grayBlue[900],
  filledHoverBg: colors.grayBlue[800],

  filledDefaultBorder: colors.grayBlue[200],
  filledHoverBorder: colors.gray[200],

  softDefaultBorder: colors.grayBlue[200],
  softHoverBorder: colors.gray[200],

  hoverBg: colors.grayBlue[900],
  ring: colors.grayBlue[400],
});

const success = createInputColorPalette({
  ...selectPaletteDefaults,
  accent: colors.success[300],
  accentHover: colors.success[400],

  accentSoft: colors.success[900],

  filledBg: colors.success[950],
  filledHoverBg: colors.success[900],

  filledDefaultBorder: colors.success[300],
  filledHoverBorder: colors.success[400],

  softDefaultBorder: colors.success[300],
  softHoverBorder: colors.success[400],

  hoverBg: colors.success[950],
  ring: colors.success[500],
});

const warning = createInputColorPalette({
  ...selectPaletteDefaults,
  accent: colors.warning[500],
  accentHover: colors.warning[400],

  accentSoft: colors.warning[900],

  filledBg: colors.warning[900],
  filledHoverBg: colors.warning[800],

  filledDefaultBorder: colors.warning[500],
  filledHoverBorder: colors.warning[400],

  softDefaultBorder: colors.warning[500],
  softHoverBorder: colors.warning[400],

  hoverBg: colors.warning[950],
  ring: colors.warning[500],
});

const danger = createInputColorPalette({
  ...selectPaletteDefaults,
  accent: colors.error[400],

  accentHover: colors.error[300],

  accentSoft: colors.error[900],

  filledBg: colors.error[950],
  filledHoverBg: colors.error[900],

  filledDefaultBorder: colors.error[400],
  filledHoverBorder: colors.error[300],

  softDefaultBorder: colors.error[400],
  softHoverBorder: colors.error[300],

  hoverBg: colors.error[950],
  ring: colors.error[500],
});

export const select = createSelectTokens({
  primary: createSelectPalette(primary, {
    optionActiveBorder: 'transparent',
    optionActiveBg: menu.item.active.bg,
    optionActiveFg: menu.item.active.fg,
    optionActiveRing: 'transparent',
    optionHoverBg: menu.item.hover.bg,
    optionHoverBorder: 'transparent',
    optionHoverFg: menu.item.hover.fg,
    optionPressedBg: menu.item.pressed.bg,
    optionPressedBorder: 'transparent',
    optionPressedFg: menu.item.pressed.fg,
    optionSelectedActiveBg: menu.item.active.bg,
    optionSelectedActiveFg: menu.item.active.fg,
    optionSelectedHoverBg: menu.item.hover.bg,
    optionSelectedHoverFg: menu.item.hover.fg,
    optionSelectedPressedBg: menu.item.pressed.bg,
    optionSelectedPressedFg: menu.item.pressed.fg,
  }),
  neutral: createSelectPalette(neutral, {
    optionActiveBorder: 'transparent',
    optionActiveBg: menu.item.active.bg,
    optionActiveFg: menu.item.active.fg,
    optionActiveRing: 'transparent',
    optionHoverBg: menu.item.hover.bg,
    optionHoverBorder: 'transparent',
    optionHoverFg: menu.item.hover.fg,
    optionPressedBg: menu.item.pressed.bg,
    optionPressedBorder: 'transparent',
    optionPressedFg: menu.item.pressed.fg,
    optionSelectedActiveBg: menu.item.active.bg,
    optionSelectedActiveFg: menu.item.active.fg,
    optionSelectedHoverBg: menu.item.hover.bg,
    optionSelectedHoverFg: menu.item.hover.fg,
    optionSelectedPressedBg: menu.item.pressed.bg,
    optionSelectedPressedFg: menu.item.pressed.fg,
  }),
  success: createSelectPalette(success, {
    optionActiveBorder: 'transparent',
    optionActiveBg: menu.item.active.bg,
    optionActiveFg: menu.item.active.fg,
    optionActiveRing: 'transparent',
    optionHoverBg: menu.item.hover.bg,
    optionHoverBorder: 'transparent',
    optionHoverFg: menu.item.hover.fg,
    optionPressedBg: menu.item.pressed.bg,
    optionPressedBorder: 'transparent',
    optionPressedFg: menu.item.pressed.fg,
    optionSelectedActiveBg: menu.item.active.bg,
    optionSelectedActiveFg: menu.item.active.fg,
    optionSelectedHoverBg: menu.item.hover.bg,
    optionSelectedHoverFg: menu.item.hover.fg,
    optionSelectedPressedBg: menu.item.pressed.bg,
    optionSelectedPressedFg: menu.item.pressed.fg,
  }),
  warning: createSelectPalette(warning, {
    optionActiveBorder: 'transparent',
    optionActiveBg: menu.item.active.bg,
    optionActiveFg: menu.item.active.fg,
    optionActiveRing: 'transparent',
    optionHoverBg: menu.item.hover.bg,
    optionHoverBorder: 'transparent',
    optionHoverFg: menu.item.hover.fg,
    optionPressedBg: menu.item.pressed.bg,
    optionPressedBorder: 'transparent',
    optionPressedFg: menu.item.pressed.fg,
    optionSelectedActiveBg: menu.item.active.bg,
    optionSelectedActiveFg: menu.item.active.fg,
    optionSelectedHoverBg: menu.item.hover.bg,
    optionSelectedHoverFg: menu.item.hover.fg,
    optionSelectedPressedBg: menu.item.pressed.bg,
    optionSelectedPressedFg: menu.item.pressed.fg,
  }),
  danger: createSelectPalette(danger, {
    optionActiveBorder: 'transparent',
    optionActiveBg: menu.item.active.bg,
    optionActiveFg: menu.item.active.fg,
    optionActiveRing: 'transparent',
    optionHoverBg: menu.item.hover.bg,
    optionHoverBorder: 'transparent',
    optionHoverFg: menu.item.hover.fg,
    optionPressedBg: menu.item.pressed.bg,
    optionPressedBorder: 'transparent',
    optionPressedFg: menu.item.pressed.fg,
    optionSelectedActiveBg: menu.item.active.bg,
    optionSelectedActiveFg: menu.item.active.fg,
    optionSelectedHoverBg: menu.item.hover.bg,
    optionSelectedHoverFg: menu.item.hover.fg,
    optionSelectedPressedBg: menu.item.pressed.bg,
    optionSelectedPressedFg: menu.item.pressed.fg,
  }),

  trigger: {
    default: {
      bg: 'transparent',
      fg: text.primary,
      border: border.default,
      icon: icons.brand,
      placeholder: text.secondary,
    },

    hover: {
      ...control.hover,
      icon: icons.interactiveHover,
      placeholder: text.secondary,
    },

    focus: {
      bg: 'transparent',
      fg: text.primary,
      border: border.interactive,
      ring: focus.ring.color,
      icon: icons.brand,
      placeholder: text.secondary,
    },

    disabled: {
      ...control.disabled,
      icon: icons.disabled,
      placeholder: text.disabled,
    },

    placeholder: {
      fg: text.secondary,
    },

    error: {
      border: status.error.border,
      ring: status.error.ring,
    },
  },

  dropdown: {
    bg: menu.background,
    fg: menu.item.default.fg,
    border: menu.border,
    shadow: createComponentShadowIntent('lg'),

    search: {
      bg: surface.default,
      fg: text.primary,
      border: border.muted,
      placeholder: text.secondary,
      ring: focus.ring.color,
    },

    empty: {
      fg: text.secondary,
    },

    groupLabel: {
      fg: colors.primary[300],
    },

    separator: {
      bg: border.muted,
    },
  },

  clearButton: {
    fg: icons.muted,
    hoverFg: status.error.fg,
    hoverBg: status.error.bg,
    focusBg: surface.subtle,
    pressedBg: surface.pressed,
  },

  option: {
    default: {
      ...menu.item.default,
      border: 'transparent',
    },

    hover: {
      ...menu.item.hover,
      border: 'transparent',
    },

    active: {
      ...menu.item.active,
      border: 'transparent',
      ring: 'transparent',
    },

    pressed: {
      ...menu.item.pressed,
      border: 'transparent',
    },

    selected: {
      bg: control.selected.muted.bg,
      fg: control.selected.muted.fg,
      border: control.selected.muted.border,
      shadow: createComponentNoShadowIntent(),
    },

    disabled: {
      ...menu.item.disabled,
      border: 'transparent',
    },

    description: {
      fg: text.secondary,
    },

    icon: {
      fg: icons.default,
    },

    badge: {
      bg: surface.subtle,
      fg: text.secondary,
      border: border.muted,
    },

    shortcut: {
      bg: surface.subtle,
      fg: text.secondary,
      border: border.muted,
    },

    success: {
      fg: status.success.fg,
    },

    warning: {
      fg: status.warning.fg,
    },

    danger: {
      fg: status.error.fg,
    },
  },
});
