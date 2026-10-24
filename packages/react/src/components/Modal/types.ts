import type {
  BaseModalProps,
  ModalAnimation,
  ModalAnimationDuration,
  ModalAnimationEasing,
} from '@vellira-ui/types';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';

export type ModalAutoFocusEvent = {
  /** Prevents the default focus movement for this lifecycle event. */
  preventDefault: () => void;
  /** Whether default focus movement has been prevented. */
  defaultPrevented: boolean;
};

export type ModalOutsideEvent = {
  /** Original pointer event that occurred outside the modal content. */
  originalEvent: PointerEvent | React.PointerEvent<HTMLElement>;
  /** Prevents the default outside-interaction behavior. */
  preventDefault: () => void;
  /** Whether default outside-interaction behavior has been prevented. */
  defaultPrevented: boolean;
};

export interface ModalProps extends BaseModalProps {
  /** Modal trigger, overlay, content, and compound children. */
  children: ReactNode;
  /** Uses modal interaction semantics while open. */
  modal?: boolean;
  /** Prevents document scrolling while the modal is open. */
  preventScroll?: boolean;
  /** Keeps keyboard focus inside the modal while open. */
  trapFocus?: boolean;
  /** Element that should receive focus when the modal opens. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Element that should receive focus when the modal closes. */
  finalFocus?: RefObject<HTMLElement | null>;
  /** Called before focus moves into the modal after opening. */
  onOpenAutoFocus?: (event: ModalAutoFocusEvent) => void;
  /** Called before focus is restored after closing. */
  onCloseAutoFocus?: (event: ModalAutoFocusEvent) => void;
  /** Called when Escape is pressed while the modal is open. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** Called when a pointer down occurs outside modal content. */
  onPointerDownOutside?: (event: ModalOutsideEvent) => void;
  /** Called when an interaction occurs outside modal content. */
  onInteractOutside?: (event: ModalOutsideEvent) => void;
  /** ARIA role applied to the modal content. */
  role?: 'dialog' | 'alertdialog';
  /** Class name applied to the modal root. */
  className?: string;
}

export type { ModalAnimation, ModalAnimationDuration, ModalAnimationEasing };
