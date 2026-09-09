import {
  createInputColorPalette,
  createInputTokens,
} from '../../factories/components/createInputTokens.js';
import { colors } from '../../primitives/colors.js';
import { border } from '../semantic/border.js';
import { focus } from '../semantic/focus.js';
import { icons } from '../semantic/icons.js';
import { status } from '../semantic/status.js';
import { surface } from '../semantic/surface.js';
import { text } from '../semantic/text.js';

const inputPaletteDefaults = {
  fg: text.primary,
  placeholder: text.secondary,
  filledFocusBg: surface.subtle,
  hoverBg: surface.hover,
};

const primary = createInputColorPalette({
  ...inputPaletteDefaults,
  accent: colors.primary[400],
  accentHover: colors.primary[500],
  accentSoft: colors.primary[900],
  filledBg: colors.primary[950],
  filledHoverBg: colors.primary[900],
  ring: colors.primary[400],
});

const neutral = createInputColorPalette({
  ...inputPaletteDefaults,
  accent: colors.vellira[300],
  accentHover: colors.vellira[400],
  accentSoft: colors.vellira[800],
  filledBg: colors.vellira[900],
  filledHoverBg: colors.vellira[800],
  hoverBg: colors.vellira[900],
  ring: colors.vellira[400],
});

const success = createInputColorPalette({
  ...inputPaletteDefaults,
  accent: colors.success[400],
  accentHover: colors.success[500],
  accentSoft: colors.success[900],
  filledBg: colors.success[950],
  filledHoverBg: colors.success[900],
  hoverBg: colors.success[950],
  ring: colors.success[500],
});

const warning = createInputColorPalette({
  ...inputPaletteDefaults,
  accent: colors.warning[400],
  accentHover: colors.warning[500],
  accentSoft: colors.warning[900],
  filledBg: colors.warning[950],
  filledHoverBg: colors.warning[900],
  hoverBg: colors.warning[950],
  ring: colors.warning[500],
});

const danger = createInputColorPalette({
  ...inputPaletteDefaults,
  accent: colors.error[400],
  accentHover: colors.error[500],
  accentSoft: colors.error[900],
  filledBg: colors.error[950],
  filledHoverBg: colors.error[900],
  hoverBg: colors.error[950],
  ring: colors.error[500],
});

export const input = createInputTokens({
  primary,
  neutral,
  success,
  warning,
  danger,

  default: {
    bg: 'transparent',
    fg: text.primary,
    border: border.default,
    placeholder: text.secondary,
    icon: icons.brand,
  },

  hover: {
    bg: surface.hover,
    fg: text.primary,
    border: border.interactive,
    placeholder: text.secondary,
    icon: icons.interactiveHover,
  },

  focus: {
    bg: 'transparent',
    fg: text.primary,
    border: border.interactive,
    ring: focus.ring.color,
    placeholder: text.secondary,
    icon: icons.brand,
  },

  disabled: {
    bg: surface.disabled,
    fg: text.disabled,
    border: border.disabled,
    placeholder: text.disabled,
    icon: icons.disabled,
  },

  error: {
    border: status.error.border,
    ring: status.error.fg,
  },

  readOnly: {
    bg: surface.subtle,
    fg: text.secondary,
    border: border.muted,
    placeholder: text.muted,
    icon: icons.muted,
  },

  icon: {
    default: icons.default,
    primary: icons.interactive,
    secondary: icons.secondary,
    success: icons.success,
    danger: icons.danger,
    muted: icons.muted,
    inverse: icons.inverse,
    brand: icons.brand,
  },

  clearButton: {
    fg: icons.muted,
    hoverFg: status.error.fg,
    hoverBg: status.error.bg,
    focusBg: surface.subtle,
    pressedBg: surface.pressed,
  },

  revealButton: {
    fg: text.primary,
    hoverFg: text.primary,
    hoverBg: surface.hover,
  },

  addon: {
    bg: surface.muted,
    fg: text.secondary,
    border: border.default,
  },

  affix: {
    fg: text.primary,
  },

  counter: {
    fg: text.secondary,
  },

  spinner: {
    fg: icons.muted,
  },
});
