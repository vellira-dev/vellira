import {
  createRadioPalette,
  createRadioTokens,
  radioMotionTokens,
  radioSizeTokens,
} from '../../factories/components/createRadioTokens.js';
import { colors } from '../../primitives/colors.js';
import { border } from '../semantic/border.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';
import { status } from '../semantic/status.js';
import { text } from '../semantic/text.js';

const primary = createRadioPalette({
  ring: colors.primary[400],
  default: {
    bg: colors.primary[50],
    fg: colors.primary[600],
    border: colors.primary[600],
    labelFg: colors.primary[700],
  },
  hover: {
    bg: colors.primary[100],
    fg: colors.primary[700],
    border: colors.primary[700],
    labelFg: colors.primary[800],
  },
  pressed: {
    bg: colors.primary[200],
    fg: colors.primary[800],
    border: colors.primary[800],
    labelFg: colors.primary[900],
  },
});

const neutral = createRadioPalette({
  ring: colors.vellira[400],
  default: {
    bg: colors.vellira[50],
    fg: colors.vellira[600],
    border: colors.vellira[500],
    labelFg: colors.vellira[600],
  },
  hover: {
    bg: colors.vellira[100],
    fg: colors.vellira[700],
    border: colors.vellira[600],
    labelFg: colors.vellira[700],
  },
  pressed: {
    bg: colors.vellira[200],
    fg: colors.vellira[800],
    border: colors.vellira[700],
    labelFg: colors.vellira[800],
  },
});

const success = createRadioPalette({
  ring: colors.success[500],
  default: {
    bg: colors.success[50],
    fg: colors.success[600],
    border: colors.success[600],
    labelFg: colors.success[700],
  },
  hover: {
    bg: colors.success[100],
    fg: colors.success[700],
    border: colors.success[700],
    labelFg: colors.success[800],
  },
  pressed: {
    bg: colors.success[200],
    fg: colors.success[800],
    border: colors.success[800],
    labelFg: colors.success[900],
  },
});

const warning = createRadioPalette({
  ring: colors.warning[500],
  default: {
    bg: colors.warning[50],
    fg: colors.warning[600],
    border: colors.warning[600],
    labelFg: colors.warning[700],
  },
  hover: {
    bg: colors.warning[100],
    fg: colors.warning[700],
    border: colors.warning[700],
    labelFg: colors.warning[800],
  },
  pressed: {
    bg: colors.warning[200],
    fg: colors.warning[800],
    border: colors.warning[800],
    labelFg: colors.warning[900],
  },
});

const danger = createRadioPalette({
  ring: colors.error[500],
  default: {
    bg: colors.error[50],
    fg: colors.error[700],
    border: colors.error[700],
    labelFg: colors.error[700],
  },
  hover: {
    bg: colors.error[100],
    fg: colors.error[800],
    border: colors.error[800],
    labelFg: colors.error[800],
  },
  pressed: {
    bg: colors.error[200],
    fg: colors.error[900],
    border: colors.error[900],
    labelFg: colors.error[700],
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

  invalid: {
    ...control.default,
    border: status.error.border,
    ring: status.error.ring,
  },

  focus: {
    ring: focus.ring.color,
    border: border.interactive,
  },

  disabled: control.disabled,

  selectedDisabled: {
    bg: control.disabled.bg,
    fg: text.disabled,
    border: border.disabled,
    labelFg: text.disabled,
  },
});
