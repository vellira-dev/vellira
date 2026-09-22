import { useRef } from 'react';

import { createToastStore } from '../internal/store';
import { ToastStoreContext } from '../internal/ToastContext';

import type { ToastProviderProps } from './types';

export function ToastProvider({
  children,
  store,
  duration,
  maxVisible,
}: ToastProviderProps) {
  const ownedStore = useRef<ReturnType<typeof createToastStore> | null>(null);
  if (!ownedStore.current) {
    ownedStore.current = createToastStore({ duration, maxVisible });
  }

  return (
    <ToastStoreContext.Provider value={store ?? ownedStore.current}>
      {children}
    </ToastStoreContext.Provider>
  );
}

ToastProvider.displayName = 'Toast.Provider';
