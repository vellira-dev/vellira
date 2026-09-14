import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { lightTheme } from '@vellira-ui/tokens';
import type { CSSProperties } from 'react';

import { useModalDismiss } from '../internal/useModalDismiss';
import type { ModalProps } from '../types';

import { useModal, useOverlayPresentation, useScrollLock } from '#hooks';

const easingMap = {
  standard: lightTheme.components.modal.motion.easing,
  linear: 'linear',
  ease: 'ease',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
} as const;

const parseDuration = (duration: string) => Number.parseFloat(duration);

const resolveDuration = (duration: ModalProps['duration']) => {
  if (typeof duration === 'number') {
    return {
      close: duration,
      open: duration,
    };
  }

  return {
    close:
      duration?.close ??
      parseDuration(lightTheme.components.modal.motion.closeDuration),
    open:
      duration?.open ??
      parseDuration(lightTheme.components.modal.motion.openDuration),
  };
};

export type UseModalRootStateOptions = Omit<
  ModalProps,
  'children' | 'className'
>;

export const useModalRootState = ({
  open,
  defaultOpen = false,
  onOpenChange,
  animation = 'scale',
  duration,
  easing = 'standard',
  modal = true,
  closeOnEscape = true,
  closeOnOutsidePress = true,
  preventScroll = true,
  restoreFocus = true,
  trapFocus = true,
  initialFocus,
  finalFocus,
  onOpenAutoFocus,
  onCloseAutoFocus,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  role = 'dialog',
}: UseModalRootStateOptions) => {
  const contentRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const modalState = useModal({
    open,
    defaultOpen,
    onOpenChange,
    closeOnEscape,
    closeOnOutsidePress,
  });
  const {
    contentId,
    descriptionId,
    open: isOpen,
    requestClose: requestModalClose,
    setOpen,
    titleId,
  } = modalState;
  const [titlePresent, setTitlePresent] = useState(false);
  const [descriptionPresent, setDescriptionPresent] = useState(false);
  const [contentRevision, setContentRevision] = useState(0);
  const animationDuration = resolveDuration(duration);
  const shouldAnimate = animation !== 'none';
  const closeDuration = shouldAnimate ? animationDuration.close : 0;
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      return;
    }

    if (closeDuration === 0) {
      setShouldRender(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShouldRender(false);
    }, closeDuration);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [closeDuration, isOpen]);

  const requestClose = useCallback(() => {
    requestModalClose();
  }, [requestModalClose]);

  const setContentRef = useCallback((node: HTMLElement | null) => {
    if (contentRef.current !== node) {
      contentRef.current = node;
      setContentRevision((revision) => revision + 1);
    }
  }, []);

  useScrollLock({
    active: isOpen,
    enabled: preventScroll,
  });

  const modalDismiss = useModalDismiss({
    active: isOpen,
    registrationActive: shouldRender,
    id: contentId,
    contentRef,
    closeOnEscape,
    closeOnOutsidePress,
    onEscapeKeyDown,
    onInteractOutside,
    onPointerDownOutside,
    requestClose,
  });

  const modalAnimationStyle = useMemo(
    () =>
      ({
        '--modal-animation-close-duration': `${animationDuration.close}ms`,
        '--modal-animation-easing': easingMap[easing],
        '--modal-animation-open-duration': `${animationDuration.open}ms`,
        '--z-index-modal':
          modalDismiss.zIndex !== undefined
            ? `${modalDismiss.zIndex}`
            : undefined,
      }) as CSSProperties,
    [
      animationDuration.close,
      animationDuration.open,
      easing,
      modalDismiss.zIndex,
    ]
  );
  const modalPresentation = useOverlayPresentation({
    presentation: 'modal',
    animationStyle: modalAnimationStyle,
  });
  const animationStyle =
    modalPresentation.animationStyle ?? modalAnimationStyle;

  useEffect(() => {
    if (
      process.env.NODE_ENV === 'production' ||
      !isOpen ||
      titlePresent ||
      !contentRef.current
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const contentNode = contentRef.current;
      const labelledBy = contentNode?.getAttribute('aria-labelledby');
      const hasLabelledByTarget = labelledBy
        ? Boolean(document.getElementById(labelledBy))
        : false;

      if (
        !isOpen ||
        titlePresent ||
        !contentNode ||
        contentNode.hasAttribute('aria-label') ||
        hasLabelledByTarget
      ) {
        return;
      }

      console.warn('Modal.Content requires Modal.Title or ariaLabel.');
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [contentRevision, isOpen, titlePresent]);

  useEffect(() => {
    if (
      process.env.NODE_ENV === 'production' ||
      !isOpen ||
      role !== 'alertdialog' ||
      descriptionPresent
    ) {
      return;
    }

    console.warn('Modal with role="alertdialog" requires Modal.Description.');
  }, [descriptionPresent, isOpen, role]);

  const context = useMemo(
    () => ({
      animation,
      animationStyle,
      closeOnEscape,
      closeOnOutsidePress,
      contentId,
      contentRef,
      descriptionId,
      finalFocus,
      initialFocus,
      zIndex: modalDismiss.zIndex,
      modal,
      onCloseAutoFocus,
      onEscapeKeyDown,
      onInteractOutside,
      onOpenAutoFocus,
      onPointerDownOutside,
      open: isOpen,
      preventScroll,
      requestClose,
      restoreFocus,
      role,
      setContentRef,
      setDescriptionPresent,
      setOpen,
      setTitlePresent,
      shouldRender,
      titleId,
      trapFocus,
      triggerRef,
    }),
    [
      animation,
      animationStyle,
      closeOnEscape,
      closeOnOutsidePress,
      contentId,
      descriptionId,
      finalFocus,
      initialFocus,
      modalDismiss.zIndex,
      isOpen,
      modal,
      onCloseAutoFocus,
      onEscapeKeyDown,
      onInteractOutside,
      onOpenAutoFocus,
      onPointerDownOutside,
      preventScroll,
      requestClose,
      restoreFocus,
      role,
      setContentRef,
      setOpen,
      shouldRender,
      titleId,
      trapFocus,
    ]
  );

  return {
    context,
    open: isOpen,
  };
};
