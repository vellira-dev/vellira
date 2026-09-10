import { createComponentShadowIntent } from '../../platform-output/component-token-intents.js';

type PopoverTokensConfig = {
  contentBg: string;
  contentFg: string;
  contentBorder: string;
  titleFg: string;
  descriptionFg: string;
  radiusLg: number;
  spacing3: number;
  spacing4: number;
};

export type PopoverThemeSources = {
  overlay: {
    floating: {
      bg: string;
      border: string;
    };
  };
  text: {
    primary: string;
    secondary: string;
  };
  radius: {
    lg: number;
  };
  spacing: {
    readonly [key: number]: number;
  };
};

export const createPopoverTokens = (config: PopoverTokensConfig) =>
  ({
    content: {
      bg: config.contentBg,
      fg: config.contentFg,
      border: config.contentBorder,

      shadow: createComponentShadowIntent('lg'),

      borderWidth: 1,
      radius: config.radiusLg,
      padding: config.spacing4,
      gap: config.spacing3,
      minWidth: 220,
      maxWidth: 320,
    },

    title: {
      fg: config.titleFg,
    },

    description: {
      fg: config.descriptionFg,
    },

    arrow: {
      size: 10,
      bg: config.contentBg,
      border: config.contentBorder,
    },
  }) as const;

export const createPopoverTokensFromTheme = ({
  overlay,
  text,
  radius,
  spacing,
}: PopoverThemeSources) =>
  createPopoverTokens({
    contentBg: overlay.floating.bg,
    contentFg: text.primary,
    contentBorder: overlay.floating.border,
    titleFg: text.primary,
    descriptionFg: text.secondary,
    radiusLg: radius.lg,
    spacing3: spacing[3],
    spacing4: spacing[4],
  });
