import { StyleSheet, type TextStyle } from 'react-native';

import type { nativeThemes } from '../../../theme';
import { toNativeFontWeight } from '../../../theme';

type NativeTheme = (typeof nativeThemes)[keyof typeof nativeThemes];
type PopoverTitleStyles = {
  title: TextStyle;
};

export function createPopoverTitleStyles(
  theme: NativeTheme
): PopoverTitleStyles {
  return StyleSheet.create<PopoverTitleStyles>({
    title: {
      color: theme.components.popover.title.fg,
      fontSize: theme.tokens.typography.size.md,
      fontWeight: toNativeFontWeight(theme.tokens.typography.weight.semibold),
    },
  });
}
