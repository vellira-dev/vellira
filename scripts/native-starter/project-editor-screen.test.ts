import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../examples/workspace-starter/native/App.tsx', import.meta.url),
  'utf8'
);

describe('Native Starter project editor navigation', () => {
  const editorStart = source.indexOf('  if (createOpen) {');
  const workspaceStart = source.indexOf(
    '  return (\n    <SafeAreaView',
    editorStart + 1
  );
  const editor = source.slice(editorStart, workspaceStart);

  it('replaces the workspace instead of opening a project dialog', () => {
    expect(editorStart).toBeGreaterThan(0);
    expect(workspaceStart).toBeGreaterThan(editorStart);
    expect(source).not.toContain('open={createOpen}');
    expect(editor).toContain('<SafeAreaView');
    expect(editor).not.toContain('<Modal');
    expect(editor).not.toContain("accessibilityRole='tablist'");
    expect(source).toContain('<Modal open={resetOpen}');
  });

  it('provides top navigation with Close and Create/Save actions', () => {
    expect(editor).toContain("accessibilityLabel='Close project editor'");
    expect(editor).toContain('onPress={saveProject}');
    expect(editor).toContain("isEditing ? 'Save' : 'Create'");
    expect(editor).toContain("isEditing ? 'Edit project' : 'New project'");
    expect(editor).toContain('setCreateOpen(false)');
  });

  it('opens Team and Status choices in bottom sheets, not centered modals', () => {
    expect(editor.match(/presentation='sheet'/g)).toHaveLength(2);
    expect(editor).not.toContain("presentation='modal'");
  });

  it('centers both single-line Input fields without overriding the library globally', () => {
    expect(editor.match(/inputStyle={editorInputStyle}/g)).toHaveLength(2);
    expect(editor).toContain("textAlignVertical: 'center' as const");
    expect(editor).toContain('lineHeight: undefined');
    expect(editor).toContain('paddingVertical: 0');
  });

  it('disables Create/Save until the required fields are valid', () => {
    expect(editor).toContain('disabled={!canSubmitProject}');
    expect(editor).toContain(
      'accessibilityState={{ disabled: !canSubmitProject }}'
    );
    expect(editor).toContain('canSubmitProject ? palette.brand : surface.subtle');
    expect(source).toContain('if (!canSubmitProject) return;');
    for (const label of ['Project name', 'Team', 'Status']) {
      expect(editor).toContain(`label='${label}'\n                    required`);
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
