import type { BaseToastProps, ToastTone } from '@vellira-ui/types';
import type { CSSProperties, ReactNode } from 'react';

import type { ToastAction } from './internal/store';

export type ToastProps = BaseToastProps & {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  tone?: ToastTone;
  duration?: number;
  dismissible?: boolean;
  dismissLabel?: string;
  action?: ToastAction;
  pauseOnHover?: boolean;
  pauseOnFocus?: boolean;
  closeOnEscape?: boolean;
  ariaLive?: 'assertive' | 'off' | 'polite';
  className?: string;
  style?: CSSProperties;
};
