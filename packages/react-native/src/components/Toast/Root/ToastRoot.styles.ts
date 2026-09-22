import type { ToastTone } from '@vellira-ui/types';
import { StyleSheet } from 'react-native';

import type { NativeTheme } from '../../../theme';

export const toastBaseStyles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 384,
    minHeight: 56,
    borderWidth: 1,
  },
  content: { flex: 1, minWidth: 0 },
  control: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { textDecorationLine: 'underline' },
});

export function createToastStyles(theme: NativeTheme) {
  const shadow = theme.tokens.shadows.lg;

  return StyleSheet.create({
    root: {
      gap: theme.tokens.spacing[3],
      padding: theme.tokens.spacing[4],
      borderRadius: theme.tokens.radius.lg,
      shadowColor: shadow.color,
      shadowOpacity: shadow.opacity,
      shadowRadius: shadow.blur,
      shadowOffset: { width: shadow.x, height: shadow.y },
      elevation: shadow.elevation,
    },
    title: {
      fontFamily: theme.tokens.typography.family.semibold,
      fontSize: theme.tokens.typography.size.md,
      lineHeight: theme.tokens.typography.lineHeight.md,
    },
    description: {
      marginTop: theme.tokens.spacing[1],
      fontFamily: theme.tokens.typography.family.regular,
      fontSize: theme.tokens.typography.size.sm,
      lineHeight: theme.tokens.typography.lineHeight.sm,
    },
    body: { marginTop: theme.tokens.spacing[1] },
    control: {
      borderRadius: theme.tokens.radius.md,
      paddingHorizontal: theme.tokens.spacing[2],
    },
    actionText: {
      fontFamily: theme.tokens.typography.family.semibold,
    },
  });
}

export function toastToneColors(tone: ToastTone, theme: NativeTheme) {
  if (tone === 'neutral') {
    return {
      backgroundColor: theme.components.toast.default.bg,
      borderColor: theme.components.toast.default.border,
      color: theme.components.toast.default.fg,
    };
  }

  const semanticTone = tone === 'danger' ? 'error' : tone;
  return {
    backgroundColor: theme.semantic.status[semanticTone].bg,
    borderColor: theme.semantic.status[semanticTone].border,
    color: theme.semantic.status[semanticTone].fg,
  };
}
