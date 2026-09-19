import { colors } from '../../primitives/colors.js';
import { withAlpha } from '../../utils/color.js';

export const surface = {
  canvas: colors.mono[950],
  default: colors.mono[950],
  panel: colors.grayBlue[950],
  muted: colors.gray[900],
  subtle: colors.gray[800],
  elevated: colors.gray[700],

  hover: colors.gray[700],
  active: colors.gray[700],
  pressed: colors.gray[600],

  disabled: colors.gray[900],
  danger: withAlpha(colors.error[700], 0.5),

  inverse: colors.mono[50],
} as const;
