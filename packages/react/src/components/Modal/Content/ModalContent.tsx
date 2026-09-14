import { useCallback, useState } from 'react';

import { composeRefs } from '../internal/composeEventHandlers';
import {
  ModalContentProvider,
  useModalContext,
} from '../internal/ModalContext';
import { useModalAccessibility } from '../internal/useModalAccessibility';
import { useModalFocusTrap } from '../internal/useModalFocusTrap';

import type { ModalContentProps } from './types';

import styles from './ModalContent.module.scss';

import { cn } from '#utils/cn';

export const ModalContent = ({
  children,
  size = 'md',
  placement = 'center',
  scrollBehavior = 'inside',
  animated = true,
  forceMount = false,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  className,
  style,
}: ModalContentProps) => {
  const root = useModalContext();
  const active = root.open;
  const focusScopeActive = active && root.shouldRender;
  const [contentNode, setContentNode] = useState<HTMLElement | null>(null);
  const setContentRef = useCallback(
    (node: HTMLElement | null) => {
      root.setContentRef(node);
      setContentNode(node);
    },
    [root]
  );

  useModalFocusTrap({
    active: focusScopeActive,
    contentRef: root.contentRef,
    enabled: root.trapFocus,
    finalFocus: root.finalFocus ?? root.triggerRef,
    initialFocus: root.initialFocus,
    onCloseAutoFocus: root.onCloseAutoFocus,
    onOpenAutoFocus: root.onOpenAutoFocus,
    restoreFocus: root.restoreFocus,
  });
  useModalAccessibility({
    active,
    content: contentNode,
    enabled: root.modal,
  });

  if (!root.shouldRender && !forceMount) return null;

  const labelledBy = ariaLabelledBy ?? (ariaLabel ? undefined : root.titleId);
  const describedBy = ariaDescribedBy ?? root.descriptionId;

  return (
    <ModalContentProvider value={{ scrollBehavior }}>
      <div
        id={root.contentId}
        ref={composeRefs(setContentRef)}
        tabIndex={-1}
        className={cn(
          styles.content,
          styles[size],
          styles[placement],
          styles[scrollBehavior],
          animated && styles.animated,
          className
        )}
        style={{ ...root.animationStyle, ...style }}
        role={root.role}
        aria-modal={root.modal ? 'true' : undefined}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        data-state={active ? 'open' : 'closed'}
        data-animation={root.animation}
      >
        {children}
      </div>
    </ModalContentProvider>
  );
};

ModalContent.displayName = 'ModalContent';
