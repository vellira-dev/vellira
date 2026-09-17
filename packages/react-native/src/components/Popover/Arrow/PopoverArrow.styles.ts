import type { ViewStyle } from 'react-native';
import { Platform, StyleSheet } from 'react-native';

import type { nativeThemes } from '../../../theme';

type NativeTheme = (typeof nativeThemes)[keyof typeof nativeThemes];
type PopoverSide = 'top' | 'right' | 'bottom' | 'left';
type PopoverArrowStyles = {
  arrow: ViewStyle;
};

export function createPopoverArrowStyles({
  theme,
  side,
  arrowPosition,
}: {
  theme: NativeTheme;
  side: PopoverSide;
  arrowPosition: Pick<ViewStyle, 'top' | 'left'>;
}): PopoverArrowStyles {
  const tokens = theme.components.popover.arrow;
  const halfSize = tokens.size / 2;

  const position: ViewStyle =
    side === 'top'
      ? {
          left: arrowPosition.left ?? 0,
          bottom: -halfSize,
          transform: [{ translateX: -halfSize }, { rotate: '45deg' }],
        }
      : side === 'bottom'
        ? {
            left: arrowPosition.left ?? 0,
            top: -halfSize,
            transform: [{ translateX: -halfSize }, { rotate: '45deg' }],
          }
        : side === 'left'
          ? {
              top: arrowPosition.top ?? 0,
              right: -halfSize,
              transform: [{ translateY: -halfSize }, { rotate: '45deg' }],
            }
          : {
              top: arrowPosition.top ?? 0,
              left: -halfSize,
              transform: [{ translateY: -halfSize }, { rotate: '45deg' }],
            };

  const border: ViewStyle =
    side === 'top'
      ? {
          borderColor: tokens.border,
          borderRightWidth: 1,
          borderBottomWidth: 1,
        }
      : side === 'bottom'
        ? {
            borderColor: tokens.border,
            borderLeftWidth: 1,
            borderTopWidth: 1,
          }
        : side === 'left'
          ? {
              borderColor: tokens.border,
              borderRightWidth: 1,
              borderTopWidth: 1,
            }
          : {
              borderColor: tokens.border,
              borderLeftWidth: 1,
              borderBottomWidth: 1,
            };

  return StyleSheet.create({
    arrow: {
      position: 'absolute',
      width: tokens.size,
      height: tokens.size,
      ...(Platform.OS === 'web'
        ? {
            pointerEvents: 'none',
          }
        : {}),
      backgroundColor: tokens.bg,
      ...position,
      ...border,
    },
  });
}
