type RadioGroupTokensConfig = {
  spacing1: number;
  spacing2: number;
  spacing3: number;
  spacing4: number;
  spacing5: number;
};

type SpacingScale = {
  readonly [key: number]: number;
};

export const createRadioGroupTokens = (config: RadioGroupTokensConfig) =>
  ({
    size: {
      sm: {
        itemGap: config.spacing1,
        horizontalGap: config.spacing3,
      },
      md: {
        itemGap: config.spacing2,
        horizontalGap: config.spacing4,
      },
      lg: {
        itemGap: config.spacing3,
        horizontalGap: config.spacing5,
      },
    },
  }) as const;

export const createRadioGroupTokensFromSpacing = (spacing: SpacingScale) =>
  createRadioGroupTokens({
    spacing1: spacing[1],
    spacing2: spacing[2],
    spacing3: spacing[3],
    spacing4: spacing[4],
    spacing5: spacing[5],
  });
