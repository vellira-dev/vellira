import { createContext, useContext } from 'react';

import type { ToastStore } from './store';

export const ToastStoreContext = createContext<ToastStore | null>(null);

export function useToastStore() {
  const store = useContext(ToastStoreContext);
  if (!store) throw new Error('useToast must be used within Toast.Provider.');
  return store;
}

export const useOptionalToastStore = () => useContext(ToastStoreContext);
