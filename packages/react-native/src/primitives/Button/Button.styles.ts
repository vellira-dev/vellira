import {
  Platform,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { NativeTheme } from '../../theme';

const fontWeight = (value: string): TextStyle['fontWeight'] =>
  value as TextStyle['fontWeight'];

type ButtonStyles = {
  button: ViewStyle;
  fullWidth: ViewStyle;
  text: TextStyle;
  labelSlot: ViewStyle;
  labelMeasure: TextStyle;
  spinner: TextStyle;
  badge: TextStyle;
  shortcut: TextStyle;
  disabled: ViewStyle;
  focused: ViewStyle;
  pressed: ViewStyle;
};

export const createStyles = (theme: NativeTheme): ButtonStyles =>
  StyleSheet.create<ButtonStyles>({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
    },

    fullWidth: {
      width: '100%',
    },

    text: {
      fontFamily: theme.tokens.typography.family.regular,
      fontWeight: fontWeight(theme.tokens.typography.weight.regular),
      textAlign: 'center',

      // Fallback color.
      color: theme.components.button.primary.solid.default.fg,
    },

    labelSlot: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },

    labelMeasure: {
      position: 'absolute',
      opacity: 0,
    },

    spinner: {
      fontSize: 12,
    },

    badge: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 6,
      borderRadius: theme.tokens.radius.full,
      overflow: 'hidden',
      textAlign: 'center',
      fontSize: 11,
      lineHeight: 18,
      fontWeight: fontWeight(theme.tokens.typography.weight.medium),
    },

    shortcut: {
      opacity: 0.8,
      fontSize: 12,
    },

    disabled: {
      borderColor: theme.components.button.disabled.border,
    },

    focused: {
      borderColor: theme.semantic.focus.ring.color,

      ...Platform.select({
        web: {
          boxShadow: `0 0 0 4px ${theme.semantic.focus.ring.color}`,
        },
        default: {
          shadowColor: theme.semantic.focus.ring.color,
          shadowOffset: {
            width: 0,
            height: 0,
          },
          shadowOpacity: 0.18,
          shadowRadius: 8,
          elevation: 2,
        },
      }),
    },

    pressed: {
      transform: [{ scale: 0.98 }],
    },
  });
