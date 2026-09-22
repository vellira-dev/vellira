import type { BaseToastProps, ToastTone } from '@vellira-ui/types';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type { ToastAction } from './internal/store';

export type ToastProps = BaseToastProps & {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  announcement?: string;
  tone?: ToastTone;
  duration?: number;
  dismissible?: boolean;
  dismissLabel?: string;
  action?: ToastAction;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
