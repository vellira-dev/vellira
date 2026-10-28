import { Platform, StyleSheet } from 'react-native';

import {
  type NativeTheme,
  resolveComponentTokenPlatformOutputs,
} from '../../../theme';

export const getDropdownBackdropBackgroundColor = (
  theme: NativeTheme,
  presentation: 'sheet' | 'modal' | 'popover'
) =>
  presentation === 'popover' ? 'transparent' : theme.semantic.overlay.backdrop;

export const createStyles = (theme: NativeTheme) => {
  const canonical = theme.components.dropdown.content;
  const output = resolveComponentTokenPlatformOutputs(theme, canonical);
  const nativeShadow = output.reactNative.shadow;

  if (nativeShadow === null || typeof nativeShadow === 'string') {
    throw new Error(
      'Dropdown content shadow must resolve to a structured React Native shadow.'
    );
  }

  return StyleSheet.create({
    modalRoot: {
      flex: 1,
    },

    sheet: {
      justifyContent: 'flex-end',
    },

    modal: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.tokens.spacing[4],
    },

    popover: {
      flex: 1,
    },

    backdrop: {
      ...StyleSheet.absoluteFill,
    },

    menu: {
      maxHeight: '50%',
      overflow: 'hidden',
      padding: theme.tokens.spacing[1],
      backgroundColor: canonical.bg,
      borderColor: canonical.border,
      borderTopLeftRadius: theme.tokens.radius.lg,
      borderTopRightRadius: theme.tokens.radius.lg,
      borderWidth: 1,

      ...Platform.select({
        web: {
          boxShadow: output.web.shadow,
        },
        default: {
          shadowColor: nativeShadow.color,
          shadowOffset: {
            width: nativeShadow.x,
            height: -nativeShadow.y,
          },
          shadowOpacity: nativeShadow.opacity,
          shadowRadius: nativeShadow.blur,
          elevation: nativeShadow.elevation,
        },
      }),
    },

    sheetMenu: {
      width: '100%',
      maxHeight: '70%',
      borderTopLeftRadius: theme.tokens.radius.lg,
      borderTopRightRadius: theme.tokens.radius.lg,
    },

    modalMenu: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '70%',
      borderRadius: theme.tokens.radius.lg,
    },

    popoverMenu: {
      // Let the native shadow render beyond the popover bounds. Sheet and modal
      // presentations retain clipping of their own content.
      overflow: 'visible',
      width: '100%',
      maxWidth: 360,
      maxHeight: '60%',
      borderRadius: theme.tokens.radius.md,
    },

    popoverSurface: {
      overflow: 'hidden',
      borderRadius: theme.tokens.radius.md,
      backgroundColor: 'transparent',
      padding: theme.tokens.spacing[1],
    },

    searchWrap: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.tokens.spacing[2],
      paddingHorizontal: theme.tokens.spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.components.dropdown.separator.bg,
    },

    searchIcon: {
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },

    searchInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: theme.tokens.spacing[2],
      color: theme.components.dropdown.content.fg,
      fontFamily: theme.tokens.typography.family.regular,
      fontSize: theme.tokens.typography.size.sm,
      lineHeight: theme.tokens.typography.lineHeight.sm,
    },
  });
};
