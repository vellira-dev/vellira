import {
  createTabsPalette,
  createTabsTokens,
} from '../../factories/components/createTabsTokens.js';
import { colors } from '../../primitives/colors.js';
import { withAlpha } from '../../utils/color.js';
import { border } from '../semantic/border.js';
import { focus } from '../semantic/focus.js';
import { surface } from '../semantic/surface.js';
import { text } from '../semantic/text.js';

const defaults = {
  triggerDefaultFg: text.secondary,
  triggerHoverFg: text.primary,
  triggerHoverBg: withAlpha(colors.vellira[900], 0.035),
  triggerActiveBg: 'transparent',
  segmentedBg: withAlpha(colors.vellira[900], 0.03),
  focusRing: focus.ring.color,
};

export const tabs = createTabsTokens({
  primary: createTabsPalette({
    ...defaults,
    triggerActiveFg: colors.primary[700],
    triggerActiveBorder: colors.primary[600],
    indicator: colors.primary[600],
    indicatorHover: colors.primary[700],
    segmentedActiveBg: surface.elevated,
    segmentedActiveBorder: 'transparent',
    segmentedActiveFg: colors.primary[800],
    pillHoverBg: colors.primary[50],
    pillActiveBg: colors.primary[100],
    pillActiveBorder: colors.primary[300],
    pillActiveFg: colors.primary[900],
  }),
  neutral: createTabsPalette({
    ...defaults,
    triggerActiveFg: colors.vellira[700],
    triggerActiveBorder: colors.vellira[500],
    indicator: colors.vellira[500],
    indicatorHover: colors.vellira[600],
    segmentedActiveBg: surface.elevated,
    segmentedActiveBorder: 'transparent',
    segmentedActiveFg: colors.vellira[800],
    pillHoverBg: colors.vellira[100],
    pillActiveBg: colors.vellira[150],
    pillActiveBorder: colors.vellira[300],
    pillActiveFg: colors.vellira[900],
  }),
  success: createTabsPalette({
    ...defaults,
    triggerActiveFg: colors.success[700],
    triggerActiveBorder: colors.success[600],
    indicator: colors.success[600],
    indicatorHover: colors.success[700],
    segmentedActiveBg: surface.elevated,
    segmentedActiveBorder: 'transparent',
    segmentedActiveFg: colors.success[800],
    pillHoverBg: colors.success[50],
    pillActiveBg: colors.success[100],
    pillActiveBorder: colors.success[300],
    pillActiveFg: colors.success[900],
  }),
  warning: createTabsPalette({
    ...defaults,
    triggerActiveFg: colors.warning[700],
    triggerActiveBorder: colors.warning[600],
    indicator: colors.warning[600],
    indicatorHover: colors.warning[700],
    segmentedActiveBg: surface.elevated,
    segmentedActiveBorder: 'transparent',
    segmentedActiveFg: colors.warning[800],
    pillHoverBg: colors.warning[50],
    pillActiveBg: colors.warning[100],
    pillActiveBorder: colors.warning[300],
    pillActiveFg: colors.warning[900],
  }),
  danger: createTabsPalette({
    ...defaults,
    triggerActiveFg: colors.error[700],
    triggerActiveBorder: colors.error[600],
    indicator: colors.error[600],
    indicatorHover: colors.error[700],
    segmentedActiveBg: surface.elevated,
    segmentedActiveBorder: 'transparent',
    segmentedActiveFg: colors.error[800],
    pillHoverBg: colors.error[50],
    pillActiveBg: colors.error[100],
    pillActiveBorder: colors.error[300],
    pillActiveFg: colors.error[900],
  }),
  disabled: {
    bg: 'transparent',
    fg: text.disabled,
    border: 'transparent',
  },
  list: {
    border: border.muted,
    segmentedBg: withAlpha(colors.vellira[900], 0.03),
  },
  panel: {
    fg: text.primary,
  },
});
