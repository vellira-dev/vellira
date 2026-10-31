import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

type Edge = 'top' | 'bottom' | 'left' | 'right';

export function SafeAreaProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function SafeAreaView({
  edges: _edges,
  ...props
}: ViewProps & { edges?: readonly Edge[] }) {
  return <View {...props} />;
}

// The preview's device shell owns the browser status bar and bottom padding;
// the real iOS/Android application continues to use its native safe-area API.
export function useSafeAreaInsets() {
  return { top: 0, bottom: 0, left: 0, right: 0 };
}
