import { createFocusRingShadowToken } from '../../effects/shadow-system.js';
import { colors } from '../../primitives/colors.js';

export const focus = {
  ring: {
    color: colors.primary[700],
    width: '2px',
    shadow: createFocusRingShadowToken('light'),
    offsetColor: colors.mono[50],
  },
} as const;
