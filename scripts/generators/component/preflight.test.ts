import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createComponentGenerationPlan } from './plan';
import { validateComponentGenerationPlan } from './preflight';

const tempRoots: string[] = [];

function createTempRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-component-generator-')
  );

  tempRoots.push(root);

  return root;
}

function createLayerBarrels(
  root: string,
  layer: 'primitives' | 'components' | 'patterns' = 'primitives'
) {
  for (const packageName of ['react', 'react-native']) {
    const layerDir = path.join(root, 'packages', packageName, 'src', layer);

    fs.mkdirSync(layerDir, { recursive: true });
    fs.writeFileSync(path.join(layerDir, 'index.ts'), '');
  }

  const sharedTypesDir = path.join(root, 'packages', 'types', 'src');

  fs.mkdirSync(sharedTypesDir, { recursive: true });
  fs.writeFileSync(path.join(sharedTypesDir, 'index.ts'), '');

  const metadataDir = path.join(
    root,
    'packages',
    'metadata',
    'src',
    'components'
  );

  fs.mkdirSync(metadataDir, { recursive: true });
  fs.writeFileSync(
    path.join(metadataDir, 'index.ts'),
    `export const componentMetadata = [
] as const;
`
  );

  const docsContractDir = path.join(
    root,
    'apps',
    'docs',
    'src',
    'component-docs'
  );

  fs.mkdirSync(docsContractDir, { recursive: true });
  fs.writeFileSync(
    path.join(docsContractDir, 'index.ts'),
    `export const componentDocsContracts = [
] as const;
`
  );
}

function createIconRegistry(
  root: string,
  platform: 'react' | 'react-native',
  icons: readonly string[] = ['ChevronDown', 'Close']
) {
  const fileName = platform === 'react' ? 'web.source.ts' : 'native.source.ts';
  const iconDir = path.join(root, 'packages', 'icons', 'src');

  fs.mkdirSync(iconDir, { recursive: true });
  fs.writeFileSync(
    path.join(iconDir, fileName),
    icons
      .map(
        (icon) => `export { default as ${icon} } from './generated/${icon}';`
      )
      .join('\n') + '\n'
  );
}

