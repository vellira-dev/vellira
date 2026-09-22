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
    if (!open || duration <= 0 || remainingRef.current <= 0) return;
    clearTimer(false);
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(
      () => requestClose('timeout'),
      remainingRef.current
    );
  }, [clearTimer, duration, open, requestClose]);

  useEffect(() => {
    remainingRef.current = duration;
    if (open) startTimer();
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
      onPointerEnter={pauseOnHover ? () => clearTimer(true) : undefined}
      onPointerLeave={pauseOnHover ? startTimer : undefined}
      onFocusCapture={pauseOnFocus ? () => clearTimer(true) : undefined}
      onBlurCapture={
        pauseOnFocus
          ? (event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                startTimer();
            }
          : undefined
      }
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
