import { Platform, StyleSheet } from 'react-native';

import {
  type NativeTheme,
  resolveComponentTokenPlatformOutputs,
} from '../../../theme';

// Native Modal/Sheet surfaces are sized against the viewport, not an
// intrinsic-height shadow wrapper (whose percentage height is indefinite).
export const SELECT_PRESENTATION_VIEWPORT_RATIO = 0.74;

export const createPresentationStyles = (theme: NativeTheme) => {
  const canonical = theme.components.select.dropdown;
  const output = resolveComponentTokenPlatformOutputs(theme, canonical);
  const nativeShadow = output.reactNative.shadow;

  if (nativeShadow === null || typeof nativeShadow === 'string') {
    throw new Error(
      'Select dropdown shadow must resolve to a structured React Native shadow.'
    );
  }

  return StyleSheet.create({
    modalRoot: {
      flex: 1,
    },

    sheetRoot: {
      justifyContent: 'flex-end',
    },

    modalPresentationRoot: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.tokens.spacing[4],
    },

    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.semantic.overlay.backdrop,
    },

    content: {
      overflow: 'hidden',
      backgroundColor: canonical.bg,
      borderColor: canonical.border,
      borderWidth: 1,
    },

    surface: {
      ...Platform.select({
        web: {
          boxShadow: output.web.shadow,
        },
        default: {
          shadowColor: nativeShadow.color,
          shadowOffset: {
            width: nativeShadow.x,
            height: nativeShadow.y,
          },
          shadowOpacity: nativeShadow.opacity,
          shadowRadius: nativeShadow.blur,
          elevation: nativeShadow.elevation,
        },
      }),
    },

    sheetSurface: {
      borderTopLeftRadius: theme.tokens.radius.lg,
      borderTopRightRadius: theme.tokens.radius.lg,

      ...Platform.select({
        web: {
          boxShadow: `0 -${theme.tokens.shadows.lg.y}px ${
            theme.tokens.shadows.lg.blur
          }px color-mix(in srgb, ${
            theme.tokens.shadows.lg.color
          } ${theme.tokens.shadows.lg.opacity * 100}%, transparent)`,
        },

        default: {
          shadowColor: theme.tokens.shadows.lg.color,
          shadowOffset: {
            width: theme.tokens.shadows.lg.x,
            height: -theme.tokens.shadows.lg.y,
          },
          shadowOpacity: theme.tokens.shadows.lg.opacity,
          shadowRadius: theme.tokens.shadows.lg.blur,
          elevation: theme.tokens.shadows.lg.elevation,
        },
      }),
    },

    modalSurface: {
      width: '100%',
      maxWidth: 420,
      borderRadius: theme.tokens.radius.lg,
    },

    popoverSurface: {
      borderRadius: theme.tokens.radius.lg,
    },

    sheet: {
      borderTopLeftRadius: theme.tokens.radius.lg,
      borderTopRightRadius: theme.tokens.radius.lg,
      borderBottomWidth: 0,
    },

    modalPresentation: {
      width: '100%',
      maxWidth: 420,
      borderRadius: theme.tokens.radius.lg,
    },

    popover: {
      maxHeight: '60%',
      borderRadius: theme.tokens.radius.lg,
    },

    handleWrap: {
      alignItems: 'center',
      paddingTop: theme.tokens.spacing[3],
    },

    handle: {
      width: 44,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.semantic.border.muted,
    },
  });
};
