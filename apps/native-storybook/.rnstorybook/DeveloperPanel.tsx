import { StyleSheet, Text, View } from 'react-native';

import {
  Button,
  nativeThemes,
  type NativeThemeName,
} from '@vellira-ui/react-native';

const diagnosticTheme = nativeThemes.highContrast;

type DeveloperPanelProps = {
  themeName: NativeThemeName;
  onChangeTheme: () => void;
};

const getThemeLabel = (themeName: NativeThemeName) => {
  if (themeName === 'highContrast') return 'High Contrast';
  if (themeName === 'dark') return 'Dark';

  return 'Light';
};

export const DeveloperPanel = ({
  themeName,
  onChangeTheme,
}: DeveloperPanelProps) => {
  return (
    <View
      style={{
        position: 'absolute',
        top: 48,
        right: 16,
        zIndex: 10,
        gap: 8,
        padding: 12,
        borderRadius: 12,
      }}
    >
      {/* Diagnostic chrome stays monochrome while the story theme changes.
          A separate background preserves its original 75% opacity. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            pointerEvents: 'none',
            borderRadius: 12,
            backgroundColor: diagnosticTheme.semantic.surface.canvas,
            opacity: 0.75,
          },
        ]}
      />
      <Text
        style={{
          color: diagnosticTheme.semantic.text.primary,
          fontWeight: '600',
        }}
      >
        Developer
      </Text>

      <Button
        color='neutral'
        onPress={onChangeTheme}
        style={{
          minHeight: 0,
          borderWidth: 0,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: diagnosticTheme.semantic.surface.inverse,
        }}
        textStyle={{
          color: diagnosticTheme.semantic.text.inverse,
          fontFamily: undefined,
          fontSize: 14,
          lineHeight: undefined,
        }}
      >
        🎨 {getThemeLabel(themeName)}
      </Button>
    </View>
  );
};
