import {
  Bell,
  Check,
  ChevronRight,
  Contrast,
  Folder,
  Moon,
  Refresh,
  Sun,
} from '@vellira-ui/icons';
import { Switch, useTheme } from '@vellira-ui/react-native';
import { Pressable, Text, TextInput, View } from 'react-native';

type WorkspaceSettingsProps = {
  workspaceName: string;
  onWorkspaceNameChange: (name: string) => void;
  notifications: boolean;
  onNotificationsChange: (checked: boolean) => void;
  onRestore: () => void;
};

const appearances = [
  { key: 'light', label: 'Light', caption: 'Bright and clear', Icon: Sun },
  { key: 'dark', label: 'Dark', caption: 'Comfortable at night', Icon: Moon },
  {
    key: 'highContrast',
    label: 'High contrast',
    caption: 'Stronger text and borders',
    Icon: Contrast,
  },
] as const;

/** A grouped mobile settings screen; values and persistence stay in App. */
export function WorkspaceSettings({
  workspaceName,
  onWorkspaceNameChange,
  notifications,
  onNotificationsChange,
  onRestore,
}: WorkspaceSettingsProps) {
  const { theme, themeName, setTheme } = useTheme();
  const primary = theme.semantic.text.primary;
  const secondary = theme.semantic.text.secondary;
  const muted = theme.semantic.text.subtle;
  const border = theme.semantic.border.muted;
  const accent = theme.semantic.text.interactive;
  const selected = theme.components.select.primary.outline.option.selected;
  const panel = {
    backgroundColor: theme.semantic.surface.panel,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 22,
    overflow: 'hidden' as const,
  };
  const sectionLabel = {
    color: muted,
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.9,
    paddingHorizontal: 6,
  };
  const iconTile = {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.semantic.surface.muted,
  };
  const appearanceTotal = appearances.length;

  return (
    <View
      style={{
        width: '100%',
        maxWidth: 560,
        alignSelf: 'center',
        gap: 22,
        paddingBottom: 14,
      }}
    >
      <View style={{ gap: 10 }}>
        <Text
          maxFontSizeMultiplier={1.6}
          accessibilityRole='header'
          style={sectionLabel}
        >
          WORKSPACE
        </Text>
        <View style={[panel, { padding: 16, gap: 10 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={iconTile} accessible={false}>
              <Folder size={19} color={accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                maxFontSizeMultiplier={1.6}
                style={{ color: primary, fontSize: 15, fontWeight: '600' }}
              >
                Your workspace
              </Text>
              <Text
                maxFontSizeMultiplier={1.6}
                style={{ color: secondary, fontSize: 12 }}
              >
                Name shown across the dashboard
              </Text>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text
              maxFontSizeMultiplier={1.5}
              style={{ color: primary, fontSize: 14, fontWeight: '600' }}
            >
              Workspace name
            </Text>
            <TextInput
              accessibilityLabel='Workspace name'
              value={workspaceName}
              onChangeText={onWorkspaceNameChange}
              placeholder='Name your workspace'
              placeholderTextColor={muted}
              maxFontSizeMultiplier={1.5}
              style={{
                minHeight: 48,
                borderWidth: 1,
                borderColor: border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 8,
                fontSize: 15,
                color: primary,
                backgroundColor: theme.semantic.surface.canvas,
                textAlignVertical: 'center',
              }}
            />
          </View>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Text
          maxFontSizeMultiplier={1.6}
          accessibilityRole='header'
          style={sectionLabel}
        >
          APPEARANCE
        </Text>
        <View style={panel}>
          {appearances.map(({ key, label, caption, Icon }, index) => {
            const active = themeName === key;
            return (
              <View key={key}>
                <Pressable
                  accessibilityRole='radio'
                  accessibilityLabel={label}
                  accessibilityHint={caption}
                  accessibilityState={{ checked: active }}
                  onPress={() => setTheme(key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 68,
                    paddingVertical: 11,
                    paddingHorizontal: 14,
                    gap: 12,
                    backgroundColor: active
                      ? selected.bg
                      : theme.semantic.surface.panel,
                  }}
                >
                  <View style={iconTile} accessible={false}>
                    <Icon size={19} color={active ? selected.fg : secondary} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      maxFontSizeMultiplier={1.6}
                      style={{
                        fontSize: 15,
                        fontWeight: active ? '700' : '500',
                        color: active ? selected.fg : primary,
                      }}
                    >
                      {label}
                    </Text>
                    <Text
                      maxFontSizeMultiplier={1.6}
                      style={{ color: secondary, fontSize: 12 }}
                    >
                      {caption}
                    </Text>
                  </View>
                  {active ? <Check size={19} color={selected.fg} /> : null}
                </Pressable>
                {index < appearanceTotal - 1 ? (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: border,
                      marginLeft: 62,
                    }}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Text
          maxFontSizeMultiplier={1.6}
          accessibilityRole='header'
          style={sectionLabel}
        >
          PREFERENCES
        </Text>
        <View
          style={[
            panel,
            {
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 76,
              paddingHorizontal: 14,
              paddingVertical: 14,
              gap: 12,
            },
          ]}
        >
          <View style={iconTile} accessible={false}>
            <Bell size={19} color={accent} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              maxFontSizeMultiplier={1.6}
              style={{ color: primary, fontSize: 15, fontWeight: '600' }}
            >
              Product notifications
            </Text>
            <Text
              maxFontSizeMultiplier={1.6}
              style={{ color: secondary, fontSize: 12 }}
            >
              Stored locally. No emails are sent.
            </Text>
          </View>
          <Switch
            accessibilityLabel='Product notifications'
            checked={notifications}
            onCheckedChange={onNotificationsChange}
          />
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Text
          maxFontSizeMultiplier={1.6}
          accessibilityRole='header'
          style={sectionLabel}
        >
          DATA
        </Text>
        <View style={panel}>
          <Pressable
            accessibilityRole='button'
            accessibilityLabel='Restore sample data'
            accessibilityHint='Opens a confirmation before replacing saved data'
            onPress={onRestore}
            style={{
              minHeight: 72,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}
          >
            <View
              style={[
                iconTile,
                { backgroundColor: theme.semantic.status.error.bg },
              ]}
              accessible={false}
            >
              <Refresh size={19} color={theme.semantic.status.error.fg} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text
                maxFontSizeMultiplier={1.6}
                style={{
                  color: theme.semantic.status.error.fg,
                  fontSize: 15,
                  fontWeight: '600',
                }}
              >
                Restore sample data
              </Text>
              <Text
                maxFontSizeMultiplier={1.6}
                style={{ color: secondary, fontSize: 12 }}
              >
                Replaces saved demo projects and settings
              </Text>
            </View>
            <ChevronRight size={18} color={muted} />
          </Pressable>
        </View>
      </View>

      <View style={{ alignItems: 'center', gap: 4, paddingTop: 2 }}>
        <Text
          maxFontSizeMultiplier={1.6}
          style={{ color: secondary, fontSize: 12 }}
        >
          Vellira Native Starter
        </Text>
        <Text
          maxFontSizeMultiplier={1.6}
          style={{ color: muted, fontSize: 11 }}
        >
          Offline demo · Settings saved on this device
        </Text>
      </View>
    </View>
  );
}
