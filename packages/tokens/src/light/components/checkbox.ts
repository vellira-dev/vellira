import {
  createCheckboxPalette,
  createCheckboxTokens,
} from '../../factories/createCheckboxTokens.js';
import { colors } from '../../primitives/colors.js';
import { control } from '../semantic/control.js';
import { focus } from '../semantic/focus.js';
import { status } from '../semantic/status.js';
import { text } from '../semantic/text.js';

const primary = createCheckboxPalette({
  ring: colors.primary[400],
  default: {
    bg: colors.primary[600],
    fg: colors.primary[50],
    border: colors.primary[600],
    labelFg: colors.primary[700],
  },
  hover: {
    bg: colors.primary[700],
    fg: colors.primary[200],
    border: colors.primary[700],
    labelFg: colors.primary[800],
  },
  pressed: {
    bg: colors.primary[800],
    fg: colors.primary[300],
    border: colors.primary[800],
    labelFg: colors.primary[900],
  },
});

const neutral = createCheckboxPalette({
  ring: colors.vellira[400],
  default: {
    bg: colors.vellira[200],
    fg: colors.vellira[950],
    border: colors.vellira[200],
    labelFg: colors.vellira[600],
  },
  hover: {
    bg: colors.vellira[300],
    fg: colors.vellira[900],
    border: colors.vellira[300],
    labelFg: colors.vellira[700],
  },
  pressed: {
    bg: colors.vellira[400],
    fg: colors.vellira[800],
    border: colors.vellira[400],
    labelFg: colors.vellira[800],
  },
});

const success = createCheckboxPalette({
  ring: colors.success[500],
  default: {
    bg: colors.success[500],
    fg: colors.success[950],
    border: colors.success[500],
    labelFg: colors.success[700],
  },
  hover: {
    bg: colors.success[600],
    fg: colors.success[900],
    border: colors.success[600],
    labelFg: colors.success[800],
  },
  pressed: {
    bg: colors.success[700],
    fg: colors.success[800],
    border: colors.success[700],
    labelFg: colors.success[900],
  },
});

const warning = createCheckboxPalette({
  ring: colors.warning[500],
  default: {
    bg: colors.warning[500],
    fg: colors.warning[950],
    border: colors.warning[500],
    labelFg: colors.warning[700],
  },
  hover: {
    bg: colors.warning[600],
    fg: colors.warning[900],
    border: colors.warning[600],
    labelFg: colors.warning[800],
  },
  pressed: {
    bg: colors.warning[700],
    fg: colors.warning[800],
    border: colors.warning[700],
    labelFg: colors.warning[900],
  },
});

const danger = createCheckboxPalette({
  ring: colors.error[500],
  default: {
    bg: colors.error[700],
    fg: colors.error[50],
    border: colors.error[700],
    labelFg: colors.error[700],
  },
  hover: {
    bg: colors.error[800],
    fg: colors.error[200],
    border: colors.error[800],
    labelFg: colors.error[800],
  },
  pressed: {
    bg: colors.error[900],
    fg: colors.error[300],
    border: colors.error[900],
    labelFg: colors.error[700],
  },
});

export const checkbox = createCheckboxTokens({
  default: control.default,

  hover: {
    ...control.hover,
    labelFg: text.interactiveHover,
  },

  primary,
  neutral,
  success,
  warning,
  danger,

  focus: {
    ring: focus.ring.color,
  },

  disabled: control.disabled,

  error: {
    fg: status.error.fg,
    border: status.error.border,
    ring: status.error.ring,
  },
});
