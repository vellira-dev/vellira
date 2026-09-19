import { colors } from '../../primitives/colors.js';
import { withAlpha } from '../../utils/color.js';

export const surface = {
  canvas: colors.vellira[50],
  default: colors.vellira[50],
  panel: colors.mono[50],
  muted: colors.vellira[100],
  subtle: colors.vellira[25],
  elevated: colors.mono[50],

  hover: colors.vellira[100],
  active: colors.vellira[150],
  pressed: colors.vellira[200],

  disabled: colors.vellira[100],
  danger: withAlpha(colors.error[100], 0.7),

  inverse: colors.vellira[950],
} as const;
