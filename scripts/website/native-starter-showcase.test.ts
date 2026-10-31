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
const next = read('apps/website/next.config.ts');
const safeArea = read(
  'apps/website/src/sections/home/ProductInterfaceDemo/native-web-adapters/SafeArea.tsx'
);
const blurAdapter = read(
  'apps/website/src/sections/home/ProductInterfaceDemo/native-web-adapters/ExpoBlur.tsx'
);
const storage = read(
  'apps/website/src/sections/home/ProductInterfaceDemo/native-web-adapters/AsyncStorage.ts'
);

describe('Website Native Starter showcase', () => {
  it('switches mobile platform preview away from the React Web iframe', () => {
    expect(website).toContain('<NativeStarterPreview />');
    expect(website).toContain("import('./NativeStarterPreview')");
    expect(website).not.toContain("src='/demo/dashboard'");
    expect(website).not.toContain('Responsive Web preview');
    expect(website).toContain(
      "href={preview === 'mobile' ? nativeSourceUrl : sourceUrl}"
    );
    expect(website).toContain('Setup instructions ↗');
  });

  it('renders the maintained Expo Starter App instead of inventing another UI', () => {
    expect(preview).toContain(
      "import('../../../../../../examples/workspace-starter/native/App')"
    );
    expect(preview).toContain('<StarterApp />');
    expect(preview).toContain("data-testid='native-starter-preview'");
    expect(preview).not.toContain('seedProjects');
    expect(preview).not.toContain('setProjects(');
    expect(preview).not.toContain('function ProjectCard');
    expect(website).toContain('React Native Web');
  });

  it('provides browser shims while leaving the canonical Expo app untouched', () => {
    expect(next).toContain("'react-native': 'react-native-web'");
    expect(next).toContain("'expo-blur': nativeAdapter('ExpoBlur.tsx')");
    expect(next).toContain(
      "'react-native-safe-area-context': nativeAdapter('SafeArea.tsx')"
    );
    expect(next).toContain(
      "'@react-native-async-storage/async-storage': nativeAdapter('AsyncStorage.ts')"
    );
    expect(safeArea).toContain('useSafeAreaInsets');
    expect(blurAdapter).toContain('type BlurViewProps = ViewProps & {');
    expect(blurAdapter).toContain('pointerEvents={pointerEvents}');
    expect(storage).toContain("window.localStorage.getItem(keyFor(key))");
    expect(storage).toContain("window.localStorage.setItem(keyFor(key), value)");
  });

  it('inherits the actual three-project Native Starter and its UX behaviors', () => {
    for (const title of [
      'Design token refresh',
      'Mobile onboarding',
      'Dashboard rollout',
    ]) {
      expect(native).toContain(title);
    }
    expect(native).toContain("name: 'Demo Workspace'");
    expect(native).toContain('Your projects at a glance');
    expect(native).toContain('Project progress');
    expect(native).toContain('Projects by status');
    expect(native).toContain('nextUniqueDuplicateName');
    expect(native).toContain("accessibilityLabel={'Actions for ' + project.name}");
    expect(native).toContain('setResetOpen(true)');
    expect(native).toContain("themeName === 'highContrast'");
  });
});
