import { createFocusRingShadowToken } from '../../effects/shadow-system.js';
import { colors } from '../../primitives/colors.js';

export const focus = {
  ring: {
    color: colors.warning[300],
    width: '2px',
    shadow: createFocusRingShadowToken('high-contrast'),
    offsetColor: colors.mono[950],
  },
} as const;
