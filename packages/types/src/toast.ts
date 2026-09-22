export type ToastTone =
  'neutral' | 'info' | 'success' | 'warning' | 'error' | 'danger';

export type ToastCloseReason =
  'action' | 'dismiss' | 'escape' | 'overflow' | 'programmatic' | 'timeout';

export type ToastOpenChangeDetails = {
  reason: ToastCloseReason;
};

/** Shared cross-platform controlled/uncontrolled toast state. */
export interface BaseToastProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details?: ToastOpenChangeDetails) => void;
}
