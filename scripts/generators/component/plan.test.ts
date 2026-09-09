import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createComponentGenerationPlan } from './plan';

describe('component generation plan', () => {
  const root = '/repo';

  it('creates web target', () => {
    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        parts: [],
        force: false,
      },
    });

    expect(plan.profile).toBe('base');
    expect(plan.targets).toHaveLength(1);
    expect(plan.targets[0]).toEqual({
      packageName: 'react',
      isNative: false,
      componentDir: path.join(root, 'packages/react/src/primitives/Avatar'),
      barrelFile: path.join(root, 'packages/react/src/primitives/index.ts'),
      packageBarrelFile: path.join(root, 'packages/react/src/index.ts'),
      publicApiTestFile: path.join(
        root,
        'packages/react/src/public-api.test.ts'
      ),
    });
  });

  it('creates native target', () => {
    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Avatar',
        platform: 'native',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        parts: [],
        force: false,
      },
    });

    expect(plan.targets).toHaveLength(1);
    expect(plan.targets[0]?.packageName).toBe('react-native');
    expect(plan.targets[0]?.isNative).toBe(true);
  });

  it('creates both targets predictably', () => {
    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Avatar',
        platform: 'both',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        parts: [],
        force: true,
      },
    });

    expect(plan.sharedTypesFile).toBe(
      path.join(root, 'packages/types/src/avatar.ts')
    );

    expect(plan.sharedTypesBarrelFile).toBe(
      path.join(root, 'packages/types/src/index.ts')
    );

    expect(plan.metadataFile).toBe(
      path.join(root, 'packages/metadata/src/components/Avatar.metadata.ts')
    );

    expect(plan.metadataBarrelFile).toBe(
      path.join(root, 'packages/metadata/src/components/index.ts')
    );

    expect(plan.tokenFactoryFile).toBe(
      path.join(
        root,
        'packages/tokens/src/factories/createAvatarTokens.ts'
      )
    );
    expect(plan.tokenFactoryFile).not.toContain('Palette');

    expect(plan.targets.map((target) => target.packageName)).toEqual([
      'react',
      'react-native',
    ]);
    expect(plan.force).toBe(true);
    expect(plan.category).toBe('data-display');
  });

  it('preserves an explicit component profile', () => {
    const root = '/repo';

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Modal',
        platform: 'both',
        layer: 'components',
        category: 'overlay',
        profile: 'overlay',
        parts: [],
        force: false,
      },
    });

    expect(plan.profile).toBe('overlay');
  });

  it('preserves component parts', () => {
    const root = '/repo';

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Tabs',
        platform: 'both',
        layer: 'components',
        category: 'navigation',
        profile: 'compound',
        parts: ['Root', 'List', 'Trigger', 'Content'],
        force: false,
      },
    });

    expect(plan.parts).toEqual(['Root', 'List', 'Trigger', 'Content']);
  });

  it('preserves explicit design-resource requirements', () => {
    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Accordion',
        platform: 'both',
        layer: 'components',
        category: 'navigation',
        profile: 'compound',
        icons: [{ name: 'ChevronDown', purpose: 'disclosure indicator' }],
        tokens: ['semantic.text.primary'],
        parts: ['Root', 'Item', 'Trigger', 'Content'],
        force: false,
      },
    });

    expect(plan.icons).toEqual([
      { name: 'ChevronDown', purpose: 'disclosure indicator' },
    ]);
    expect(plan.tokens).toEqual(['semantic.text.primary']);
  });
});
