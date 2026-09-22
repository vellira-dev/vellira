import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type ToastViewportProps = {
  children?: ReactNode;
  portal?: boolean;
  position?:
    | 'top-start'
    | 'top-center'
    | 'top-end'
    | 'bottom-start'
    | 'bottom-center'
    | 'bottom-end';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
