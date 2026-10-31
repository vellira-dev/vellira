import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

type BlurViewProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: string;
};

// React Native's Platform.OS is 'web' here, so native iOS BlurView branches
// are not taken. Keep a valid fallback for module resolution only.
export function BlurView({ children, style }: BlurViewProps) {
  return <View style={style}>{children}</View>;
}
