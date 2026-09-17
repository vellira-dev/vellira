import { useEffect, useRef } from 'react';

import type { ViewInstance } from 'react-native';

import {
  useModal,
  useOverlayDismiss,
  useOverlayFocusRestore,
} from '../../../hooks';
import { ModalProvider } from '../internal/ModalContext';
import type { ModalProps } from '../types';

import { useModalRootAnimation } from './useModalRootAnimation';

export const ModalRoot = ({
  open,
  defaultOpen = false,
  onOpenChange,
  animation = 'scale',
  duration,
  easing = 'standard',
  closeOnEscape = true,
  closeOnOutsidePress = true,
  restoreFocus = true,
  children,
}: ModalProps) => {
  const initialOpen = open ?? defaultOpen;
  const triggerRef = useRef<ViewInstance | null>(null);
  const modal = useModal({
    open,
    defaultOpen,
    onOpenChange,
    closeOnEscape,
    closeOnOutsidePress,
  });
  const { animationProgress, shouldRender } = useModalRootAnimation({
    animation,
    defaultOpen: initialOpen,
    duration,
    easing,
    open: modal.open,
  });

  const { restoreFocusAfterClose } = useOverlayFocusRestore({
    active: modal.open,
    enabled: restoreFocus,
    triggerRef,
  });

  const previousOpenRef = useRef(modal.open);

  useEffect(() => {
    const wasOpen = previousOpenRef.current;

    if (wasOpen && !modal.open) {
      restoreFocusAfterClose();
    }

    previousOpenRef.current = modal.open;
  }, [modal.open, restoreFocusAfterClose]);

  const dismiss = useOverlayDismiss({
    id: modal.contentId,
    active: modal.open,
    closeOnEscape: modal.closeOnEscape,
    closeOnOutsidePress: modal.closeOnOutsidePress,
    requestClose: modal.requestClose,
  });

  return (
    <ModalProvider
      value={{
        animation,
        animationProgress,
        zIndex: dismiss.zIndex,
        onClose: dismiss.requestClose,
        getOutsidePressProps: dismiss.getOutsidePressProps,
        open: modal.open,
        setOpen: modal.setOpen,
        shouldRender,
        triggerRef,
      }}
    >
      {children}
    </ModalProvider>
  );
};

ModalRoot.displayName = 'ModalRoot';
