import {
  createButtonPalette,
  createButtonTokens,
} from '../../factories/createButtonTokens.js';
import { colors } from '../../primitives/colors.js';
import { border } from '../semantic/border.js';
import { surface } from '../semantic/surface.js';
import { text } from '../semantic/text.js';

const primary = createButtonPalette({
  ring: colors.primary[400],
  solid: {
    default: {
      bg: colors.primary[600],
      fg: colors.primary[50],
      border: colors.primary[600],
    },
    hover: {
      bg: colors.primary[700],
      fg: colors.primary[200],
      border: colors.primary[700],
    },
    pressed: {
      bg: colors.primary[800],
      fg: colors.primary[300],
      border: colors.primary[800],
    },
  },
  fg: colors.primary[700],
  bg: colors.primary[50],
  border: colors.primary[400],

  hoverFg: colors.primary[800],
  hoverBg: colors.primary[100],
  hoverBorder: colors.primary[500],

  pressedFg: colors.primary[900],
  pressedBg: colors.primary[200],
  pressedBorder: colors.primary[600],
});

const neutral = createButtonPalette({
  ring: colors.vellira[400],
  solid: {
    default: {
      bg: colors.vellira[200],
      fg: colors.vellira[950],
      border: colors.vellira[200],
    },
    hover: {
      bg: colors.vellira[300],
      fg: colors.vellira[900],
      border: colors.vellira[300],
    },
    pressed: {
      bg: colors.vellira[400],
      fg: colors.vellira[800],
      border: colors.vellira[400],
    },
  },
  fg: colors.vellira[600],
  bg: colors.vellira[100],
  border: colors.vellira[400],

  hoverFg: colors.vellira[700],
  hoverBg: colors.vellira[200],
  hoverBorder: colors.vellira[500],

  pressedFg: colors.vellira[800],
  pressedBg: colors.vellira[300],
  pressedBorder: colors.vellira[600],
});

const success = createButtonPalette({
  ring: colors.success[500],
  solid: {
    default: {
      bg: colors.success[500],
      fg: colors.success[950],
      border: colors.success[500],
    },
    hover: {
      bg: colors.success[600],
      fg: colors.success[900],
      border: colors.success[600],
    },
    pressed: {
      bg: colors.success[700],
      fg: colors.success[800],
      border: colors.success[700],
    },
  },
  fg: colors.success[700],
  bg: colors.success[50],
  border: colors.success[600],

  hoverFg: colors.success[800],
  hoverBg: colors.success[100],
  hoverBorder: colors.success[700],

  pressedFg: colors.success[900],
  pressedBg: colors.success[200],
  pressedBorder: colors.success[800],
});

const warning = createButtonPalette({
  ring: colors.warning[500],
  solid: {
    default: {
      bg: colors.warning[500],
      fg: colors.warning[950],
      border: colors.warning[500],
    },
    hover: {
      bg: colors.warning[600],
      fg: colors.warning[900],
      border: colors.warning[600],
    },
    pressed: {
      bg: colors.warning[700],
      fg: colors.warning[800],
      border: colors.warning[700],
    },
  },
  fg: colors.warning[700],
  bg: colors.warning[50],
  border: colors.warning[600],

  hoverFg: colors.warning[800],
  hoverBg: colors.warning[100],
  hoverBorder: colors.warning[700],

  pressedFg: colors.warning[900],
  pressedBg: colors.warning[200],
  pressedBorder: colors.warning[800],
});

const danger = createButtonPalette({
  ring: colors.error[500],

  solid: {
    default: {
      bg: colors.error[700],
      fg: colors.error[50],
      border: colors.error[700],
    },
    hover: {
      bg: colors.error[800],
      fg: colors.error[200],
      border: colors.error[800],
    },
    pressed: {
      bg: colors.error[900],
      fg: colors.error[300],
      border: colors.error[900],
    },
  },
  fg: colors.error[700],
  bg: colors.error[50],
  border: colors.error[500],

  hoverFg: colors.error[800],
  hoverBg: colors.error[100],
  hoverBorder: colors.error[700],

  pressedFg: colors.error[700],
  pressedBg: colors.error[200],
  pressedBorder: colors.error[600],
});

export const button = createButtonTokens({
  primary,
  neutral,
  success,
  warning,
  danger,

  disabled: {
    bg: surface.disabled,
    fg: text.disabled,
    border: border.disabled,
  },
});
