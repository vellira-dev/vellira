import {
  type ComponentElevationShadowIntent,
  createComponentShadowIntent,
} from '../../platform-output/component-token-intents.js';

type TooltipContentTokens = {
  bg: string;
  fg: string;
  border: string;
  shadow: ComponentElevationShadowIntent;
  borderWidth: number;
  radius: number;
  paddingX: number;
  paddingY: number;
  maxWidth: number;
  compactMaxWidth: number;
  compactPaddingX: number;
  compactPaddingY: number;
  fontSize: number;
  lineHeight: number;
  compactFontSize: number;
  compactLineHeight: number;
  animationDuration: string;
  translateY: number;
  scale: number;
};

type TooltipArrowTokens = {
  bg: string;
  size: number;
  compactSize: number;
};

type TooltipTokensConfig = {
  contentBg: string;
  contentFg: string;
  contentBorder: string;
  contentBorderWidth?: number;
  contentRadius: number;
  contentPaddingX: number;
  contentPaddingY: number;
  contentMaxWidth?: number;
  contentCompactMaxWidth?: number;
  contentCompactPaddingX: number;
  contentCompactPaddingY: number;
  contentFontSize: number;
  contentLineHeight: number;
  contentCompactFontSize: number;
  contentCompactLineHeight: number;
  contentAnimationDuration?: string;
  contentTranslateY?: number;
  contentScale?: number;
  arrowBg?: string;
  arrowSize?: number;
  arrowCompactSize?: number;
};

export type TooltipTokens = {
  content: TooltipContentTokens;
  arrow: TooltipArrowTokens;
};

export type TooltipThemeSources = {
  overlay: {
    tooltip: {
      bg: string;
      fg: string;
      border: string;
    };
  };
  radius: {
    sm: number;
  };
  spacing: {
    readonly [key: number]: number;
  };
  typography: {
    size: {
      sm: number;
      xs: number;
    };
    lineHeight: {
      sm: number;
      xs: number;
    };
  };
};

export const createTooltipTokens = ({
  contentBg,
  contentFg,
  contentBorder,
  contentBorderWidth = 1,
  contentRadius,
  contentPaddingX,
  contentPaddingY,
  contentMaxWidth = 240,
  contentCompactMaxWidth = 200,
  contentCompactPaddingX,
  contentCompactPaddingY,
  contentFontSize,
  contentLineHeight,
  contentCompactFontSize,
  contentCompactLineHeight,
  contentAnimationDuration = '150ms',
  contentTranslateY = 2,
  contentScale = 0.98,
  arrowBg = contentBg,
  arrowSize = 10,
  arrowCompactSize = 6,
}: TooltipTokensConfig): TooltipTokens =>
  ({
    content: {
      bg: contentBg,
      fg: contentFg,
      border: contentBorder,
      shadow: createComponentShadowIntent('md'),
      borderWidth: contentBorderWidth,
      radius: contentRadius,
      paddingX: contentPaddingX,
      paddingY: contentPaddingY,
      maxWidth: contentMaxWidth,
      compactMaxWidth: contentCompactMaxWidth,
      compactPaddingX: contentCompactPaddingX,
      compactPaddingY: contentCompactPaddingY,
      fontSize: contentFontSize,
      lineHeight: contentLineHeight,
      compactFontSize: contentCompactFontSize,
      compactLineHeight: contentCompactLineHeight,
      animationDuration: contentAnimationDuration,
      translateY: contentTranslateY,
      scale: contentScale,
    },

    arrow: {
      bg: arrowBg,
      size: arrowSize,
      compactSize: arrowCompactSize,
    },
  }) as const;

export const createTooltipTokensFromTheme = ({
  overlay,
  radius,
  spacing,
  typography,
}: TooltipThemeSources) =>
  createTooltipTokens({
    contentBg: overlay.tooltip.bg,
    contentFg: overlay.tooltip.fg,
    contentBorder: overlay.tooltip.border,
    contentRadius: radius.sm,
    contentPaddingX: spacing[3],
    contentPaddingY: spacing[2],
    contentCompactPaddingX: spacing[2],
    contentCompactPaddingY: spacing[1],
    contentFontSize: typography.size.sm,
    contentLineHeight: typography.lineHeight.sm,
    contentCompactFontSize: typography.size.xs,
    contentCompactLineHeight: typography.lineHeight.xs,
  });
