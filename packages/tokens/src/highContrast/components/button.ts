import {
  createButtonPalette,
  createButtonTokens,
} from '../../factories/createButtonTokens.js';
import { colors } from '../../primitives/colors.js';
import { border } from '../semantic/border.js';
import { status } from '../semantic/status.js';
import { surface } from '../semantic/surface.js';
import { text } from '../semantic/text.js';

const primary = createButtonPalette({
  ring: colors.primary[400],
  solid: {
    default: {
      bg: colors.primary[600],
      fg: colors.primary[50],
      border: colors.primary[50],
    },
    hover: {
      bg: colors.primary[700],
      fg: colors.primary[200],
      border: colors.primary[200],
    },
    pressed: {
      bg: colors.primary[800],
      fg: colors.primary[300],
      border: colors.primary[300],
    },
  },
  fg: colors.primary[300],
  bg: colors.grayBlue[900],
  border: colors.primary[300],
  hoverBg: colors.primary[950],
  hoverFg: colors.primary[400],
  hoverBorder: colors.primary[400],
  pressedBg: colors.gray[900],
  pressedFg: colors.primary[500],
  pressedBorder: colors.primary[500],
});

const neutral = createButtonPalette({
  ring: colors.grayBlue[400],
  solid: {
    default: {
      bg: colors.grayBlue[50],
      fg: colors.grayBlue[950],
      border: colors.grayBlue[900],
    },
    hover: {
      bg: colors.grayBlue[200],
      fg: colors.grayBlue[900],
      border: colors.grayBlue[700],
    },
    pressed: {
      bg: colors.grayBlue[400],
      fg: colors.grayBlue[800],
      border: colors.grayBlue[800],
    },
  },
  fg: colors.grayBlue[50],
  bg: colors.grayBlue[900],
  border: colors.grayBlue[200],
  hoverBg: colors.grayBlue[950],
  hoverFg: colors.gray[200],
  hoverBorder: colors.gray[200],
  pressedBg: colors.gray[900],
  pressedFg: colors.grayBlue[300],
});

const success = createButtonPalette({
  ring: colors.success[500],
  solid: {
    default: {
      bg: colors.success[500],
      fg: colors.success[950],
      border: colors.success[50],
    },
    hover: {
      bg: colors.success[600],
      fg: colors.success[900],
      border: colors.success[100],
    },
    pressed: {
      bg: colors.success[700],
      fg: colors.success[800],
      border: colors.success[200],
    },
  },
  fg: colors.success[300],
  bg: status.success.bg,
  border: colors.success[300],
  hoverBg: colors.success[900],
  hoverFg: colors.success[400],
  hoverBorder: colors.success[400],
  pressedBg: colors.success[950],
  pressedFg: colors.success[500],
  pressedBorder: colors.success[500],
});

const warning = createButtonPalette({
  ring: colors.warning[500],
  solid: {
    default: {
      bg: colors.warning[500],
      fg: colors.warning[950],
      border: colors.warning[50],
    },
    hover: {
      bg: colors.warning[600],
      fg: colors.warning[900],
      border: colors.warning[100],
    },
    pressed: {
      bg: colors.warning[700],
      fg: colors.warning[800],
      border: colors.warning[200],
    },
  },
  fg: colors.warning[500],
  bg: status.warning.bg,
  border: colors.warning[500],
  hoverBg: colors.warning[900],
  hoverFg: colors.warning[400],
  hoverBorder: colors.warning[400],
  pressedBg: colors.warning[950],
  pressedFg: colors.warning[600],
  pressedBorder: colors.warning[600],
});

const danger = createButtonPalette({
  ring: colors.error[500],
  solid: {
    default: {
      bg: colors.error[700],
      fg: colors.error[50],
      border: colors.error[200],
    },
    hover: {
      bg: colors.error[600],
      fg: colors.error[200],
      border: colors.error[200],
    },
    pressed: {
      bg: colors.error[800],
      fg: colors.error[300],
      border: colors.error[400],
    },
  },
  fg: colors.error[400],
  bg: colors.error[950],
  border: colors.error[400],
  hoverBg: colors.error[900],
  hoverFg: colors.error[200],
  hoverBorder: colors.error[400],
  pressedBg: colors.error[800],
  pressedFg: colors.error[300],
  pressedBorder: colors.error[500],
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
