import type { TextStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import type { NativeTheme } from '../../theme';

export const createStyles = (theme: NativeTheme) => {
  const avatar = theme.components.avatar;

  return StyleSheet.create({
    root: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: avatar.default.border,
      borderRadius: theme.tokens.radius.full,
      backgroundColor: avatar.default.bg,
    },
    sm: {
      width: theme.tokens.spacing[6],
      height: theme.tokens.spacing[6],
    },
    md: {
      width: theme.tokens.spacing[8],
      height: theme.tokens.spacing[8],
    },
    lg: {
      width: theme.tokens.spacing[10],
      height: theme.tokens.spacing[10],
    },
    fallback: {
      color: avatar.default.fg,
      fontSize: theme.tokens.typography.size.sm,
      fontWeight: theme.tokens.typography.weight
        .semibold as TextStyle['fontWeight'],
      lineHeight: theme.tokens.typography.lineHeight.sm,
    },
    image: {
      ...StyleSheet.absoluteFill,
    },
  });
};
