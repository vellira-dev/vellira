import { useId, useSyncExternalStore } from 'react';

import { Platform, StyleSheet, View } from 'react-native';

import { useOverlayRegistration } from '../../../hooks';
import { Portal } from '../../../primitives/Portal';
import { useTheme } from '../../../theme';
import { useOptionalToastStore } from '../internal/ToastContext';
import { ToastRoot } from '../Root';

import type { ToastViewportProps } from './types';

const EMPTY_TOASTS = [] as const;

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    alignItems: 'center',
  },
  bottom: { flexDirection: 'column-reverse' },
  start: { alignItems: 'flex-start' },
  center: { alignItems: 'center' },
  end: { alignItems: 'flex-end' },
});

export function ToastViewport({
  children,
  portal = false,
  position = 'top-center',
  accessibilityLabel = 'Notifications',
  style,
  testID,
}: ToastViewportProps) {
  const { theme } = useTheme();
  const store = useOptionalToastStore();
  const records = useSyncExternalStore(
    store?.subscribe ?? (() => () => undefined),
    store?.getSnapshot ?? (() => EMPTY_TOASTS),
    store?.getSnapshot ?? (() => EMPTY_TOASTS)
  );
  const generatedId = useId();
  const overlay = useOverlayRegistration({
    active: records.length > 0 || children !== undefined,
    id: `vellira-toast-viewport-${generatedId}`,
  });
  const [edge, alignment] = position.split('-') as [
    'top' | 'bottom',
    'start' | 'center' | 'end',
  ];
  const inset = theme.tokens.spacing[4];

  const viewport = (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      pointerEvents={Platform.OS === 'web' ? undefined : 'box-none'}
      style={[
        styles.viewport,
        {
          left: inset,
          right: inset,
          gap: theme.tokens.spacing[3],
          [edge]: inset,
        },
        edge === 'bottom' ? styles.bottom : undefined,
        styles[alignment],
        { zIndex: overlay.zIndex },
        style,
      ]}
    >
      {records.map((record) => (
        <ToastRoot
          key={`${record.id}:${record.revision}`}
          open
          title={record.title}
          description={record.description}
          icon={record.icon}
          announcement={record.announcement}
          tone={record.tone}
          duration={record.duration}
          dismissible={record.dismissible}
          action={record.action}
          onOpenChange={(nextOpen, details) => {
            if (!nextOpen) store?.dismiss(record.id, details?.reason);
          }}
        />
      ))}
      {children}
    </View>
  );

  return portal ? <Portal>{viewport}</Portal> : viewport;
}

ToastViewport.displayName = 'Toast.Viewport';
