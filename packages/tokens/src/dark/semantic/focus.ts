import { createFocusRingShadowToken } from '../../effects/shadow-system.js';
import { colors } from '../../primitives/colors.js';

export const focus = {
  ring: {
    color: colors.primary[300],
    width: '2px',
    shadow: createFocusRingShadowToken('dark'),
    offsetColor: colors.vellira[950],
  },
} as const;
