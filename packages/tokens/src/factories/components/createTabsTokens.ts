export type TabsStateTokens = {
  bg: string;
  fg: string;
  border: string;
};

export type TabsPaletteConfig = {
  triggerDefaultFg: string;
  triggerHoverFg: string;
  triggerActiveFg: string;
  triggerHoverBg: string;
  triggerActiveBg: string;
  triggerActiveBorder: string;
  indicator: string;
  indicatorHover?: string;
  segmentedBg: string;
  segmentedActiveBg: string;
  segmentedActiveBorder: string;
  segmentedActiveFg: string;
  pillHoverBg: string;
  pillActiveBg: string;
  pillActiveBorder: string;
  pillActiveFg: string;
  focusRing: string;
};

export type TabsTokensConfig = {
  primary: ReturnType<typeof createTabsPalette>;
  neutral: ReturnType<typeof createTabsPalette>;
  success: ReturnType<typeof createTabsPalette>;
  warning: ReturnType<typeof createTabsPalette>;
  danger: ReturnType<typeof createTabsPalette>;
  disabled: TabsStateTokens;
  list: {
    border: string;
    segmentedBg: string;
  };
  panel: {
    fg: string;
  };
};

export const createTabsPalette = ({
  triggerDefaultFg,
  triggerHoverFg,
  triggerActiveFg,
  triggerHoverBg,
  triggerActiveBg,
  triggerActiveBorder,
  indicator,
  indicatorHover = indicator,
  segmentedBg,
  segmentedActiveBg,
  segmentedActiveBorder,
  segmentedActiveFg,
  pillHoverBg,
  pillActiveBg,
  pillActiveBorder,
  pillActiveFg,
  focusRing,
}: TabsPaletteConfig) =>
  ({
    trigger: {
      default: {
        bg: 'transparent',
        fg: triggerDefaultFg,
        border: 'transparent',
      },
      hover: {
        bg: triggerHoverBg,
        fg: triggerHoverFg,
        border: 'transparent',
      },
      active: {
        bg: triggerActiveBg,
        fg: triggerActiveFg,
        border: triggerActiveBorder,
      },
    },
    pills: {
      default: {
        bg: 'transparent',
        fg: triggerDefaultFg,
        border: 'transparent',
      },
      hover: {
        bg: pillHoverBg,
        fg: triggerHoverFg,
        border: 'transparent',
      },
      active: {
        bg: pillActiveBg,
        fg: pillActiveFg,
        border: pillActiveBorder,
      },
    },
    segmented: {
      bg: segmentedBg,
      active: {
        bg: segmentedActiveBg,
        fg: segmentedActiveFg,
        border: segmentedActiveBorder,
      },
    },
    indicator: {
      bg: indicator,
      hoverBg: indicatorHover,
    },
    focusRing,
  }) as const;

export const createTabsTokens = (config: TabsTokensConfig) =>
  ({
    primary: config.primary,
    neutral: config.neutral,
    success: config.success,
    warning: config.warning,
    danger: config.danger,
    disabled: config.disabled,
    list: config.list,
    panel: config.panel,
  }) as const;
