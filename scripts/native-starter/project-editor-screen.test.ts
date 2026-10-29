import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../examples/workspace-starter/native/App.tsx', import.meta.url),
  'utf8'
);

describe('Native Starter project editor navigation', () => {
  const editorStart = source.indexOf('      {createOpen ? (');
  const editorEnd = source.indexOf('\n      ) : null}', editorStart);
  const editor = source.slice(editorStart, editorEnd);

  it('renders a near-fullscreen frosted panel over the existing workspace', () => {
    expect(editorStart).toBeGreaterThan(0);
    expect(editorEnd).toBeGreaterThan(editorStart);
    expect(source).not.toContain('open={createOpen}');
    expect(source).not.toContain('  if (createOpen) {');
    expect(editor).toContain('StyleSheet.absoluteFill');
    expect(editor).toContain('<BlurView');
    expect(editor).toContain('intensity={25}');
    expect(editor).toContain('systemUltraThinMaterialLight');
    expect(editor).toContain('systemUltraThinMaterialDark');
    expect(editor).toContain('rgba(255, 255, 255, 0.75)');
    expect(editor).toContain('shadowRadius: 24');
    expect(editor).toContain('borderTopLeftRadius: 34');
    expect(editor).toContain('borderTopRightRadius: 34');
    expect(editor).toContain("themeName !== 'highContrast'");
    expect(editor).not.toContain('<Modal');
    expect(editor).not.toContain("accessibilityRole='tablist'");
    expect(source).toContain(
      'accessibilityElementsHidden={createOpen || resetOpen}'
    );
    expect(source).toContain(
      "pointerEvents={createOpen || resetOpen ? 'none' : 'auto'}"
    );
    expect(source).toContain('{resetOpen ? (');
  });

  it('stays full-width below the system safe area', () => {
    expect(source).toContain('useSafeAreaInsets');
    expect(source).toContain('useWindowDimensions');
    expect(editor).toContain('paddingTop: insets.top + 8');
    expect(editor).toContain('marginHorizontal: 0');
    expect(editor).toContain('marginTop: 0');
    expect(editor).toContain('borderTopLeftRadius: 34');
    expect(editor).toContain('borderTopRightRadius: 34');
  });

  it('keeps released Select sheets compact without a fixed height', () => {
    const manifestFile = new URL(
      '../../examples/workspace-starter/native/package.json',
      import.meta.url
    );
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    expect(manifest.dependencies['@vellira-ui/react-native']).toBe('2.188.3');
    expect(editor.match(/presentation='sheet'/g)).toHaveLength(2);
    expect(editor.match(/contentStyle={compactSheetStyle}/g)).toHaveLength(2);
    expect(source).toContain('const compactSheetMaxHeight = Math.min(');
    expect(source).toContain('windowHeight * 0.74');
    expect(source).toContain('Math.max(1, fontScale)');
    expect(source).toContain('maxHeight: compactSheetMaxHeight');
    expect(source).not.toContain('height: compactSheetMaxHeight');
  });

  it('provides top navigation with Close and Create/Save actions', () => {
    expect(editor).toContain("accessibilityLabel='Close project editor'");
    expect(editor).toContain('onPress={saveProject}');
    expect(source).toContain("isEditing ? 'Save' : 'Create'");
    expect(editor).toContain("isEditing ? 'Edit project' : 'New project'");
    expect(editor).toContain('setCreateOpen(false)');
  });

  it('opens Team and Status choices in bottom sheets, not centered modals', () => {
    expect(editor.match(/presentation='sheet'/g)).toHaveLength(2);
    expect(editor).not.toContain("presentation='modal'");
  });

  it('centers both single-line Input fields without overriding the library globally', () => {
    expect(editor.match(/inputStyle={editorInputStyle}/g)).toHaveLength(2);
    expect(source).toContain("textAlignVertical: 'center' as const");
    expect(source).toContain('lineHeight: undefined');
    expect(source).toContain('paddingVertical: 0');
  });

  it('disables Create/Save until the required fields are valid', () => {
    expect(editor).toContain('disabled={!canSubmitProject}');
    expect(editor).toContain(
      'accessibilityState={{ disabled: !canSubmitProject }}'
    );
    expect(editor).toContain('backgroundColor: canSubmitProject');
    expect(source).toContain('if (!canSubmitProject) return;');
    for (const label of ['Project name', 'Team', 'Status']) {
      expect(editor).toMatch(new RegExp(`label='${label}'\\s+required`));
    }
  });

  it('preserves a scrollable keyboard-safe editor and field validation', () => {
    expect(editor).toContain('<KeyboardAvoidingView');
    expect(editor).toContain("keyboardShouldPersistTaps='handled'");
    for (const label of [
      "label='Project name'",
      "label='Description'",
      "label='Team'",
      "label='Status'",
    ]) {
      expect(editor).toContain(label);
    }
    expect(editor).toContain('error={error || undefined}');
    expect(source).toContain("setSection('projects')");
    expect(source).toContain('setNotice(');
  });
});

describe('Native Starter project status badges', () => {
  it('gives Planned a legible opaque high-contrast badge', () => {
    expect(source).toMatch(/themeName === 'highContrast'\s*\?\s*'#FFFFFF'/);
    expect(source).toMatch(/themeName === 'highContrast'\s*\?\s*'#1A102B'/);
    expect(source).toContain(
      "borderWidth: themeName === 'highContrast' ? 1 : 0"
    );
  });
});

describe('Native Starter dashboard metric contrast', () => {
  it('uses dark high-contrast metric surfaces with bright borders and readable text', () => {
    expect(source).toContain(
      "bg: themeName === 'highContrast' ? '#1C2736' : palette.brandBg"
    );
    expect(source).toContain(
      "bg: themeName === 'highContrast' ? '#1C2736' : palette.successBg"
    );
    expect(source).toContain(
      "outline: themeName === 'highContrast' ? '#A77BFF' : palette.brandBorder"
    );
    expect(source).toContain(
      "outline: themeName === 'highContrast' ? '#30D5A0' : palette.successBorder"
    );
    expect(source).toContain(
      "accent: themeName === 'highContrast' ? '#C5A8FF' : palette.brand"
    );
    expect(source).toContain(
      "accent: themeName === 'highContrast' ? '#6BF2BF' : palette.success"
    );
    expect(source).toContain(
      "color: themeName === 'highContrast' ? '#FFFFFF' : mainText"
    );
    expect(source).toContain(
      "color: themeName === 'highContrast' ? '#D6E0ED' : subtleText"
    );
    expect(source).toContain('backgroundColor: metric.bg');
  });
});
