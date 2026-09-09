import {
  createTabsPalette,
  createTabsTokens,
} from '../../factories/components/createTabsTokens.js';
import { colors } from '../../primitives/colors.js';
import { withAlpha } from '../../utils/color.js';
import { border } from '../semantic/border.js';
import { focus } from '../semantic/focus.js';
import { text } from '../semantic/text.js';

const defaults = {
  triggerDefaultFg: text.secondary,
  triggerHoverFg: text.primary,
  triggerHoverBg: withAlpha(colors.mono[50], 0.065),
  triggerActiveBg: 'transparent',
  segmentedBg: withAlpha(colors.mono[50], 0.05),
  segmentedActiveBg: withAlpha(colors.mono[50], 0.12),
  focusRing: focus.ring.color,
};

export const tabs = createTabsTokens({
  primary: createTabsPalette({
    ...defaults,
    triggerActiveFg: colors.primary[300],
    triggerActiveBorder: colors.primary[500],
    indicator: colors.primary[500],
    indicatorHover: colors.primary[400],
    segmentedActiveBg: defaults.segmentedActiveBg,
    segmentedActiveBorder: 'transparent',
    segmentedActiveFg: colors.primary[100],
    pillHoverBg: colors.primary[950],
    pillActiveBg: colors.primary[900],
    pillActiveBorder: colors.primary[700],
    pillActiveFg: colors.primary[100],
  }),
  neutral: createTabsPalette({
    ...defaults,
    triggerHoverBg: colors.vellira[800],
    triggerActiveFg: colors.vellira[100],
    triggerActiveBorder: colors.vellira[300],
    indicator: colors.vellira[300],
    indicatorHover: colors.vellira[200],
    segmentedActiveBg: defaults.segmentedActiveBg,
    segmentedActiveBorder: 'transparent',
    segmentedActiveFg: colors.vellira[100],
    pillHoverBg: colors.vellira[800],
    pillActiveBg: colors.vellira[700],
    pillActiveBorder: colors.vellira[600],
    pillActiveFg: colors.vellira[100],
  }),
  success: createTabsPalette({
    ...defaults,
    triggerActiveFg: colors.success[300],
    triggerActiveBorder: colors.success[500],
    indicator: colors.success[500],
    indicatorHover: colors.success[400],
    segmentedActiveBg: defaults.segmentedActiveBg,
    segmentedActiveBorder: 'transparent',
    segmentedActiveFg: colors.success[100],
    pillHoverBg: colors.success[950],
    pillActiveBg: colors.success[900],
    pillActiveBorder: colors.success[700],
    pillActiveFg: colors.success[100],
  }),
  warning: createTabsPalette({
    ...defaults,
    triggerActiveFg: colors.warning[300],
    triggerActiveBorder: colors.warning[500],
    indicator: colors.warning[500],
    indicatorHover: colors.warning[400],
    segmentedActiveBg: defaults.segmentedActiveBg,
    segmentedActiveBorder: 'transparent',
    segmentedActiveFg: colors.warning[100],
    pillHoverBg: colors.warning[950],
    pillActiveBg: colors.warning[900],
    pillActiveBorder: colors.warning[700],
    pillActiveFg: colors.warning[100],
  }),
  danger: createTabsPalette({
    ...defaults,
    triggerActiveFg: colors.error[300],
    triggerActiveBorder: colors.error[500],
    indicator: colors.error[500],
    indicatorHover: colors.error[400],
    segmentedActiveBg: defaults.segmentedActiveBg,
    segmentedActiveBorder: 'transparent',
    segmentedActiveFg: colors.error[100],
    pillHoverBg: colors.error[950],
    pillActiveBg: colors.error[900],
    pillActiveBorder: colors.error[700],
    pillActiveFg: colors.error[100],
  }),
  disabled: {
    bg: 'transparent',
    fg: text.disabled,
    border: 'transparent',
  },
  list: {
    border: border.muted,
    segmentedBg: withAlpha(colors.mono[50], 0.05),
  },
  panel: {
    fg: text.primary,
  },
});
