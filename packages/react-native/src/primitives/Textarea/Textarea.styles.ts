import { Platform, StyleSheet } from 'react-native';

import type { NativeTheme } from '../../theme';

export const createStyles = (theme: NativeTheme) =>
  StyleSheet.create({
    textarea: {
      width: '100%',
      minWidth: 0,
      alignSelf: 'stretch',
      color: theme.components.textarea.default.fg,
      fontFamily: theme.tokens.typography.family.regular,
      backgroundColor: theme.components.textarea.default.bg,
      borderColor: theme.components.textarea.default.border,
      borderRadius: theme.tokens.radius.md,
      borderWidth: 1,
      textAlignVertical: 'top',
    },

    sm: {
      paddingHorizontal: theme.tokens.spacing[3],
      paddingVertical: theme.tokens.spacing[2],
    },

    md: {
      paddingHorizontal: theme.tokens.spacing[4],
      paddingVertical: theme.tokens.spacing[3],
    },

    lg: {
      paddingHorizontal: theme.tokens.spacing[5],
      paddingVertical: theme.tokens.spacing[4],
    },

    focused: {
      color: theme.components.textarea.hover.fg,
      backgroundColor: theme.components.textarea.hover.bg,
      borderColor: theme.components.textarea.hover.border,
      ...Platform.select({
        web: {
          boxShadow: `0 0 0 3px ${theme.components.textarea.focusRing}`,
        },
        default: {
          shadowColor: theme.components.textarea.focusRing,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.18,
          shadowRadius: 6,
          elevation: 1,
        },
      }),
    },

    invalid: {
      borderColor: theme.components.textarea.error.border,
    },

    invalidFocused: {
      borderColor: theme.components.textarea.error.border,
      ...Platform.select({
        web: {
          boxShadow: `0 0 0 3px ${theme.components.textarea.error.ring}`,
        },
        default: {
          shadowColor: theme.components.textarea.error.ring,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 1,
        },
      }),
    },

    disabled: {
      color: theme.components.textarea.disabled.fg,
      backgroundColor: theme.components.textarea.disabled.bg,
      borderColor: theme.components.textarea.disabled.border,
    },
  });
