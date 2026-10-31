import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(path), 'utf8');
const native = read('examples/workspace-starter/native/App.tsx');
const preview = read(
  'apps/website/src/sections/home/ProductInterfaceDemo/NativeStarterPreview.tsx'
);
const website = read(
  'apps/website/src/sections/home/ProductInterfaceDemo/ProductInterfaceDemo.tsx'
);

describe('Website Native Starter showcase', () => {
  it('switches mobile platform preview away from the React Web iframe', () => {
    expect(website).toContain('<NativeStarterPreview />');
    expect(website).toContain("import('./NativeStarterPreview')");
    expect(website).not.toContain("src='/demo/dashboard'");
    expect(website).not.toContain('Responsive Web preview');
    expect(website).toContain("href={preview === 'mobile' ? nativeSourceUrl : sourceUrl}");
    expect(website).toContain('Run the actual Native Starter in Expo');
  });

  it('uses real React Native Web primitives with an honest runtime boundary', () => {
    expect(preview).toContain("from 'react-native'");
    expect(preview).toContain("from '@vellira-ui/react-native'");
    expect(preview).toContain('<ScrollView');
    expect(preview).toContain('<Pressable');
    expect(preview).toContain('<Switch');
    expect(preview).toContain("data-testid='native-starter-preview'");
    expect(website).toContain('React Native Web');
    expect(website).toContain('it is not an iOS or');
  });

  it('matches the three published Native Starter seed projects', () => {
    for (const project of [
      'Design token refresh',
      'Mobile onboarding',
      'Dashboard rollout',
    ]) {
      expect(preview).toContain(project);
      expect(native).toContain(project);
    }
    expect(preview).toContain("useState('Demo Workspace')");
    expect(native).toContain("name: 'Demo Workspace'");
    expect(preview).toContain('Your projects at a glance');
    expect(preview).toContain('Project progress');
    expect(preview).toContain('Projects by status');
  });

  it('keeps project and theme interactions local and discoverable', () => {
    expect(preview).toContain("accessibilityLabel='Create project'");
    expect(preview).toContain("accessibilityLabel='Search projects'");
    expect(preview).toContain("accessibilityLabel='Filter projects'");
    expect(preview).toContain("accessibilityLabel={'Actions for ' + project.name}");
    expect(preview).toContain("accessibilityLabel={'Complete ' + project.name}");
    expect(preview).toContain('setProjects(');
    expect(preview).toContain("accessibilityRole='menu'");
    expect(preview).toContain("label: 'Edit'");
    expect(preview).toContain('nextUniqueDuplicateName(');
    expect(preview).toContain("setSection('projects')");
    expect(preview).toContain("accessibilityLabel='Undo project removal'");
    expect(preview).toContain("key: 'highContrast'");
  });
});
