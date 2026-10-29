import { Check, Close, Error, Info } from '@vellira-ui/icons';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@vellira-ui/react-native';

export type WorkspaceNoticeTone = 'success' | 'error' | 'neutral';

export type WorkspaceNoticeData = {
  message: string;
  tone: WorkspaceNoticeTone;
};

type WorkspaceNoticeProps = {
  notice: WorkspaceNoticeData;
  onDismiss: () => void;
  onUndo?: () => void;
};

/** Compact, token-driven feedback within the Native Starter. */
export function WorkspaceNotice({
  notice,
  onDismiss,
  onUndo,
}: WorkspaceNoticeProps) {
  const { theme } = useTheme();
  const success = theme.semantic.status.success;
  const error = theme.semantic.status.error;
  const appearance =
    notice.tone === 'success'
      ? {
          background: success.bg,
          foreground: success.fg,
          accent: success.border,
        }
      : notice.tone === 'error'
        ? {
            background: error.bg,
            foreground: error.fg,
            accent: error.border,
          }
        : {
            background: theme.semantic.surface.subtle,
            foreground: theme.semantic.text.primary,
            accent: theme.semantic.text.subtle,
          };
  const NoticeIcon =
    notice.tone === 'success' ? Check : notice.tone === 'error' ? Error : Info;

  return (
    <View
      style={{
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 12,
        paddingRight: 4,
        paddingVertical: 4,
        borderWidth: 1,
        borderLeftWidth: 3,
        borderRadius: 14,
        borderColor: theme.semantic.border.muted,
        borderLeftColor: appearance.accent,
        backgroundColor: appearance.background,
      }}
    >
      <NoticeIcon size={18} color={appearance.foreground} />
      <Text
        accessibilityLiveRegion={
          notice.tone === 'error' ? 'assertive' : 'polite'
        }
        style={{
          flex: 1,
          minWidth: 0,
          color: appearance.foreground,
          fontSize: 13,
          lineHeight: 18,
          fontWeight: '600',
        }}
      >
        {notice.message}
      </Text>
      {onUndo ? (
        <Pressable
          accessibilityRole='button'
          accessibilityLabel='Undo project removal'
          onPress={onUndo}
          hitSlop={6}
          style={{
            minHeight: 44,
            minWidth: 48,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 6,
          }}
        >
          <Text
            style={{
              color: appearance.foreground,
              fontSize: 13,
              fontWeight: '700',
            }}
          >
            Undo
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole='button'
        accessibilityLabel='Dismiss notification'
        hitSlop={6}
        onPress={onDismiss}
        style={{
          width: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Close size={16} color={appearance.foreground} />
      </Pressable>
    </View>
  );
}
