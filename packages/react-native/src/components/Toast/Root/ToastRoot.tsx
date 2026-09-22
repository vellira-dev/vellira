import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Close as CloseIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Success as SuccessIcon,
  Warning as WarningIcon,
} from '@vellira-ui/icons';
import type { ToastCloseReason } from '@vellira-ui/types';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  Text,
  View,
} from 'react-native';

import { useControllableState } from '../../../hooks';
import { useTheme } from '../../../theme';
import type { ToastProps } from '../types';

import {
  createToastStyles,
  toastBaseStyles,
  toastToneColors,
} from './ToastRoot.styles';

const DEFAULT_DURATION = 5000;

export function ToastRoot({
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  title,
  description,
  icon,
  children,
  announcement,
  tone = 'neutral',
  duration = DEFAULT_DURATION,
  dismissible = true,
  dismissLabel = 'Dismiss notification',
  action,
  accessibilityLabel,
  style,
  testID,
}: ToastProps) {
  const { theme } = useTheme();
  const tokenStyles = useMemo(() => createToastStyles(theme), [theme]);
  const closeReason = useRef<ToastCloseReason>('programmatic');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [open, setOpen] = useControllableState({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: (nextOpen) =>
      onOpenChange?.(nextOpen, { reason: closeReason.current }),
  });

  const requestClose = useCallback(
    (reason: ToastCloseReason) => {
      closeReason.current = reason;
      setOpen(false);
    },
    [setOpen]
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (!open) return;
    opacity.setValue(reduceMotion ? 1 : 0);
    translateY.setValue(reduceMotion ? 0 : -8);
    Animated.timing(opacity, {
      toValue: 1,
      duration: reduceMotion ? 0 : 180,
      useNativeDriver: true,
    }).start();
    Animated.timing(translateY, {
      toValue: 0,
      duration: reduceMotion ? 0 : 180,
      useNativeDriver: true,
    }).start();
  }, [open, opacity, reduceMotion, translateY]);

  useEffect(() => {
    if (!open || duration <= 0) return;
    timerRef.current = setTimeout(() => requestClose('timeout'), duration);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [duration, open, requestClose]);

  useEffect(() => {
    if (!open) return;
    const message =
      announcement ??
      [
        typeof title === 'string' ? title : undefined,
        typeof description === 'string' ? description : undefined,
      ]
        .filter(Boolean)
        .join('. ');
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [announcement, description, open, title]);

  const colors = useMemo(() => toastToneColors(tone, theme), [theme, tone]);

  if (!open) return null;
  const assertive = tone === 'error' || tone === 'danger';
  const semanticIcon =
    tone === 'success' ? (
      <SuccessIcon size={20} color={colors.color} />
    ) : tone === 'warning' ? (
      <WarningIcon size={20} color={colors.color} />
    ) : tone === 'error' || tone === 'danger' ? (
      <ErrorIcon size={20} color={colors.color} />
    ) : (
      <InfoIcon size={20} color={colors.color} />
    );

  return (
    <Animated.View
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel ?? announcement}
      accessibilityLiveRegion={assertive ? 'assertive' : 'polite'}
      accessibilityRole='alert'
      onAccessibilityEscape={() => requestClose('dismiss')}
      style={[
        toastBaseStyles.root,
        tokenStyles.root,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          opacity,
          transform: [{ translateY }],
        },
        style,
      ]}
    >
      <View accessible={false} importantForAccessibility='no'>
        {icon ?? semanticIcon}
      </View>
      <View style={toastBaseStyles.content}>
        {title !== undefined && (
          <Text style={[tokenStyles.title, { color: colors.color }]}>
            {title}
          </Text>
        )}
        {description !== undefined && (
          <Text style={[tokenStyles.description, { color: colors.color }]}>
            {description}
          </Text>
        )}
        {children !== undefined && (
          <View style={tokenStyles.body}>{children}</View>
        )}
      </View>

      {action && (
        <Pressable
          accessibilityRole='button'
          accessibilityLabel={action.label}
          hitSlop={4}
          style={[toastBaseStyles.control, tokenStyles.control]}
          onPress={() => {
            action.onAction?.();
            if (action.closeOnAction !== false) requestClose('action');
          }}
        >
          <Text
            style={[
              toastBaseStyles.actionText,
              tokenStyles.actionText,
              { color: colors.color },
            ]}
          >
            {action.label}
          </Text>
        </Pressable>
      )}

      {dismissible && (
        <Pressable
          accessibilityRole='button'
          accessibilityLabel={dismissLabel}
          hitSlop={4}
          style={[toastBaseStyles.control, tokenStyles.control]}
          onPress={() => requestClose('dismiss')}
        >
          <CloseIcon color={colors.color} size={20} />
        </Pressable>
      )}
    </Animated.View>
  );
}

ToastRoot.displayName = 'Toast.Root';
