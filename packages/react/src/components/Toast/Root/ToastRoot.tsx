import { useCallback, useEffect, useRef } from 'react';

import {
  Close as CloseIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Success as SuccessIcon,
  Warning as WarningIcon,
} from '@vellira-ui/icons';
import type { ToastCloseReason } from '@vellira-ui/types';

import type { ToastProps } from '../types';

import styles from './ToastRoot.module.scss';

import { useControllableState } from '#hooks';
import { cn } from '#utils/cn';

const DEFAULT_DURATION = 5000;

export function ToastRoot({
  id,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  title,
  description,
  icon,
  children,
  tone = 'neutral',
  duration = DEFAULT_DURATION,
  dismissible = true,
  dismissLabel = 'Dismiss notification',
  action,
  pauseOnHover = true,
  pauseOnFocus = true,
  closeOnEscape = false,
  ariaLive,
  className,
  style,
}: ToastProps) {
  const closeReason = useRef<ToastCloseReason>('programmatic');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(0);
  const remainingRef = useRef(duration);
  const timeoutRequestedRef = useRef(false);
  const interactionRef = useRef({ pointer: false, focus: false });
  const pausePolicyRef = useRef({ pointer: pauseOnHover, focus: pauseOnFocus });
  const [open, setOpen] = useControllableState({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: (nextOpen) => {
      onOpenChange?.(nextOpen, { reason: closeReason.current });
    },
  });

  const requestClose = useCallback(
    (reason: ToastCloseReason) => {
      closeReason.current = reason;
      setOpen(false);
    },
    [setOpen]
  );

  // Callback changes must not restart the active duration or lose a pause.
  const requestCloseRef = useRef(requestClose);
  useEffect(() => {
    requestCloseRef.current = requestClose;
  }, [requestClose]);

  const clearTimer = useCallback((preserveRemaining: boolean) => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    if (preserveRemaining) {
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedAtRef.current)
      );
    }
  }, []);

  const startTimer = useCallback(() => {
    if (
      !open ||
      duration <= 0 ||
      timeoutRequestedRef.current ||
      timerRef.current !== null
    ) {
      return;
    }

    const interaction = interactionRef.current;
    const policy = pausePolicyRef.current;
    if (
      (policy.pointer && interaction.pointer) ||
      (policy.focus && interaction.focus)
    ) {
      return;
    }

    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      remainingRef.current = 0;
      timeoutRequestedRef.current = true;
      requestCloseRef.current('timeout');
    }, Math.max(0, remainingRef.current));
  }, [duration, open]);

  useEffect(() => {
    pausePolicyRef.current = { pointer: pauseOnHover, focus: pauseOnFocus };
    const interaction = interactionRef.current;
    if (
      (pauseOnHover && interaction.pointer) ||
      (pauseOnFocus && interaction.focus)
    ) {
      clearTimer(true);
    } else {
      startTimer();
    }
  }, [clearTimer, pauseOnFocus, pauseOnHover, startTimer]);

  useEffect(() => {
    clearTimer(false);
    remainingRef.current = duration;
    timeoutRequestedRef.current = false;
    if (!open) interactionRef.current = { pointer: false, focus: false };
    startTimer();
    return () => clearTimer(false);
  }, [clearTimer, duration, open, startTimer]);

  useEffect(() => {
    if (!closeOnEscape || !open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        rootRef.current?.contains(document.activeElement)
      ) {
        event.preventDefault();
        requestClose('escape');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeOnEscape, open, requestClose]);

  if (!open) return null;

  const assertive = tone === 'error' || tone === 'danger';
  const semanticIcon =
    tone === 'success' ? (
      <SuccessIcon size={20} />
    ) : tone === 'warning' ? (
      <WarningIcon size={20} />
    ) : tone === 'error' || tone === 'danger' ? (
      <ErrorIcon size={20} />
    ) : (
      <InfoIcon size={20} />
    );

  return (
    <div
      ref={rootRef}
      id={id}
      role={assertive ? 'alert' : 'status'}
      aria-atomic='true'
      aria-live={ariaLive ?? (assertive ? 'assertive' : 'polite')}
      className={cn(styles.root, className)}
      data-state='open'
      data-tone={tone}
      style={style}
      onPointerEnter={() => {
        interactionRef.current.pointer = true;
        if (pauseOnHover) clearTimer(true);
      }}
      onPointerLeave={() => {
        interactionRef.current.pointer = false;
        startTimer();
      }}
      onFocusCapture={() => {
        interactionRef.current.focus = true;
        if (pauseOnFocus) clearTimer(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          interactionRef.current.focus = false;
          startTimer();
        }
      }}
    >
      <span className={styles.icon} data-toast-icon aria-hidden='true'>
        {icon ?? semanticIcon}
      </span>
      <div className={styles.content}>
        {title !== undefined && <div className={styles.title}>{title}</div>}
        {description !== undefined && (
          <div className={styles.description}>{description}</div>
        )}
        {children !== undefined && (
          <div className={styles.body}>{children}</div>
        )}
      </div>

      {action && (
        <button
          type='button'
          className={styles.action}
          onClick={() => {
            action.onAction?.();
            if (action.closeOnAction !== false) requestClose('action');
          }}
        >
          {action.label}
        </button>
      )}

      {dismissible && (
        <button
          type='button'
          className={styles.dismiss}
          aria-label={dismissLabel}
          onClick={() => requestClose('dismiss')}
        >
          <CloseIcon size={20} aria-hidden='true' />
        </button>
      )}
    </div>
  );
}

ToastRoot.displayName = 'Toast.Root';
