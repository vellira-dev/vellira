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
    bg: colors.primary[950],
    fg: colors.primary[300],
    border: colors.primary[500],
    labelFg: colors.primary[400],
  },
  hover: {
    bg: colors.primary[900],
    fg: colors.primary[200],
    border: colors.primary[400],
    labelFg: colors.primary[400],
  },
  pressed: {
    bg: colors.primary[950],
    fg: colors.primary[400],
    border: colors.primary[600],
    labelFg: colors.primary[500],
  },
});

const neutral = createRadioPalette({
  ring: colors.vellira[400],
  default: {
    bg: colors.vellira[950],
    fg: colors.vellira[200],
    border: colors.vellira[300],
    labelFg: colors.vellira[200],
  },
  hover: {
    bg: colors.vellira[900],
    fg: colors.vellira[100],
    border: colors.vellira[200],
    labelFg: colors.vellira[300],
  },
  pressed: {
    bg: colors.vellira[950],
    fg: colors.vellira[300],
    border: colors.vellira[400],
    labelFg: colors.vellira[400],
  },
});

const success = createRadioPalette({
  ring: colors.success[500],
  default: {
    bg: colors.success[950],
    fg: colors.success[500],
    border: colors.success[500],
    labelFg: colors.success[400],
  },
  hover: {
    bg: colors.success[900],
    fg: colors.success[400],
    border: colors.success[400],
    labelFg: colors.success[500],
  },
  pressed: {
    bg: colors.success[950],
    fg: colors.success[600],
    border: colors.success[600],
    labelFg: colors.success[600],
  },
});

const warning = createRadioPalette({
  ring: colors.warning[500],
  default: {
    bg: colors.warning[950],
    fg: colors.warning[500],
    border: colors.warning[500],
    labelFg: colors.warning[400],
  },
  hover: {
    bg: colors.warning[900],
    fg: colors.warning[400],
    border: colors.warning[400],
    labelFg: colors.warning[500],
  },
  pressed: {
    bg: colors.warning[950],
    fg: colors.warning[600],
    border: colors.warning[600],
    labelFg: colors.warning[600],
  },
});

const danger = createRadioPalette({
  ring: colors.error[500],
  default: {
    bg: colors.error[950],
    fg: colors.error[400],
    border: colors.error[500],
    labelFg: colors.error[400],
  },
  hover: {
    bg: colors.error[900],
    fg: colors.error[300],
    border: colors.error[400],
    labelFg: colors.error[500],
  },
  pressed: {
    bg: colors.error[950],
    fg: colors.error[500],
    border: colors.error[600],
    labelFg: colors.error[600],
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
