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
    expect(editor).toContain('borderRadius: 34');
    expect(editor).toContain("themeName !== 'highContrast'");
    expect(editor).not.toContain('<Modal');
    expect(editor).not.toContain("accessibilityRole='tablist'");
    expect(source).toContain('accessibilityElementsHidden={createOpen}');
    expect(source).toContain("pointerEvents={createOpen ? 'none' : 'auto'}");
    expect(source).toContain('<Modal open={resetOpen}');
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

  it('gives both three-option native Select sheets a definite viewport', () => {
    expect(source).toContain('const selectSheetHeight = Math.min(');
    expect(source).toContain('windowHeight - insets.top - insets.bottom - 24');
    const matches = editor.match(/contentStyle={selectSheetContentStyle}/g);
    expect(matches).toHaveLength(2);
    expect(source).toContain('height: selectSheetHeight');
    expect(source).toContain('maxHeight: selectSheetHeight');
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
