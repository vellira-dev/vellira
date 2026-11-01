/* Generated from examples/workspace-starter/native by sync-native-starter-preview.mjs. Do not edit. */
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
  const { width, fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.5;
  // Short feedback keeps its actions on one line; longer feedback can grow.
  const stacked = largeText && (width < 360 || notice.message.length > 24);
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
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'stretch' : 'center',
        gap: stacked ? 2 : 8,
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          flex: stacked ? undefined : 1,
          minWidth: 0,
        }}
      >
        <NoticeIcon size={18} color={appearance.foreground} />
        <Text
          accessibilityLiveRegion={
            notice.tone === 'error' ? 'assertive' : 'polite'
          }
          maxFontSizeMultiplier={largeText ? 1.4 : 1.5}
          numberOfLines={largeText && !stacked ? 1 : undefined}
          adjustsFontSizeToFit={largeText && !stacked}
          minimumFontScale={0.9}
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
          alignSelf: stacked ? 'flex-end' : undefined,
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
