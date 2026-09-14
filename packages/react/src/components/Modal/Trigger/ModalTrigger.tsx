import { cloneElement, isValidElement } from 'react';

import type {
  HTMLAttributes,
  MouseEventHandler,
  ReactElement,
  Ref,
} from 'react';

import {
  composeEventHandlers,
  composeRefs,
} from '../internal/composeEventHandlers';
import { useModalContext } from '../internal/ModalContext';

import type { ModalTriggerProps } from './types';

import { cn } from '#utils/cn';

type TriggerChildProps = HTMLAttributes<HTMLElement> & {
  disabled?: boolean;
  ref?: Ref<HTMLElement>;
};

export const ModalTrigger = ({
  children,
  asChild = false,
  disabled = false,
  className,
}: ModalTriggerProps) => {
  const root = useModalContext();
  const child =
    asChild && isValidElement<TriggerChildProps>(children)
      ? (children as ReactElement<TriggerChildProps>)
      : undefined;
  const isDisabled = disabled;
  const triggerProps = {
    'aria-controls': root.contentId,
    'aria-disabled': isDisabled || undefined,
    'aria-expanded': root.open,
    'aria-haspopup': 'dialog' as const,
    className: cn(className),
    'data-state': root.open ? 'open' : 'closed',
    disabled: isDisabled || undefined,
    onClick: composeEventHandlers(
      child?.props.onClick as MouseEventHandler<HTMLElement> | undefined,
      () => {
        if (!isDisabled) {
          root.setOpen(true);
        }
      }
    ),
  };

  if (child) {
    return cloneElement(child, {
      ...triggerProps,
      ref: composeRefs(child.props.ref, root.triggerRef),
      className: cn(child.props.className, className),
    });
  }

  return (
    <button
      ref={(node) => {
        root.triggerRef.current = node;
      }}
      type='button'
      {...triggerProps}
    >
      {children}
    </button>
  );
};

ModalTrigger.displayName = 'Modal.Trigger';
