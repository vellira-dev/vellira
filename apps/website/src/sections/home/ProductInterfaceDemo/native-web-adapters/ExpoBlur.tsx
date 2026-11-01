import { View, type ViewProps } from 'react-native';

type BlurViewProps = ViewProps & {
  intensity?: number;
  tint?: string;
};

// Browser-only fallback for Expo Blur. Preserve View's accessibility and
// pointer interaction props, but leave the native visual effect to Expo.
export function BlurView({ children, style, pointerEvents }: BlurViewProps) {
  return (
    <View style={style} pointerEvents={pointerEvents}>
      {children}
    </View>
  );
}
