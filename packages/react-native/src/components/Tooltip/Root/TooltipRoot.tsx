import { useCallback, useEffect, useId, useMemo, useRef } from 'react';

import { View } from 'react-native';
import type { ViewInstance } from 'react-native';

import { useControllableState, useOverlayDismiss } from '../../../hooks';
import { useNativeFloatingPosition } from '../../../managers';
import { resolveTooltipDelay } from '../internal/resolveTooltipDelay';
import { TooltipProvider } from '../internal/TooltipContext';

import type { TooltipRootProps } from './types';

export const TooltipRoot = ({
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = 'top',
  disabled = false,
  delay,
  offset = 8,
  closeOnOutsidePress = true,
  style,
}: TooltipRootProps) => {
  const generatedId = useId();
  const contentId = `${generatedId}-content`;
  const triggerRef = useRef<ViewInstance | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedDelay = useMemo(() => resolveTooltipDelay(delay), [delay]);
  const [open, setOpenState] = useControllableState({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const {
    position,
    arrowPosition,
    placement: resolvedPlacement,
    updatePosition,
    onFloatingLayout,
  } = useNativeFloatingPosition(placement, offset);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (disabled && nextOpen) return;

      setOpenState(nextOpen);
    },
    [disabled, setOpenState]
  );

  const hide = useCallback(() => {
    clearCloseTimer();
    setOpen(false);
  }, [clearCloseTimer, setOpen]);

  const show = useCallback(() => {
    if (disabled) return;

    clearCloseTimer();
    updatePosition(triggerRef);

    const openTooltip = () => {
      setOpen(true);

      closeTimerRef.current = setTimeout(() => {
        setOpen(false);
        closeTimerRef.current = null;
      }, resolvedDelay.close);
    };

    if (resolvedDelay.open > 0) {
      closeTimerRef.current = setTimeout(openTooltip, resolvedDelay.open);
      return;
    }

    openTooltip();
  }, [clearCloseTimer, disabled, resolvedDelay, setOpen, updatePosition]);

  const dismiss = useOverlayDismiss({
    id: contentId,
    active: open && !disabled,
    closeOnOutsidePress,
    requestClose: hide,
  });

  useEffect(() => {
    if (disabled && open) {
      hide();
    }
  }, [disabled, hide, open]);

  useEffect(() => {
    return clearCloseTimer;
  }, [clearCloseTimer]);

  const contextValue = useMemo(
    () => ({
      contentId,
      open,
      disabled,
      placement: resolvedPlacement,
      position,
      arrowPosition,
      triggerRef,
      setOpen,
      show,
      hide,
      zIndex: dismiss.zIndex,
      requestClose: dismiss.requestClose,
      getOutsidePressProps: dismiss.getOutsidePressProps,
      onFloatingLayout,
    }),
    [
      arrowPosition,
      contentId,
      disabled,
      dismiss.zIndex,
      dismiss.getOutsidePressProps,
      dismiss.requestClose,
      hide,
      open,
      resolvedPlacement,
      position,
      setOpen,
      show,
      onFloatingLayout,
    ]
  );

  return (
    <TooltipProvider value={contextValue}>
      <View style={style}>{children}</View>
    </TooltipProvider>
  );
};

TooltipRoot.displayName = 'Tooltip.Root';
