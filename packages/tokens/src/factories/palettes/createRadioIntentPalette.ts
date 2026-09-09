import { typography } from '../../tokens/typography.js';

export type RadioState = {
  bg: string;
  fg: string;
  border: string;
  labelFg: string;
};

export type RadioPaletteConfig = {
  ring: string;
  default: RadioState;
  hover: RadioState;
  pressed: RadioState;
};

export const createRadioIntentPalette = ({
  ring,
  default: defaultState,
  hover,
  pressed,
}: RadioPaletteConfig) =>
  ({
    ring,
    default: defaultState,
    hover,
    pressed,
  }) as const;

export const radioSizeTokens = {
  sm: {
    controlSize: 14,
    indicatorSize: 6,
    labelFontSize: typography.size.sm,
    labelLineHeight: typography.lineHeight.sm,
    descriptionFontSize: typography.size.xs,
    descriptionLineHeight: typography.lineHeight.xs,
  },
  md: {
    controlSize: 16,
    indicatorSize: 8,
    labelFontSize: typography.size.md,
    labelLineHeight: typography.lineHeight.md,
    descriptionFontSize: typography.size.sm,
    descriptionLineHeight: typography.lineHeight.sm,
  },
  lg: {
    controlSize: 20,
    indicatorSize: 10,
    labelFontSize: typography.size.lg,
    labelLineHeight: typography.lineHeight.lg,
    descriptionFontSize: typography.size.md,
    descriptionLineHeight: typography.lineHeight.md,
  },
} as const;

export const radioMotionTokens = {
  controlDuration: '150ms',
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  indicatorDuration: '180ms',
  selectedDuration: '260ms',
  pressedScale: 0.92,
  pressedOpacity: 0.8,
} as const;
