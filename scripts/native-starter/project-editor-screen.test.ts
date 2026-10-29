import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../examples/workspace-starter/native/App.tsx', import.meta.url),
  'utf8'
);

describe('Native Starter project editor navigation', () => {
  const editorStart = source.indexOf('  if (createOpen) {');
  const workspaceStart = source.indexOf("  return (\n    <SafeAreaView", editorStart + 1);
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
    expect(editor).toContain("onPress={saveProject}");
    expect(editor).toContain("isEditing ? 'Save' : 'Create'");
    expect(editor).toContain("isEditing ? 'Edit project' : 'New project'");
    expect(editor).toContain("setCreateOpen(false)");
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
    expect(source).toContain("setNotice(");
  });
});
