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
  ...inputPaletteDefaults,
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
  ...inputPaletteDefaults,
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
  ...inputPaletteDefaults,
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
  ...inputPaletteDefaults,
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
    ring: status.error.ring,
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
    hoverFg: colors.error[400],
    hoverBg: colors.error[950],
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
