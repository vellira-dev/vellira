import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import type { NativeTheme } from '../../../theme';

const fontWeight = (value: string): TextStyle['fontWeight'] =>
  value as TextStyle['fontWeight'];

type TabsTriggerStyles = {
  tab: ViewStyle;
  tabIconOnly: ViewStyle;
  tabSm: ViewStyle;
  tabIconOnlySm: ViewStyle;
  tabLg: ViewStyle;
  tabIconOnlyLg: ViewStyle;
  tabSegmented: ViewStyle;
  tabSegmentedIconOnly: ViewStyle;
  tabSegmentedSm: ViewStyle;
  tabSegmentedIconOnlySm: ViewStyle;
  tabSegmentedLg: ViewStyle;
  tabSegmentedIconOnlyLg: ViewStyle;
  tabVertical: ViewStyle;
  tabHovered: ViewStyle;
  tabPressed: ViewStyle;
  tabFocused: ViewStyle;
  tabDefaultActive: ViewStyle;
  tabDisabled: ViewStyle;
  tabText: TextStyle;
  tabTextSm: TextStyle;
  tabTextLg: TextStyle;
  tabTextHover: TextStyle;
  tabTextPressed: TextStyle;
  tabTextDisabled: TextStyle;
  tabTextActive: TextStyle;
  tabTextPillsActive: TextStyle;
  tabPills: ViewStyle;
  tabPillsIconOnly: ViewStyle;
  tabPillsActive: ViewStyle;
  tabPillsHover: ViewStyle;
  tabPillsPressed: ViewStyle;
  tabIcon: ViewStyle;
  tabDescription: TextStyle;
  tabBadge: ViewStyle;
  tabBadgeLg: ViewStyle;
  tabBadgeText: TextStyle;
  tabIconHover: TextStyle;
  tabIconPressed: TextStyle;
  tabIconActive: TextStyle;
  tabIconPillsActive: TextStyle;
};

export const createStyles = (theme: NativeTheme): TabsTriggerStyles =>
  StyleSheet.create<TabsTriggerStyles>({
    tab: {
      minHeight: 36,
      minWidth: 44,
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.tokens.spacing[2],
      justifyContent: 'center',
      paddingHorizontal: theme.tokens.spacing[4],
      paddingVertical: theme.tokens.spacing[2],
      borderWidth: 1,
      zIndex: 1,
    },

    tabIconOnly: {
      width: 44,
      minWidth: 44,
      paddingHorizontal: 0,
    },

    tabSm: {
      minHeight: 32,
      paddingHorizontal: theme.tokens.spacing[3],
      paddingVertical: 6,
    },

    tabIconOnlySm: {
      width: 36,
      minWidth: 36,
      paddingHorizontal: 0,
    },

    tabLg: {
      minHeight: 51,
      paddingHorizontal: theme.tokens.spacing[5],
      paddingVertical: theme.tokens.spacing[3],
    },

    tabIconOnlyLg: {
      width: 52,
      minWidth: 52,
      paddingHorizontal: 0,
    },

    tabSegmented: {
      flexGrow: 0,
      flexShrink: 0,
      minWidth: 0,
      minHeight: 32,
      paddingVertical: 5,
      borderRadius: theme.tokens.radius.lg,
    },

    tabSegmentedIconOnly: {
      width: 32,
      minWidth: 32,
      paddingHorizontal: 0,
    },

    tabSegmentedSm: {
      minHeight: 30,
      paddingVertical: 4,
    },

    tabSegmentedIconOnlySm: {
      width: 30,
      minWidth: 30,
      paddingHorizontal: 0,
    },

    tabSegmentedLg: {
      minHeight: 40,
      paddingVertical: 8,
    },

    tabSegmentedIconOnlyLg: {
      width: 40,
      minWidth: 40,
      paddingHorizontal: 0,
    },

    tabVertical: {
      position: 'relative',
      width: '100%',
      flexGrow: 0,
      flexShrink: 0,
      justifyContent: 'flex-start',
    },

    tabHovered: {
      backgroundColor: 'transparent',
    },

    tabPressed: {
      backgroundColor: 'transparent',
    },

    tabFocused: {
      borderColor: theme.semantic.focus.ring.color,
    },

    tabDefaultActive: {
      backgroundColor: 'transparent',
    },

    tabDisabled: {
      backgroundColor: theme.components.tabs.disabled.bg,
    },

    tabText: {
      flexShrink: 0,
      textAlign: 'center',
      lineHeight: theme.tokens.typography.size.md * 1.25,
      color: theme.components.tabs.primary.trigger.default.fg,
      fontFamily: theme.tokens.typography.family.regular,
      fontSize: theme.tokens.typography.size.md,
      fontWeight: fontWeight(theme.tokens.typography.weight.regular),
    },

    tabTextSm: {
      fontSize: theme.tokens.typography.size.sm,
      lineHeight: theme.tokens.typography.size.sm * 1.25,
    },

    tabTextLg: {
      fontSize: theme.tokens.typography.size.lg,
      lineHeight: theme.tokens.typography.size.lg * 1.25,
    },

    tabTextHover: {
      color: theme.components.tabs.primary.trigger.hover.fg,
    },

    tabTextPressed: {
      color: theme.components.tabs.primary.trigger.active.fg,
    },

    tabTextDisabled: {
      color: theme.components.tabs.disabled.fg,
    },

    tabTextActive: {
      color: theme.components.tabs.primary.trigger.active.fg,
    },

    tabTextPillsActive: {
      color: theme.components.tabs.primary.pills.active.fg,
    },

    tabPills: {
      minHeight: 38,
      paddingHorizontal: theme.tokens.spacing[4],
      paddingVertical: theme.tokens.spacing[2],
      borderRadius: theme.tokens.radius.lg,
    },

    tabPillsIconOnly: {
      width: 36,
      minWidth: 36,
      paddingHorizontal: 0,
    },

    tabPillsActive: {
      backgroundColor: 'transparent',
      borderRadius: theme.tokens.radius.md,
    },

    tabPillsHover: {
      backgroundColor: 'transparent',
    },

    tabPillsPressed: {
      backgroundColor: 'transparent',
    },

    tabIcon: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    tabDescription: {
      fontSize: theme.tokens.typography.size.sm,
      color: theme.components.tabs.primary.trigger.default.fg,
    },

    tabBadge: {
      minHeight: 20,
      minWidth: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.tokens.spacing[2],
      backgroundColor: theme.components.tabs.primary.pills.active.bg,
      borderRadius: theme.tokens.radius.full,
    },

    tabBadgeLg: {
      minHeight: 24,
      minWidth: 24,
    },

    tabBadgeText: {
      color: theme.components.tabs.primary.pills.active.fg,
      fontSize: theme.tokens.typography.size.sm,
      fontWeight: fontWeight(theme.tokens.typography.weight.medium),
    },

    tabIconHover: {
      color: theme.components.tabs.primary.trigger.hover.fg,
    },

    tabIconPressed: {
      color: theme.components.tabs.primary.trigger.active.fg,
    },

    tabIconActive: {
      color: theme.components.tabs.primary.trigger.active.fg,
    },

    tabIconPillsActive: {
      color: theme.components.tabs.primary.pills.active.fg,
    },
  });

