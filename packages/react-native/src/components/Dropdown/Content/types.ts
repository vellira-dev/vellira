import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface DropdownContentProps {
  /** Dropdown item and slot content. */
  children: ReactNode;
  /** Style applied to dropdown content. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Optional background for anchored native popovers. */
  popoverBackground?: ReactNode;
  /** Accessible name for dropdown content. */
  accessibilityLabel?: string;
}
