import { useId, useSyncExternalStore } from 'react';

import { useOptionalToastStore } from '../internal/ToastContext';
import { ToastRoot } from '../Root';

import type { ToastViewportProps } from './types';

import styles from './ToastViewport.module.scss';

import { useOverlayRegistration } from '#hooks';
import { Portal } from '#primitives/Portal';
import { cn } from '#utils/cn';

const EMPTY_TOASTS = [] as const;

export function ToastViewport({
  children,
  portal = true,
  container,
  position = 'top-end',
  label = 'Notifications',
  className,
  style,
}: ToastViewportProps) {
  const store = useOptionalToastStore();
  const records = useSyncExternalStore(
    store?.subscribe ?? (() => () => undefined),
    store?.getSnapshot ?? (() => EMPTY_TOASTS),
    store?.getSnapshot ?? (() => EMPTY_TOASTS)
  );
  const generatedId = useId();
  const overlay = useOverlayRegistration({
    active: records.length > 0 || children !== undefined,
    id: `vellira-toast-viewport-${generatedId}`,
    zIndexLevel: 'toast',
  });

  const viewport = (
    <div
      role='region'
      aria-label={label}
      className={cn(styles.viewport, className)}
      data-position={position}
      style={{ ...style, zIndex: overlay.zIndex }}
    >
      {records.map((record) => (
        <ToastRoot
          key={`${record.id}:${record.revision}`}
          id={record.id}
          open
          title={record.title}
          description={record.description}
          icon={record.icon}
          tone={record.tone}
          duration={record.duration}
          dismissible={record.dismissible}
          action={record.action}
          onOpenChange={(nextOpen, details) => {
            if (!nextOpen) store?.dismiss(record.id, details?.reason);
          }}
        />
      ))}
      {children}
    </div>
  );

  return portal ? <Portal container={container}>{viewport}</Portal> : viewport;
}

ToastViewport.displayName = 'Toast.Viewport';
