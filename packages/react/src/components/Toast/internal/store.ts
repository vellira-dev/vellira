import type { ToastCloseReason, ToastTone } from '@vellira-ui/types';
import type { ReactNode } from 'react';

export type ToastAction = {
  label: string;
  onAction?: () => void;
  closeOnAction?: boolean;
};

export type ToastOptions = {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: ToastTone;
  duration?: number;
  dismissible?: boolean;
  action?: ToastAction;
  dedupeKey?: string;
  onDismiss?: (reason: ToastCloseReason) => void;
};

export type ToastRecord = ToastOptions & {
  id: string;
  revision: number;
  tone: ToastTone;
  duration: number;
  dismissible: boolean;
};

export type ToastStoreConfig = {
  duration?: number;
  maxVisible?: number;
};

export type ToastStore = {
  show: (options: ToastOptions) => string;
  update: (id: string, options: Partial<ToastOptions>) => void;
  dismiss: (id: string, reason?: ToastCloseReason) => void;
  clear: (reason?: ToastCloseReason) => void;
  getSnapshot: () => readonly ToastRecord[];
  subscribe: (listener: () => void) => () => void;
};

const DEFAULT_DURATION = 5000;
const DEFAULT_MAX_VISIBLE = 3;

export function createToastStore({
  duration: defaultDuration = DEFAULT_DURATION,
  maxVisible = DEFAULT_MAX_VISIBLE,
}: ToastStoreConfig = {}): ToastStore {
  if (!Number.isInteger(maxVisible) || maxVisible < 1) {
    throw new Error('Toast maxVisible must be a positive integer.');
  }

  let sequence = 0;
  let snapshot: readonly ToastRecord[] = [];
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());
  const createId = () => {
    let id: string;
    do id = `toast-${++sequence}`;
    while (snapshot.some((record) => record.id === id));
    return id;
  };

  const dismiss = (id: string, reason: ToastCloseReason = 'programmatic') => {
    const record = snapshot.find((item) => item.id === id);
    if (!record) return;

    snapshot = snapshot.filter((item) => item.id !== id);
    emit();
    record.onDismiss?.(reason);
  };

  return {
    show(options) {
      const dedupeIndex = options.dedupeKey
        ? snapshot.findIndex((record) => record.dedupeKey === options.dedupeKey)
        : -1;
      const existing = dedupeIndex >= 0 ? snapshot[dedupeIndex] : undefined;
      if (existing && options.id && options.id !== existing.id) {
        throw new Error(
          `Toast dedupeKey "${options.dedupeKey}" is already active as "${existing.id}".`
        );
      }
      const id = existing?.id ?? options.id ?? createId();

      if (
        snapshot.some(
          (record, index) => record.id === id && index !== dedupeIndex
        )
      ) {
        throw new Error(`Toast id "${id}" is already active.`);
      }

      const record: ToastRecord = {
        ...existing,
        ...options,
        id,
        revision: (existing?.revision ?? -1) + 1,
        tone: options.tone ?? existing?.tone ?? 'neutral',
        duration: options.duration ?? existing?.duration ?? defaultDuration,
        dismissible: options.dismissible ?? existing?.dismissible ?? true,
      };

      if (dedupeIndex >= 0) {
        snapshot = snapshot.map((item, index) =>
          index === dedupeIndex ? record : item
        );
        emit();
        return id;
      }

      const next = [...snapshot, record];
      const overflow = next.slice(0, Math.max(0, next.length - maxVisible));
      snapshot = next.slice(-maxVisible);
      emit();
      overflow.forEach((item) => item.onDismiss?.('overflow'));
      return id;
    },
    update(id, options) {
      const index = snapshot.findIndex((record) => record.id === id);
      if (index < 0) return;

      if (
        options.dedupeKey &&
        snapshot.some(
          (record) => record.id !== id && record.dedupeKey === options.dedupeKey
        )
      ) {
        throw new Error(
          `Toast dedupeKey "${options.dedupeKey}" is already active.`
        );
      }

      const current = snapshot[index];
      snapshot = snapshot.map((record, recordIndex) =>
        recordIndex === index
          ? {
              ...current,
              ...options,
              id,
              revision: current.revision + 1,
              tone: options.tone ?? current.tone,
              duration: options.duration ?? current.duration,
              dismissible: options.dismissible ?? current.dismissible,
            }
          : record
      );
      emit();
    },
    dismiss,
    clear(reason = 'programmatic') {
      const records = snapshot;
      if (records.length === 0) return;
      snapshot = [];
      emit();
      records.forEach((record) => record.onDismiss?.(reason));
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
