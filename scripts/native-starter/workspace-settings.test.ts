import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(
  new URL('../../examples/workspace-starter/native/App.tsx', import.meta.url),
  'utf8'
);
const settings = readFileSync(
  new URL(
    '../../examples/workspace-starter/native/WorkspaceSettings.tsx',
    import.meta.url
  ),
  'utf8'
);

describe('Native Starter grouped Settings UX', () => {
  it('renders grouped settings in the existing tab', () => {
    expect(app).toContain("section === 'settings' ? (");
    expect(app).toContain('<WorkspaceSettings');
    expect(settings).toContain('maxWidth: 560');
    expect(settings).toContain('borderRadius: 22');
    expect(settings).toContain('theme.semantic.surface.panel');
    for (const group of [
      'WORKSPACE',
      'APPEARANCE',
      'PREFERENCES',
      'DATA',
    ]) {
      expect(settings).toContain(group);
    }
  });

  it('preserves editing of locally persisted workspace details', () => {
    expect(settings).toContain("label='Workspace name'");
    expect(settings).toContain('value={workspaceName}');
    expect(settings).toContain('onValueChange={onWorkspaceNameChange}');
    expect(app).toContain('workspaceName={data.name}');
    expect(app).toContain('...current, name: next');
  });

  it('uses accessible controls for all three theme variants', () => {
    expect(settings).toContain("key: 'light'");
    expect(settings).toContain("key: 'dark'");
    expect(settings).toContain("key: 'highContrast'");
    expect(settings).toContain("accessibilityRole='radio'");
    expect(settings).toContain('accessibilityState={{ checked: active }}');
    expect(settings).toContain('onPress={() => setTheme(key)}');
    expect(settings).toContain('theme.components.select.primary');
  });

  it('uses the published Vellira Switch for local notifications', () => {
    expect(settings).toContain('<Switch');
    expect(settings).toContain("accessibilityLabel='Product notifications'");
    expect(settings).toContain('checked={notifications}');
    expect(settings).toContain('onCheckedChange={onNotificationsChange}');
    expect(app).toContain('notifications={data.notifications}');
    expect(app).toContain('...current, notifications');
  });

  it('keeps the restore confirmation instead of deleting data directly', () => {
    expect(settings).toContain("accessibilityLabel='Restore sample data'");
    expect(settings).toContain('onPress={onRestore}');
    expect(app).toContain('onRestore={() => setResetOpen(true)}');
    expect(app).toContain('<Modal open={resetOpen}');
    expect(app).toContain('setData(initialWorkspace)');
    expect(settings).toContain('theme.semantic.status.error.fg');
  });

  it('preserves small-screen layout and theme token colors', () => {
    expect(settings).toContain("width: '100%'");
    expect(settings).toContain("alignSelf: 'center'");
    expect(settings).toContain('flex: 1');
    expect(settings).toContain('theme.semantic.text.secondary');
    expect(settings).toContain('theme.semantic.border.muted');
  });
});
