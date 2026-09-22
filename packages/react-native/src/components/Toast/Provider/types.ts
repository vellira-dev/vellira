import type { ReactNode } from 'react';

import type { ToastStore } from '../internal/store';

export type ToastProviderProps = {
  children?: ReactNode;
  store?: ToastStore;
  duration?: number;
  maxVisible?: number;
};