function createTokenRegistry(
  root: string,
  tokens: readonly string[] = ['semantic.text.primary']
) {
  const tokenDir = path.join(root, 'packages', 'tokens', 'src', 'generated');

  fs.mkdirSync(tokenDir, { recursive: true });
  fs.writeFileSync(
    path.join(tokenDir, 'token-types.ts'),
    `export const tokenPaths = [
${tokens.map((token) => `  '${token}',`).join('\n')}
] as const;
`
  );
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('component generator preflight', () => {
  it('accepts a clean generation plan', () => {
    const root = createTempRoot();
    createLayerBarrels(root);

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Avatar',
        platform: 'both',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        parts: [],
        force: false,
      },
    });

    expect(validateComponentGenerationPlan(plan)).toEqual({
      ok: true,
      existingTargets: [],
    });
  });

  it('accepts an existing canonical Web icon requirement', () => {
    const root = createTempRoot();
    createLayerBarrels(root);
    createIconRegistry(root, 'react');

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Tooltip',
        platform: 'web',
        layer: 'primitives',
        category: 'overlay',
        profile: 'base',
        icons: [{ name: 'ChevronDown', purpose: 'disclosure indicator' }],
        parts: [],
        force: false,
      },
    });

    expect(validateComponentGenerationPlan(plan)).toEqual({
      ok: true,
      existingTargets: [],
    });
  });

  it('accepts an existing canonical Native icon requirement', () => {
    const root = createTempRoot();
    createLayerBarrels(root);
    createIconRegistry(root, 'react-native');

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Tooltip',
        platform: 'native',
        layer: 'primitives',
        category: 'overlay',
        profile: 'base',
        icons: [{ name: 'Close', purpose: 'dismiss action' }],
        parts: [],
        force: false,
      },
    });

    expect(validateComponentGenerationPlan(plan)).toEqual({
      ok: true,
      existingTargets: [],
    });
  });

  it('requires cross-platform icons to exist in both registries', () => {
    const root = createTempRoot();
    createLayerBarrels(root);
    createIconRegistry(root, 'react');
    createIconRegistry(root, 'react-native', ['Close']);

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Tooltip',
        platform: 'both',
        layer: 'primitives',
        category: 'overlay',
        profile: 'base',
        icons: [{ name: 'ChevronDown', purpose: 'disclosure indicator' }],
        parts: [],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.join('\n')).toContain(
        'missing-icon-resource: name="ChevronDown" purpose="disclosure indicator" platform="react-native"'
      );
    }
  });

  it('fails closed for missing icon resources', () => {
    const root = createTempRoot();
    createLayerBarrels(root);
    createIconRegistry(root, 'react');

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Tooltip',
        platform: 'web',
        layer: 'primitives',
        category: 'overlay',
        profile: 'base',
        icons: [{ name: 'MissingIcon', purpose: 'missing affordance' }],
        parts: [],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContain(
        'missing-icon-resource: name="MissingIcon" purpose="missing affordance" platform="react" — expected canonical export from @vellira-ui/icons'
      );
    }
  });

  it('fails closed for a missing icon registry', () => {
    const root = createTempRoot();
    createLayerBarrels(root);

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Tooltip',
        platform: 'web',
        layer: 'primitives',
        category: 'overlay',
        profile: 'base',
        icons: [{ name: 'ChevronDown', purpose: 'disclosure indicator' }],
        parts: [],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.join('\n')).toContain(
        'missing-icon-resource-registry: component="Tooltip" platform="react"'
      );
    }
  });

  it('accepts an existing canonical token requirement', () => {
    const root = createTempRoot();
    createLayerBarrels(root);
    createTokenRegistry(root);

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Tooltip',
        platform: 'web',
        layer: 'primitives',
        category: 'overlay',
        profile: 'base',
        tokens: ['semantic.text.primary'],
        parts: [],
        force: false,
      },
    });

    expect(validateComponentGenerationPlan(plan)).toEqual({
      ok: true,
      existingTargets: [],
    });
  });

  it('fails closed for missing token requirements', () => {
    const root = createTempRoot();
    createLayerBarrels(root);
    createTokenRegistry(root);

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Tooltip',
        platform: 'web',
        layer: 'primitives',
        category: 'overlay',
        profile: 'base',
        tokens: ['semantic.text.missing'],
        parts: [],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContain(
        'missing-design-token: path="semantic.text.missing" component="Tooltip" part="component" platform="react" — expected canonical token path in @vellira-ui/tokens'
      );
    }
  });

  it('fails closed for a missing token registry', () => {
    const root = createTempRoot();
    createLayerBarrels(root);

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Tooltip',
        platform: 'web',
        layer: 'primitives',
        category: 'overlay',
        profile: 'base',
        tokens: ['semantic.text.primary'],
        parts: [],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.join('\n')).toContain(
        'missing-design-token-registry: component="Tooltip"'
      );
    }
  });

  it('rejects an existing target without --force', () => {
    const root = createTempRoot();
    createLayerBarrels(root);

    const existingDir = path.join(root, 'packages/react/src/primitives/Avatar');

    fs.mkdirSync(existingDir, { recursive: true });

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Avatar',
        platform: 'both',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        parts: [],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.join('\n')).toContain(
        'Use --force to overwrite existing component files.'
      );
    }
  });

  it('accepts an existing target with --force', () => {
    const root = createTempRoot();
    createLayerBarrels(root);

    const existingDir = path.join(root, 'packages/react/src/primitives/Avatar');

    fs.mkdirSync(existingDir, { recursive: true });

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

    const result = validateComponentGenerationPlan(plan);

    expect(result).toEqual({
      ok: true,
      existingTargets: [existingDir],
    });
  });

  it('rejects missing layer barrels before writing anything', () => {
    const root = createTempRoot();

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Avatar',
        platform: 'both',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        parts: [],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContain(
        `Missing layer barrel file: ${plan.targets[0]?.barrelFile}`
      );

      expect(result.errors).toContain(
        `Missing layer barrel file: ${plan.targets[1]?.barrelFile}`
      );

      expect(result.errors).toContain(
        `Missing metadata barrel file: ${plan.metadataBarrelFile}`
      );
    }
  });

  it('rejects existing metadata without --force', () => {
    const root = createTempRoot();
    createLayerBarrels(root);

    const metadataFile = path.join(
      root,
      'packages/metadata/src/components/Avatar.metadata.ts'
    );

    fs.writeFileSync(metadataFile, '');

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Avatar',
        platform: 'both',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        parts: [],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.join('\n')).toContain(metadataFile);
      expect(result.errors.join('\n')).toContain(
        'Use --force to overwrite existing component files.'
      );
    }
  });

  it('rejects a missing metadata barrel before writing anything', () => {
    const root = createTempRoot();

    for (const packageName of ['react', 'react-native']) {
      const layerDir = path.join(
        root,
        'packages',
        packageName,
        'src',
        'primitives'
      );

      fs.mkdirSync(layerDir, { recursive: true });
      fs.writeFileSync(path.join(layerDir, 'index.ts'), '');
    }

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Avatar',
        platform: 'both',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        parts: [],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContain(
        `Missing metadata barrel file: ${plan.metadataBarrelFile}`
      );
    }
  });

  it('does not treat token files as generator-owned targets for explicit tokenless intent', () => {
    const root = createTempRoot();
    createLayerBarrels(root, 'components');

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Accordion',
        platform: 'both',
        layer: 'components',
        category: 'navigation',
        profile: 'compound',
        componentTokens: false,
        parts: ['Root', 'Item', 'Trigger', 'Content'],
        force: false,
      },
    });

    fs.mkdirSync(path.dirname(plan.tokenFactoryFile), { recursive: true });
    fs.writeFileSync(plan.tokenFactoryFile, 'hand-authored token factory');

    for (const tokenTarget of plan.tokenThemeTargets) {
      fs.mkdirSync(path.dirname(tokenTarget.componentFile), {
        recursive: true,
      });
      fs.writeFileSync(tokenTarget.componentFile, 'hand-authored tokens');
    }

    expect(validateComponentGenerationPlan(plan)).toEqual({
      ok: true,
      existingTargets: [],
    });
  });

  it('still treats token files as generator-owned targets for base profiles', () => {
    const root = createTempRoot();
    createLayerBarrels(root);

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Avatar',
        platform: 'both',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        parts: [],
        force: false,
      },
    });

    fs.mkdirSync(path.dirname(plan.tokenFactoryFile), { recursive: true });
    fs.writeFileSync(plan.tokenFactoryFile, 'existing generated token factory');

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.join('\n')).toContain(plan.tokenFactoryFile);
      expect(result.errors.join('\n')).toContain(
        'Use --force to overwrite existing component files.'
      );
    }
  });

  it('rejects compound components without a Root part', () => {
    const root = createTempRoot();

    createLayerBarrels(root, 'components');

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Tabs',
        platform: 'web',
        layer: 'components',
        category: 'navigation',
        profile: 'compound',
        parts: ['List', 'Trigger', 'Content'],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContain(
        'Component profile "compound" requires a Root part when parts are provided.'
      );
    }
  });

  it('rejects parts for non-compound profiles', () => {
    const root = createTempRoot();

    createLayerBarrels(root, 'primitives');

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        parts: ['Root', 'Image'],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContain(
        'Component parts are not supported by the base profile.'
      );
    }
  });

  it('allows parts for overlay profiles', () => {
    const root = createTempRoot();

    createLayerBarrels(root, 'components');

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Popover',
        platform: 'both',
        layer: 'components',
        category: 'overlay',
        profile: 'overlay',
        parts: ['Root', 'Trigger', 'Content'],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(true);
  });

  it('rejects a metadata barrel without the componentMetadata registry', () => {
    const root = createTempRoot();

    createLayerBarrels(root);

    const metadataBarrelFile = path.join(
      root,
      'packages',
      'metadata',
      'src',
      'components',
      'index.ts'
    );

    fs.writeFileSync(metadataBarrelFile, `export const somethingElse = [];\n`);

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Avatar',
        platform: 'both',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        parts: [],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContain(
        `Missing componentMetadata registry in ${plan.metadataBarrelFile}`
      );
    }
  });

  it('rejects an invalid componentMetadata registry', () => {
    const root = createTempRoot();

    createLayerBarrels(root);

    const metadataBarrelFile = path.join(
      root,
      'packages',
      'metadata',
      'src',
      'components',
      'index.ts'
    );

    fs.writeFileSync(
      metadataBarrelFile,
      `export const componentMetadata = [
`
    );

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Avatar',
        platform: 'both',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        parts: [],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContain(
        `Invalid componentMetadata registry in ${plan.metadataBarrelFile}`
      );
    }
  });

  it('rejects conflicting metadata registration before writing anything', () => {
    const root = createTempRoot();

    createLayerBarrels(root);

    const metadataBarrelFile = path.join(
      root,
      'packages',
      'metadata',
      'src',
      'components',
      'index.ts'
    );

    fs.writeFileSync(
      metadataBarrelFile,
      `import { avatarMetadata } from './Avatar.metadata';

export const componentMetadata = [
  avatarMetadata,
] as const;
`
    );

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Avatar',
        platform: 'both',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        parts: [],
        force: false,
      },
    });

    const result = validateComponentGenerationPlan(plan);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContain(
        `Conflicting metadata registration for Avatar in ${plan.metadataBarrelFile}`
      );
    }

    expect(fs.existsSync(plan.metadataFile)).toBe(false);

    for (const target of plan.targets) {
      expect(fs.existsSync(target.componentDir)).toBe(false);
    }
  });
});

describe('component-token preflight parity', () => {
  it.each([
    ['compound', 'DisclosureProbe', ['Root', 'Trigger', 'Content']],
    ['overlay', 'OverlayProbe', ['Root', 'Trigger', 'Content']],
  ] as const)(
    'detects token targets for %s profiles independently of visual scaffold',
    (profile, componentName, parts) => {
      const root = createTempRoot();
      createLayerBarrels(root, 'components');

      const plan = createComponentGenerationPlan({
        root,
        options: {
          componentName,
          platform: 'both',
          layer: 'components',
          category: profile === 'overlay' ? 'overlay' : 'navigation',
          profile,
          parts,
          force: false,
        },
      });

      fs.mkdirSync(path.dirname(plan.tokenFactoryFile), { recursive: true });
      fs.writeFileSync(plan.tokenFactoryFile, 'existing token contract\n');

      const result = validateComponentGenerationPlan(plan);

      expect(result.ok).toBe(false);

      if (!result.ok) {
        expect(result.errors.join('\n')).toContain(plan.tokenFactoryFile);
      }
    }
  );
});
