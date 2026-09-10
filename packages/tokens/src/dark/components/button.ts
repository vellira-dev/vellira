import {
  createButtonPalette,
  createButtonTokens,
} from '../../factories/components/createButtonTokens.js';
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
  fg: colors.primary[400],
  bg: colors.primary[950],
  border: colors.primary[300],

  hoverFg: colors.primary[400],
  hoverBg: colors.primary[900],
  hoverBorder: colors.primary[500],

  pressedFg: colors.primary[500],
  pressedBg: colors.primary[800],
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
  fg: colors.vellira[200],
  bg: colors.vellira[800],
  border: colors.vellira[300],

  hoverFg: colors.vellira[300],
  hoverBg: colors.vellira[700],
  hoverBorder: colors.vellira[400],

  pressedFg: colors.vellira[400],
  pressedBg: colors.vellira[800],
  pressedBorder: colors.vellira[500],
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
  fg: colors.success[400],
  bg: colors.success[950],
  border: colors.success[500],

  hoverFg: colors.success[500],
  hoverBg: colors.success[900],
  hoverBorder: colors.success[600],

  pressedFg: colors.success[600],
  pressedBg: colors.success[800],
  pressedBorder: colors.success[700],
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
  fg: colors.warning[400],
  bg: colors.warning[950],
  border: colors.warning[500],

  hoverFg: colors.warning[500],
  hoverBg: colors.warning[900],
  hoverBorder: colors.warning[600],

  pressedFg: colors.warning[600],
  pressedBg: colors.warning[800],
  pressedBorder: colors.warning[700],
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
  fg: colors.error[400],
  bg: colors.error[950],
  border: colors.error[500],

  hoverFg: colors.error[500],
  hoverBg: colors.error[900],
  hoverBorder: colors.error[600],

  pressedFg: colors.error[600],
  pressedBg: colors.error[800],
  pressedBorder: colors.error[700],
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
