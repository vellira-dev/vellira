import { useEffect, useMemo, useRef, useState } from 'react';

import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';

import { useTheme } from '../../../theme';
import { useTabs } from '../internal/TabsContext';
import type { TabsTriggerLayout } from '../types';

import type { TabsIndicatorProps } from './types';

const COLLAPSED_SIZE = 8;
const LINE_ANIMATION_DURATION = 360;
const SURFACE_ANIMATION_DURATION = 220;
const easing = Easing?.bezier?.(0.22, 1, 0.36, 1) ?? ((value: number) => value);
const nativePointerEventsNone =
  Platform.OS === 'web' ? undefined : ({ pointerEvents: 'none' } as const);
const webPointerEventsNone =
  Platform.OS === 'web' ? { pointerEvents: 'none' as const } : undefined;

const animateValue = (
  value: Animated.Value,
  toValue: number,
  duration: number
) =>
  Animated.timing(value, {
    toValue,
    duration,
    easing,
    useNativeDriver: false,
  });

export const TabsIndicator = ({ children, style }: TabsIndicatorProps) => {
  const { theme } = useTheme();
  const {
    value,
    orientation,
    variant,
    color,
    size,
    indicatorVersion,
    getTriggerLayout,
  } = useTabs();
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;
  const height = useRef(new Animated.Value(0)).current;
  const previousLayoutRef = useRef<TabsTriggerLayout | null>(null);
  const previousValueRef = useRef<string | undefined>(undefined);
  const previousOrientationRef = useRef(orientation);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [visible, setVisible] = useState(false);
  const isVertical = orientation === 'vertical';
  const palette = theme.components.tabs[color];

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion);

    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => {
      subscription?.remove();
      animationRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!value) {
      setVisible(false);
      return;
    }

    const nextLayout = getTriggerLayout(value);

    if (!nextLayout || nextLayout.width <= 0 || nextLayout.height <= 0) {
      setVisible(false);
      return;
    }

    setVisible(true);
    animationRef.current?.stop();

    const previousLayout = previousLayoutRef.current;
    const shouldAnimate =
      !reduceMotion &&
      previousLayout &&
      previousValueRef.current !== value &&
      previousOrientationRef.current === orientation;

    if (!shouldAnimate) {
      translateX.setValue(nextLayout.x);
      translateY.setValue(nextLayout.y);
      width.setValue(nextLayout.width);
      height.setValue(nextLayout.height);
      previousLayoutRef.current = nextLayout;
      previousValueRef.current = value;
      previousOrientationRef.current = orientation;
      return;
    }

    if (variant === 'line' && isVertical) {
      const previousCenter = previousLayout.y + previousLayout.height / 2;
      const nextCenter = nextLayout.y + nextLayout.height / 2;
      const collapsedPreviousY = previousCenter - COLLAPSED_SIZE / 2;
      const collapsedNextY = nextCenter - COLLAPSED_SIZE / 2;

      translateY.setValue(previousLayout.y);
      height.setValue(previousLayout.height);

      animationRef.current = Animated.sequence([
        Animated.parallel([
          animateValue(height, COLLAPSED_SIZE, LINE_ANIMATION_DURATION * 0.28),
          animateValue(
            translateY,
            collapsedPreviousY,
            LINE_ANIMATION_DURATION * 0.28
          ),
        ]),
        animateValue(
          translateY,
          collapsedNextY,
          LINE_ANIMATION_DURATION * 0.36
        ),
        Animated.parallel([
          animateValue(
            height,
            nextLayout.height,
            LINE_ANIMATION_DURATION * 0.36
          ),
          animateValue(
            translateY,
            nextLayout.y,
            LINE_ANIMATION_DURATION * 0.36
          ),
        ]),
      ]);
    } else if (variant === 'line') {
      const previousCenter = previousLayout.x + previousLayout.width / 2;
      const nextCenter = nextLayout.x + nextLayout.width / 2;
      const collapsedPreviousX = previousCenter - COLLAPSED_SIZE / 2;
      const collapsedNextX = nextCenter - COLLAPSED_SIZE / 2;

      translateX.setValue(previousLayout.x);
      width.setValue(previousLayout.width);

      animationRef.current = Animated.sequence([
        Animated.parallel([
          animateValue(width, COLLAPSED_SIZE, LINE_ANIMATION_DURATION * 0.28),
          animateValue(
            translateX,
            collapsedPreviousX,
            LINE_ANIMATION_DURATION * 0.28
          ),
        ]),
        animateValue(
          translateX,
          collapsedNextX,
          LINE_ANIMATION_DURATION * 0.36
        ),
        Animated.parallel([
          animateValue(width, nextLayout.width, LINE_ANIMATION_DURATION * 0.36),
          animateValue(
            translateX,
            nextLayout.x,
            LINE_ANIMATION_DURATION * 0.36
          ),
        ]),
      ]);
    } else {
      translateX.setValue(previousLayout.x);
      translateY.setValue(previousLayout.y);
      width.setValue(previousLayout.width);
      height.setValue(previousLayout.height);

      animationRef.current = Animated.parallel([
        animateValue(translateX, nextLayout.x, SURFACE_ANIMATION_DURATION),
        animateValue(translateY, nextLayout.y, SURFACE_ANIMATION_DURATION),
        animateValue(width, nextLayout.width, SURFACE_ANIMATION_DURATION),
        animateValue(height, nextLayout.height, SURFACE_ANIMATION_DURATION),
      ]);
    }

    animationRef.current.start(() => {
      translateX.setValue(nextLayout.x);
      translateY.setValue(nextLayout.y);
      width.setValue(nextLayout.width);
      height.setValue(nextLayout.height);
    });

    previousLayoutRef.current = nextLayout;
    previousValueRef.current = value;
    previousOrientationRef.current = orientation;
  }, [
    getTriggerLayout,
    height,
    indicatorVersion,
    isVertical,
    orientation,
    reduceMotion,
    translateX,
    translateY,
    value,
    variant,
    width,
  ]);

  const indicatorStyle = useMemo(() => {
    const baseStyle = {
      position: 'absolute' as const,
      opacity: visible ? 1 : 0,
      zIndex: 0,
    };

    if (variant === 'line') {
      return [
        baseStyle,
        {
          backgroundColor: palette.indicator.bg,
          borderRadius: theme.tokens.radius.full,
        },
        isVertical
          ? {
              top: 0,
              right: 0,
              width: 3,
              height,
              transform: [{ translateY }],
            }
          : {
              right: undefined,
              bottom: 0,
              left: 0,
              width,
              height: 3,
              transform: [{ translateX }],
            },
        style,
      ];
    }

    if (variant === 'pills') {
      return [
        baseStyle,
        {
          top: 0,
          left: 0,
          width,
          height,
          backgroundColor: palette.pills.active.bg,
          borderColor: palette.pills.active.border,
          borderRadius:
            theme.tokens.radius[
              size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'
            ],
          borderWidth: 1,
          transform: [{ translateX }, { translateY }],
        },
        style,
      ];
    }

    return [
      baseStyle,
      {
        top: -1,
        left: -1,
        width,
        height,
        backgroundColor: palette.segmented.active.bg,
        borderColor: palette.segmented.active.border,
        borderRadius: theme.tokens.radius.lg,
        borderWidth: 1,
        ...Platform.select({
          web: {
            boxShadow: `${theme.tokens.shadows.sm.x}px ${
              theme.tokens.shadows.sm.y
            }px ${theme.tokens.shadows.sm.blur}px color-mix(in srgb, ${
              theme.tokens.shadows.sm.color
            } ${theme.tokens.shadows.sm.opacity * 100}%, transparent)`,
          },
          default: {
            shadowColor: theme.tokens.shadows.sm.color,
            shadowOffset: {
              width: theme.tokens.shadows.sm.x,
              height: theme.tokens.shadows.sm.y,
            },
            shadowOpacity: theme.tokens.shadows.sm.opacity,
            shadowRadius: theme.tokens.shadows.sm.blur,
            elevation: theme.tokens.shadows.sm.elevation,
          },
        }),
        transform: [{ translateX }, { translateY }],
      },
      style,
    ];
  }, [
    height,
    isVertical,
    palette.indicator.bg,
    palette.pills.active.bg,
    palette.pills.active.border,
    palette.segmented.active.bg,
    palette.segmented.active.border,
    size,
    style,
    theme.tokens.radius,
    theme.tokens.shadows.sm,
    translateX,
    translateY,
    variant,
    visible,
    width,
  ]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility='no-hide-descendants'
      {...nativePointerEventsNone}
      style={[indicatorStyle, webPointerEventsNone]}
    >
      {children}
    </Animated.View>
  );
};

TabsIndicator.displayName = 'Tabs.Indicator';
