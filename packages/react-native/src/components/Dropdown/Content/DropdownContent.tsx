import { useEffect, useMemo, useRef, useState } from 'react';

import { Search } from '@vellira-ui/icons';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { useTheme, useThemeStyles } from '../../../theme';
import { useDropdownContext } from '../internal/DropdownContext';

import {
  createStyles,
  getDropdownBackdropBackgroundColor,
} from './DropdownContent.styles';
import type { DropdownContentProps } from './types';

const nativePointerEventsBoxNone =
  Platform.OS === 'web' ? undefined : ({ pointerEvents: 'box-none' } as const);
const webPointerEventsBoxNone =
  Platform.OS === 'web' ? { pointerEvents: 'box-none' as const } : undefined;

function resolveBorderRadius(
  style: DropdownContentProps['contentStyle']
): number | undefined {
  if (Array.isArray(style)) {
    for (let index = style.length - 1; index >= 0; index -= 1) {
      const radius = resolveBorderRadius(
        style[index] as DropdownContentProps['contentStyle']
      );
      if (radius !== undefined) return radius;
    }
    return undefined;
  }
  if (style && typeof style === 'object' && 'borderRadius' in style) {
    const radius = style.borderRadius;
    return typeof radius === 'number' ? radius : undefined;
  }
  return undefined;
}

export function DropdownContent({
  children,
  contentStyle,
  popoverBackground,
  accessibilityLabel,
}: DropdownContentProps) {
  const {
    open,
    color,
    presentation,
    positionReady,
    zIndex,
    position,
    searchable,
    searchValue,
    searchPlaceholder,
    searchAccessibilityLabel,
    requestClose,
    getOutsidePressProps,
    onSearchChange,
    onFloatingLayout,
  } = useDropdownContext();
  const { theme } = useTheme();
  const styles = useThemeStyles(createStyles);
  const colorPalette = theme.components.dropdown[color];
  const isSheet = presentation === 'sheet';
  const isPopover = presentation === 'popover';
  const popoverRadius =
    resolveBorderRadius(contentStyle) ?? theme.tokens.radius.md;
  const animation = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion);

    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    if (!open) {
      animation.setValue(0);
      return;
    }

    if (reduceMotion) {
      animation.setValue(1);
      return;
    }

    animation.setValue(0);

    Animated.timing(animation, {
      toValue: 1,
      duration: isSheet ? 220 : 160,
      useNativeDriver: true,
    }).start();
  }, [animation, open, isSheet, reduceMotion]);

  const backdropAnimatedStyle = useMemo(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    return {
      opacity: animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      }),
    };
  }, [animation]);

  const menuAnimatedStyle = useMemo(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    const translateY = animation.interpolate({
      inputRange: [0, 1],
      outputRange: isSheet ? [24, 0] : [-6, 0],
    });

    const scale = animation.interpolate({
      inputRange: [0, 1],
      outputRange: isSheet ? [1, 1] : [0.98, 1],
    });

    return {
      opacity: animation,
      transform: [{ translateY }, { scale }],
    };
  }, [animation, isSheet]);

  return (
    <Modal
      transparent
      visible={open}
      animationType='none'
      onRequestClose={requestClose}
    >
      <View
        style={[
          styles.modalRoot,
          styles[presentation],
          Platform.OS === 'web' && { zIndex },
        ]}
      >
        <Animated.View
          {...nativePointerEventsBoxNone}
          style={[
            styles.backdrop,
            {
              backgroundColor: getDropdownBackdropBackgroundColor(
                theme,
                presentation
              ),
            },
            backdropAnimatedStyle,
            webPointerEventsBoxNone,
          ]}
        >
          <Pressable
            {...getOutsidePressProps({ accessibilityLabel: 'Close menu' })}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          accessibilityRole='menu'
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.menu,
            styles[`${presentation}Menu`],
            isPopover && !positionReady && { opacity: 0 },
            {
              borderColor: colorPalette.content.border,
            },
            isPopover && {
              position: 'absolute',
              top: position.top,
              left: position.left,
            },
            contentStyle,
            isPopover && popoverBackground
              ? {
                  overflow: 'visible',
                  backgroundColor: 'transparent',
                  padding: 0,
                }
              : undefined,
            menuAnimatedStyle,
          ]}
          onLayout={isPopover ? onFloatingLayout : undefined}
        >
          {isPopover && popoverBackground ? (
            <View
              style={[styles.popoverSurface, { borderRadius: popoverRadius }]}
            >
              <View
                pointerEvents='none'
                style={StyleSheet.absoluteFill}
                accessibilityElementsHidden
                importantForAccessibility='no'
              >
                {popoverBackground}
              </View>
              {searchable && (
                <View style={styles.searchWrap}>
                  <View
                    style={styles.searchIcon}
                    accessibilityElementsHidden
                    importantForAccessibility='no'
                  >
                    <Search
                      width={16}
                      height={16}
                      color={theme.components.dropdown.separator.fg}
                    />
                  </View>
                  <TextInput
                    value={searchValue}
                    onChangeText={onSearchChange}
                    placeholder={searchPlaceholder}
                    returnKeyType='search'
                    placeholderTextColor={
                      theme.components.dropdown.separator.fg
                    }
                    accessibilityLabel={
                      searchAccessibilityLabel ?? searchPlaceholder
                    }
                    style={styles.searchInput}
                  />
                </View>
              )}
              {children}
            </View>
          ) : (
            <>
              {searchable && (
                <View style={styles.searchWrap}>
                  <View
                    style={styles.searchIcon}
                    accessibilityElementsHidden
                    importantForAccessibility='no'
                  >
                    <Search
                      width={16}
                      height={16}
                      color={theme.components.dropdown.separator.fg}
                    />
                  </View>
                  <TextInput
                    value={searchValue}
                    onChangeText={onSearchChange}
                    placeholder={searchPlaceholder}
                    returnKeyType='search'
                    placeholderTextColor={
                      theme.components.dropdown.separator.fg
                    }
                    accessibilityLabel={
                      searchAccessibilityLabel ?? searchPlaceholder
                    }
                    style={styles.searchInput}
                  />
                </View>
              )}
              {children}
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

DropdownContent.displayName = 'DropdownContent';