interface GetTabStyleOptions {
  styles: TabsTriggerStyles;
  isSm: boolean;
  isLg: boolean;
  isOnlyIcon: boolean;
  isVertical: boolean;
  isPills: boolean;
  isSegmented: boolean;
  isLine: boolean;
  isActive: boolean;
  isDisabled: boolean;
  borderColor: string;
  backgroundColor: string;
  segmentedActiveBorderColor: string;
  style?: StyleProp<ViewStyle>;
}

export const getTriggerStyle = ({
  styles,
  isSm,
  isLg,
  isOnlyIcon,
  isVertical,
  isPills,
  isSegmented,
  isLine,
  isActive,
  isDisabled,
  borderColor,
  backgroundColor,
  segmentedActiveBorderColor,
  style,
}: GetTabStyleOptions): StyleProp<ViewStyle> => [
  styles.tab,
  isSm && styles.tabSm,
  isLg && styles.tabLg,

  isOnlyIcon && styles.tabIconOnly,
  isOnlyIcon && isSm && styles.tabIconOnlySm,
  isOnlyIcon && isLg && styles.tabIconOnlyLg,

  isVertical && styles.tabVertical,

  isPills && styles.tabPills,
  isPills && isOnlyIcon && styles.tabPillsIconOnly,

  isSegmented && styles.tabSegmented,
  isSegmented && isSm && styles.tabSegmentedSm,
  isSegmented && isLg && styles.tabSegmentedLg,
  isSegmented && isOnlyIcon && styles.tabSegmentedIconOnly,
  isSegmented && isOnlyIcon && isSm && styles.tabSegmentedIconOnlySm,
  isSegmented && isOnlyIcon && isLg && styles.tabSegmentedIconOnlyLg,

  {
    borderColor: isLine ? 'transparent' : borderColor,
    backgroundColor,
  },

  isSegmented &&
    isActive && {
      borderColor: segmentedActiveBorderColor,
      backgroundColor: 'transparent',
    },

  isPills &&
    isActive && {
      borderColor: 'transparent',
      backgroundColor: 'transparent',
    },

  isDisabled && styles.tabDisabled,

  style,
];
