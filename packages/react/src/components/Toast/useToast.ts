import { useMemo } from 'react';

import type { ToastTone } from '@vellira-ui/types';

import type { ToastOptions } from './internal/store';
import { useToastStore } from './internal/ToastContext';

export function useToast() {
  const store = useToastStore();

  return useMemo(() => {
    const showTone = (tone: ToastTone, options: ToastOptions) =>
      store.show({ ...options, tone });

    return {
      show: store.show,
      update: store.update,
      dismiss: store.dismiss,
      clear: store.clear,
      neutral: (options: ToastOptions) => showTone('neutral', options),
      info: (options: ToastOptions) => showTone('info', options),
      success: (options: ToastOptions) => showTone('success', options),
      warning: (options: ToastOptions) => showTone('warning', options),
      error: (options: ToastOptions) => showTone('error', options),
      danger: (options: ToastOptions) => showTone('danger', options),
    };
  }, [store]);
}
