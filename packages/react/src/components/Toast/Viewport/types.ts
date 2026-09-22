import type { CSSProperties, ReactNode } from 'react';

export type ToastViewportProps = {
  children?: ReactNode;
  portal?: boolean;
  container?: Element | DocumentFragment | null;
  position?:
    | 'top-start'
    | 'top-center'
    | 'top-end'
    | 'bottom-start'
    | 'bottom-center'
    | 'bottom-end';
  label?: string;
  className?: string;
  style?: CSSProperties;
};
