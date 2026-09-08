export const fontWeights = {
  light: '200',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export type FontWeight = (typeof fontWeights)[keyof typeof fontWeights];

export const typography = {
  family: {
    base: "'Vellira Sans', Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

    extraLight: 'VelliraSans-ExtraLight',
    regular: 'VelliraSans-Regular',
    medium: 'VelliraSans-Medium',
    semibold: 'VelliraSans-SemiBold',
    bold: 'VelliraSans-Bold',
    extraBold: 'VelliraSans-ExtraBold',
  },

  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },

  weight: fontWeights,

  lineHeight: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    xxl: 40,
  },
} as const;
