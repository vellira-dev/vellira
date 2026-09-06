import { describe, expect, it } from 'vitest';

import { resolvePartTemplates } from './resolve-part-templates';

import type {
  ComponentGenerationPlan,
  ComponentGenerationTarget,
} from './plan';

const plan: ComponentGenerationPlan = {
  root: '/repo',
  componentName: 'Tabs',
  layer: 'components',
  category: 'navigation',
  profile: 'compound',
  control: 'value',
  typeOwnership: 'shared',
  capabilities: [],
  icons: [],
  tokens: [],
  componentTokens: 'standard',
  parts: ['Root', 'Trigger'],
  force: false,
  targets: [],
  sharedTypesFile: '/repo/types/tabs.ts',
  sharedTypesBarrelFile: '/repo/types/index.ts',
  metadataFile: '/repo/metadata.ts',
  metadataBarrelFile: '/repo/metadata/index.ts',
  docsRoot: '/repo/apps/docs/src',
  docsContractFile: '/repo/apps/docs/src/component-docs/Tabs.docs.ts',
  docsContractRegistryFile: '/repo/apps/docs/src/component-docs/index.ts',
  tokenFactoryFile: '/repo/tokens/factories/createTabsTokens.ts',
  tokenFactoryBarrelFile: '/repo/tokens/factories/index.ts',
  tokenThemeTargets: [],
};

const createTarget = (isNative: boolean): ComponentGenerationTarget => ({
  packageName: isNative ? 'react-native' : 'react',
  componentDir: '/repo/Tabs',
  barrelFile: '/repo/index.ts',
  packageBarrelFile: '/repo/package-index.ts',
  publicApiTestFile: '/repo/public-api.test.ts',
  isNative,
});

describe('component part template resolver', () => {
  it('resolves interactive web Trigger templates', () => {
    const result = resolvePartTemplates({
      plan,
      target: createTarget(false),
      partName: 'Trigger',
    });

    expect(result.types).toContain('TabsTriggerProps');
    expect(result.index).toContain("export * from './TabsTrigger'");
    expect(result.component).toContain('export function TabsTrigger');
    expect(result.component).toContain('<button');
  });

  it('resolves native Content templates', () => {
    const result = resolvePartTemplates({
      plan,
      target: createTarget(true),
      partName: 'Content',
    });

    expect(result.component).toContain('export function TabsContent');
    expect(result.component).toContain('<View>');
  });

  it('resolves web overlay part templates', () => {
    const overlayPlan: ComponentGenerationPlan = {
      ...plan,
      componentName: 'Dialog',
      category: 'overlay',
      profile: 'overlay',
      parts: ['Root', 'Trigger', 'Content'],
    };

    const trigger = resolvePartTemplates({
      plan: overlayPlan,
      target: createTarget(false),
      partName: 'Trigger',
    });

    const content = resolvePartTemplates({
      plan: overlayPlan,
      target: createTarget(false),
      partName: 'Content',
    });

    expect(trigger.component).toContain("aria-haspopup='dialog'");
    expect(content.component).toContain("role='dialog'");
    expect(content.component).toContain('tabIndex={-1}');
  });

  it('resolves native overlay part templates', () => {
    const overlayPlan: ComponentGenerationPlan = {
      ...plan,
      componentName: 'Dialog',
      category: 'overlay',
      profile: 'overlay',
      parts: ['Root', 'Trigger', 'Content'],
    };

    const trigger = resolvePartTemplates({
      plan: overlayPlan,
      target: createTarget(true),
      partName: 'Trigger',
    });

    const content = resolvePartTemplates({
      plan: overlayPlan,
      target: createTarget(true),
      partName: 'Content',
    });

    expect(trigger.component).toContain('<Pressable');
    expect(trigger.component).toContain("accessibilityRole='button'");
    expect(content.component).toContain('accessibilityViewIsModal');
    expect(content.component).not.toContain("role='dialog'");
  });
});
