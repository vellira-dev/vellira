import {
  createRadioPalette,
  createRadioTokens,
  radioMotionTokens,
  radioSizeTokens,
} from '../../factories/createRadioTokens.js';
import { colors } from '../../primitives/colors.js';
import { border } from '../semantic/border.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';
import { status } from '../semantic/status.js';
import { text } from '../semantic/text.js';

const primary = createRadioPalette({
  ring: colors.primary[400],
  default: {
    bg: colors.primary[600],
    fg: colors.primary[50],
    border: colors.primary[600],
    labelFg: colors.primary[300],
  },
  hover: {
    bg: colors.primary[700],
    fg: colors.primary[200],
    border: colors.primary[700],
    labelFg: colors.primary[400],
  },
  pressed: {
    bg: colors.primary[800],
    fg: colors.primary[300],
    border: colors.primary[800],
    labelFg: colors.primary[500],
  },
});

const neutral = createRadioPalette({
  ring: colors.grayBlue[400],
  default: {
    bg: colors.grayBlue[50],
    fg: colors.grayBlue[950],
    border: colors.grayBlue[50],
    labelFg: colors.grayBlue[50],
  },
  hover: {
    bg: colors.grayBlue[200],
    fg: colors.grayBlue[900],
    border: colors.grayBlue[200],
    labelFg: colors.gray[200],
  },
  pressed: {
    bg: colors.grayBlue[400],
    fg: colors.grayBlue[800],
    border: colors.grayBlue[400],
    labelFg: colors.grayBlue[300],
  },
});

const success = createRadioPalette({
  ring: colors.success[500],
  default: {
    bg: colors.success[500],
    fg: colors.success[950],
    border: colors.success[500],
    labelFg: colors.success[300],
  },
  hover: {
    bg: colors.success[600],
    fg: colors.success[900],
    border: colors.success[600],
    labelFg: colors.success[400],
  },
  pressed: {
    bg: colors.success[700],
    fg: colors.success[800],
    border: colors.success[700],
    labelFg: colors.success[500],
  },
});

const warning = createRadioPalette({
  ring: colors.warning[500],
  default: {
    bg: colors.warning[500],
    fg: colors.warning[950],
    border: colors.warning[500],
    labelFg: colors.warning[500],
  },
  hover: {
    bg: colors.warning[600],
    fg: colors.warning[900],
    border: colors.warning[600],
    labelFg: colors.warning[400],
  },
  pressed: {
    bg: colors.warning[700],
    fg: colors.warning[800],
    border: colors.warning[700],
    labelFg: colors.warning[600],
  },
});

const danger = createRadioPalette({
  ring: colors.error[500],
  default: {
    bg: colors.error[700],
    fg: colors.error[50],
    border: colors.error[700],
    labelFg: colors.error[400],
  },
  hover: {
    bg: colors.error[600],
    fg: colors.error[200],
    border: colors.error[600],
    labelFg: colors.error[200],
  },
  pressed: {
    bg: colors.error[800],
    fg: colors.error[300],
    border: colors.error[800],
    labelFg: colors.error[300],
  },
});

export const radio = createRadioTokens({
  size: radioSizeTokens,
  motion: radioMotionTokens,

  default: control.default,
  hover: control.hover,
  pressed: control.pressed,

  primary,
  neutral,
  success,
  warning,
  danger,

  focus: {
    ring: focus.ring.color,
    border: border.interactive,
  },

  invalid: {
    ...control.default,
    border: status.error.border,
    ring: status.error.ring,
  },

  disabled: control.disabled,

  selectedDisabled: {
    bg: control.disabled.bg,
    fg: text.disabled,
    border: border.disabled,
    labelFg: text.disabled,
  },
});
