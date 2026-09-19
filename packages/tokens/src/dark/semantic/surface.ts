import { colors } from '../../primitives/colors.js';
import { withAlpha } from '../../utils/color.js';

export const surface = {
  canvas: colors.mono[950],
  default: colors.vellira[950],
  panel: colors.vellira[950],
  muted: colors.vellira[900],
  subtle: colors.vellira[850],
  elevated: colors.vellira[800],

  hover: colors.vellira[800],
  active: colors.vellira[700],
  pressed: colors.vellira[600],

  disabled: colors.vellira[800],
  danger: withAlpha(colors.error[800], 0.5),

  inverse: colors.mono[50],
} as const;
