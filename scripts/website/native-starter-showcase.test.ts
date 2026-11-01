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
    expect(website).toContain(
      "import { NativeStarterPreview } from './NativeStarterPreview'"
    );
    expect(website).not.toContain("src='/demo/dashboard'");
    expect(website).not.toContain('Responsive Web preview');
    expect(website).toContain(
      "href={preview === 'mobile' ? nativeSourceUrl : sourceUrl}"
    );
    expect(website).toContain('Setup instructions ↗');
  });

  it('isolates Native Starter portals within the phone iframe', () => {
    const nativeRoute = read(
      'apps/website/src/app/(marketing)/demo/native-starter/page.tsx'
    );
    const routeStyles = read(
      'apps/website/src/app/(marketing)/demo/native-starter/page.module.css'
    );
    expect(preview).toContain("src='/demo/native-starter'");
    expect(preview).toContain("title='Interactive Vellira Native Starter'");
    expect(preview).toContain("data-testid='native-starter-iframe'");
    expect(preview).not.toContain('MutationObserver');
    expect(preview).not.toContain('document.body');
    expect(nativeRoute).toContain(
      "import('@/sections/home/ProductInterfaceDemo/native-starter-source/App')"
    );
    expect(nativeRoute).toContain('<StarterApp />');
    expect(routeStyles).toContain('position: fixed;');
    expect(routeStyles).toContain('inset: 0;');
    expect(routeStyles).toContain('overflow: hidden;');
  });

  it('removes the backing card from the mobile phone preview', () => {
    const stage = read(
      'apps/website/src/sections/home/ProductInterfaceDemo/ProductInterfaceDemo.module.css'
    );
    const mobileCss = stage.slice(stage.indexOf('.mobileStage {'));
    expect(mobileCss).toContain('background: transparent;');
    expect(mobileCss).toContain('border: 0;');
    expect(mobileCss).toContain('box-shadow: none;');
    expect(mobileCss).toContain('overflow: visible;');
    expect(stage).toContain('.nativeStageContent {');
    expect(stage).toContain('.nativeCaption {');
  });

  it('keeps only a compact caption and the setup link under Mobile', () => {
    expect(website).toContain('Browser preview');
    expect(website).toContain('styles.nativeCaption');
    expect(website).toContain('Setup instructions ↗');
    expect(website).not.toContain('It illustrates');
    expect(website).toMatch(
      /\{preview === 'desktop' \? \(\s*<div className=\{styles\.boundary\}>/
    );
    expect(website).toContain('Explore the Pro roadmap');
  });

  it('uses the maintained Expo Starter UI', () => {
    expect(preview).toContain("src='/demo/native-starter'");
    expect(preview).toContain("data-testid='native-starter-preview'");
    expect(preview).not.toContain('seedProjects');
    expect(preview).not.toContain('setProjects(');
    expect(preview).not.toContain('function ProjectCard');
    expect(website).toContain('React Native Starter · rendered in the browser');
  });

  it('uses browser shims without changing Expo', () => {
    expect(next).toContain("'react-native': 'react-native-web'");
    expect(next).not.toContain('nativeWebAdapters');
    expect(safeArea).toContain('useSafeAreaInsets');
    expect(blurAdapter).toContain('type BlurViewProps = ViewProps & {');
    expect(blurAdapter).toContain('pointerEvents={pointerEvents}');
    expect(storage).toContain('window.localStorage.getItem(keyFor(key))');
    expect(storage).toContain(
      'window.localStorage.setItem(keyFor(key), value)'
    );
  });

  it('checks browser source parity with Expo', () => {
    const names = [
      'App.tsx',
      'WorkspaceSettings.tsx',
      'WorkspaceNotice.tsx',
      'projectUx.ts',
    ];
    const sourceHeader =
      '/* Generated from examples/workspace-starter/native by sync-native-starter-preview.mjs. Do not edit. */\n';
    const imports = [
      ["from 'expo-blur'", "from '../native-web-adapters/ExpoBlur'"],
      [
        "from 'react-native-safe-area-context'",
        "from '../native-web-adapters/SafeArea'",
      ],
      [
        "from '@react-native-async-storage/async-storage'",
        "from '../native-web-adapters/AsyncStorage'",
      ],
    ] as const;
    for (const name of names) {
      let canonical = read('examples/workspace-starter/native/' + name);
      if (name === 'App.tsx') {
        for (const [from, to] of imports) {
          expect(canonical.split(from)).toHaveLength(2);
          canonical = canonical.replace(from, to);
        }
      }
      expect(
        read(
          'apps/website/src/sections/home/ProductInterfaceDemo/native-starter-source/' +
            name
        )
      ).toBe(sourceHeader + canonical);
    }
  });

  it('retains the three-project Native Starter UX', () => {
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
    expect(native).toContain(
      "accessibilityLabel={'Actions for ' + project.name}"
    );
    expect(native).toContain('setResetOpen(true)');
    expect(native).toContain("themeName === 'highContrast'");
  });
});
