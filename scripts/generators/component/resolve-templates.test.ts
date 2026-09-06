import { describe, expect, it } from 'vitest';

import { resolveComponentTemplates } from './resolve-templates';

import type {
  ComponentGenerationPlan,
  ComponentGenerationTarget,
} from './plan';

const createTarget = (isNative: boolean): ComponentGenerationTarget => ({
  packageName: isNative ? 'react-native' : 'react',
  componentDir: '/repo/component',
  barrelFile: '/repo/index.ts',
  packageBarrelFile: '/repo/package-index.ts',
  publicApiTestFile: '/repo/public-api.test.ts',
  isNative,
});

const createPlan = (
  profile: ComponentGenerationPlan['profile'],
  control: ComponentGenerationPlan['control'] = 'value'
): ComponentGenerationPlan => ({
  root: '/repo',
  componentName: 'Example',
  layer: 'components',
  category: 'utility',
  profile,
  control,
  typeOwnership: profile === 'base' ? 'platform' : 'shared',
  capabilities: [],
  icons: [],
  tokens: [],
  componentTokens: 'standard',
  parts: profile === 'compound' ? ['Root', 'Trigger', 'Content'] : [],
  force: false,
  targets: [],
  sharedTypesFile: '/repo/types/example.ts',
  sharedTypesBarrelFile: '/repo/types/index.ts',
  metadataFile: '/repo/metadata.ts',
  metadataBarrelFile: '/repo/metadata/index.ts',
  docsRoot: '/repo/apps/docs/src',
  docsContractFile: '/repo/apps/docs/src/component-docs/Example.docs.ts',
  docsContractRegistryFile: '/repo/apps/docs/src/component-docs/index.ts',
  tokenFactoryFile: '/repo/tokens/factories/createExampleTokens.ts',
  tokenFactoryBarrelFile: '/repo/tokens/factories/index.ts',
  tokenThemeTargets: [],
});

describe('component template resolver', () => {
  it('resolves base web templates', () => {
    const result = resolveComponentTemplates({
      plan: createPlan('base'),
      target: createTarget(false),
    });

    expect(result.component).toContain('<div');
  });

  it('resolves base native templates', () => {
    const result = resolveComponentTemplates({
      plan: createPlan('base'),
      target: createTarget(true),
    });

    expect(result.component).toContain('<View');
  });

  it('preserves value form-control templates by default', () => {
    const result = resolveComponentTemplates({
      plan: createPlan('form-control'),
      target: createTarget(false),
    });

    expect(result.types).toContain(
      "import type { BaseExampleProps } from '@vellira-ui/types';"
    );
    expect(result.types).toContain(
      'export type ExampleProps = BaseExampleProps;'
    );
    expect(result.component).toContain('<button');
  });

  it('resolves boolean form-control templates for Switch-like components', () => {
    const web = resolveComponentTemplates({
      plan: createPlan('form-control', 'boolean'),
      target: createTarget(false),
    });
    const native = resolveComponentTemplates({
      plan: createPlan('form-control', 'boolean'),
      target: createTarget(true),
    });

    expect(web.types).toContain(
      "import type { BaseExampleProps } from '@vellira-ui/types';"
    );
    expect(web.types).toContain('export type ExampleProps = BaseExampleProps;');
    expect(web.component).toContain("role='switch'");
    expect(native.component).toContain("accessibilityRole='switch'");
  });

  it('resolves text form-control templates for multiline controls', () => {
    const web = resolveComponentTemplates({
      plan: createPlan('form-control', 'text'),
      target: createTarget(false),
    });
    const native = resolveComponentTemplates({
      plan: createPlan('form-control', 'text'),
      target: createTarget(true),
    });

    expect(web.component).toContain('<textarea');
    expect(native.component).toContain('<TextInput');
    expect(native.component).toContain('multiline');
  });

  it('resolves compound templates', () => {
    const result = resolveComponentTemplates({
      plan: createPlan('compound'),
      target: createTarget(false),
    });

    expect(result.component).toContain('Object.assign(ExampleRoot');
  });

  it('resolves web overlay templates', () => {
    const result = resolveComponentTemplates({
      plan: createPlan('overlay'),
      target: createTarget(false),
    });

    expect(result.types).toContain('closeOnEscape?: boolean');
    expect(result.types).toContain('closeOnOutsidePress?: boolean');
    expect(result.component).toContain('<div');
    expect(result.component).toContain('closeOnEscape = true');
  });

  it('resolves native overlay templates without browser-only behavior', () => {
    const result = resolveComponentTemplates({
      plan: createPlan('overlay'),
      target: createTarget(true),
    });

    expect(result.types).toContain('closeOnOutsidePress?: boolean');
    expect(result.types).toContain('restoreFocus?: boolean');
    expect(result.types).not.toContain('closeOnEscape');

    expect(result.component).toContain('<View>');
    expect(result.component).not.toContain('closeOnEscape');
  });

  it('composes overlay parts through the root component', () => {
    const overlayPlan: ComponentGenerationPlan = {
      ...createPlan('overlay'),
      parts: ['Root', 'Trigger', 'Content'],
    };

    const web = resolveComponentTemplates({
      plan: overlayPlan,
      target: createTarget(false),
    });

    const native = resolveComponentTemplates({
      plan: overlayPlan,
      target: createTarget(true),
    });

    expect(web.component).toContain(
      'export const Example = Object.assign(ExampleRoot, {'
    );
    expect(web.component).toContain('Trigger: ExampleTrigger');
    expect(web.component).toContain('Content: ExampleContent');

    expect(native.component).toContain(
      'export const Example = Object.assign(ExampleRoot, {'
    );
    expect(native.component).toContain('Trigger: ExampleTrigger');
    expect(native.component).toContain('Content: ExampleContent');
  });

  it('keeps overlays without parts as standalone platform-specific scaffolds', () => {
    const web = resolveComponentTemplates({
      plan: createPlan('overlay'),
      target: createTarget(false),
    });

    const native = resolveComponentTemplates({
      plan: createPlan('overlay'),
      target: createTarget(true),
    });

    expect(web.component).toContain('<div');
    expect(web.component).not.toContain('Object.assign');

    expect(native.component).toContain('<View');
    expect(native.component).not.toContain('Object.assign');
  });
});
