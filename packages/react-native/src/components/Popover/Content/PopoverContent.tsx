import { useEffect, useMemo, useRef } from 'react';

import type { ViewInstance } from 'react-native';
import { Platform, Pressable, View } from 'react-native';

import { Portal } from '../../../primitives/Portal';
import { useTheme } from '../../../theme';
import { usePopoverContext } from '../internal';

import { createPopoverContentStyles, styles } from './PopoverContent.styles';
import type { PopoverContentProps } from './types';

export function PopoverContent({
  children,
  style,
  ...contentProps
}: PopoverContentProps) {
  const { theme } = useTheme();
  const layerRef = useRef<ViewInstance | null>(null);

  const themedStyles = useMemo(
    () => createPopoverContentStyles(theme),
    [theme]
  );

  const {
    open,
    zIndex,
    position,
    onFloatingLayout,
    updatePosition,
    requestClose,
    getOutsidePressProps,
  } = usePopoverContext('Popover.Content');

  useEffect(() => {
    if (!open) {
      return;
    }

    requestAnimationFrame(() => {
      updatePosition(layerRef);
    });
  }, [open, updatePosition]);

  return (
    <Portal visible={open} onRequestClose={requestClose}>
      <View
        ref={layerRef}
        pointerEvents={Platform.OS === 'web' ? undefined : 'box-none'}
        style={[styles.root, { zIndex }]}
      >
        <Pressable
          testID='popover-backdrop'
          {...getOutsidePressProps({ accessibilityLabel: 'Close popover' })}
          style={styles.backdrop}
        />

        <View
          {...contentProps}
          onLayout={onFloatingLayout}
          style={[styles.content, themedStyles.content, position, style]}
        >
          {children}
        </View>
      </View>
    </Portal>
  );
}
