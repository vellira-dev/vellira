import { Check, Close, Error, Info } from '@vellira-ui/icons';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

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
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.5;
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
        flexDirection: largeText ? 'column' : 'row',
        alignItems: largeText ? 'stretch' : 'center',
        gap: largeText ? 0 : 8,
        paddingLeft: 12,
        paddingRight: 4,
        paddingVertical: largeText ? 6 : 4,
        borderWidth: 1,
        borderLeftWidth: 3,
        borderRadius: 14,
        borderColor: theme.semantic.border.muted,
        borderLeftColor: appearance.accent,
        backgroundColor: appearance.background,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          flex: largeText ? undefined : 1,
          minWidth: 0,
        }}
      >
        <NoticeIcon size={18} color={appearance.foreground} />
        <Text
          accessibilityLiveRegion={
            notice.tone === 'error' ? 'assertive' : 'polite'
          }
          maxFontSizeMultiplier={1.5}
          style={{
            flex: 1,
            minWidth: 0,
            color: appearance.foreground,
            fontSize: 13,
            lineHeight: largeText ? undefined : 18,
            fontWeight: '600',
          }}
        >
          {notice.message}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          alignSelf: largeText ? 'flex-end' : undefined,
          gap: 4,
        }}
      >
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
              maxFontSizeMultiplier={1.5}
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
    </View>
  );
}
