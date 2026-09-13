import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import prettier from 'prettier';
import { describe, expect, it } from 'vitest';

import { createComponentGenerationPlan } from './plan';
import { writeComponentGenerationPlan } from './write';

const tempRoots: string[] = [];

function createTempRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-component-writer-')
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

    const sourceRoot = path.join(root, 'packages', packageName, 'src');

    fs.writeFileSync(path.join(sourceRoot, 'index.ts'), '');
    fs.writeFileSync(
      path.join(sourceRoot, 'public-api.test.ts'),
      `import * as api from './index';

expect(Object.keys(api).sort()).toEqual([
      'Button',
    ]);
`
    );
    fs.writeFileSync(path.join(layerDir, 'index.ts'), '');
    fs.writeFileSync(path.join(root, 'packages', packageName, 'API.md'), '');
  }

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
    `export {
  buttonMetadata,
};

export const componentMetadata = [
] as const;
`
  );

  const scriptsDir = path.join(root, 'scripts');

  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(
    path.join(scriptsDir, 'check-public-api.mjs'),
    `const publicSymbolContracts = {
  'packages/react-native/src/index.ts': [
    'Button',
  ],
  'packages/react/src/index.ts': [
    'Button',
  ],
};
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

describe('component generator writer', () => {
  it('writes canonical React and React Native component files', async () => {
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

    const result = await writeComponentGenerationPlan(plan);

    expect(result.createdFiles).toHaveLength(22);

    for (const packageName of ['react', 'react-native']) {
      const componentDir = path.join(
        root,
        'packages',
        packageName,
        'src',
        'primitives',
        'Avatar'
      );

      expect(
        fs.existsSync(
          path.join(root, 'packages/metadata/src/components/Avatar.metadata.ts')
        )
      ).toBe(true);

      expect(fs.existsSync(path.join(componentDir, 'types.ts'))).toBe(true);
      expect(fs.existsSync(path.join(componentDir, 'index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(componentDir, 'Avatar.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(componentDir, 'Avatar.stories.tsx'))).toBe(
        true
      );
      expect(fs.existsSync(path.join(componentDir, 'Avatar.test.tsx'))).toBe(
        true
      );
    }

    expect(
      fs.existsSync(
        path.join(
          root,
          'packages/react/src/primitives/Avatar/Avatar.module.scss'
        )
      )
    ).toBe(true);

    expect(
      fs.existsSync(
        path.join(
          root,
          'packages/react-native/src/primitives/Avatar/Avatar.styles.ts'
        )
      )
    ).toBe(true);

    expect(fs.existsSync(plan.tokenFactoryFile)).toBe(true);

    for (const tokenTarget of plan.tokenThemeTargets) {
      expect(fs.existsSync(tokenTarget.componentFile)).toBe(true);
    }
  });

  it('registers package layer exports once', async () => {
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

    await writeComponentGenerationPlan(plan);

    for (const packageName of ['react', 'react-native']) {
      const barrelFile = path.join(
        root,
        'packages',
        packageName,
        'src',
        'primitives',
        'index.ts'
      );

      expect(fs.readFileSync(barrelFile, 'utf8')).toBe(
        "export * from './Avatar';\n"
      );
    }

    const metadataBarrel = fs.readFileSync(plan.metadataBarrelFile, 'utf8');

    expect(
      metadataBarrel.match(
        /import \{ avatarMetadata \} from '\.\/Avatar\.metadata';/g
      )
    ).toHaveLength(1);

    expect(metadataBarrel.match(/ {2}avatarMetadata,/g)).toHaveLength(2);
    expect(metadataBarrel).toMatch(/export \{[\s\S]*avatarMetadata,[\s\S]*\};/);

    const strictPublicApi = fs.readFileSync(
      path.join(root, 'scripts/check-public-api.mjs'),
      'utf8'
    );

    expect(strictPublicApi.match(/ {4}'Avatar',/g)).toHaveLength(2);
    expect(strictPublicApi.match(/ {4}'AvatarProps',/g)).toHaveLength(2);
    expect(strictPublicApi).toContain(
      "'packages/react/src/index.ts': [\n    'Avatar',\n    'AvatarProps',\n    'Button',"
    );
    expect(strictPublicApi).toContain(
      "'packages/react-native/src/index.ts': [\n    'Avatar',\n    'AvatarProps',\n    'Button',"
    );
  });

  it('overwrites component files without duplicating barrel exports', async () => {
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
        force: true,
      },
    });

    await writeComponentGenerationPlan(plan);
    await writeComponentGenerationPlan(plan);

    for (const packageName of ['react', 'react-native']) {
      const barrelFile = path.join(
        root,
        'packages',
        packageName,
        'src',
        'primitives',
        'index.ts'
      );

      const content = fs.readFileSync(barrelFile, 'utf8');

      expect(content.match(/export \* from '\.\/Avatar';/g)).toHaveLength(1);
    }
  });

  it('keeps the docs contract byte-identical across force regeneration', async () => {
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
        force: true,
      },
    });

    await writeComponentGenerationPlan(plan);

    const firstDocsContract = fs.readFileSync(plan.docsContractFile, 'utf8');

    await writeComponentGenerationPlan(plan);

    const secondDocsContract = fs.readFileSync(plan.docsContractFile, 'utf8');

    expect(secondDocsContract).toBe(firstDocsContract);
  });

  it('generates platform-specific style files', async () => {
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

    await writeComponentGenerationPlan(plan);

    expect(
      fs.readFileSync(
        path.join(
          root,
          'packages/react/src/primitives/Avatar/Avatar.module.scss'
        ),
        'utf8'
      )
    ).toContain('.avatar');

    expect(
      fs.readFileSync(
        path.join(
          root,
          'packages/react-native/src/primitives/Avatar/Avatar.styles.ts'
        ),
        'utf8'
      )
    ).toContain('StyleSheet.create');
  });

  it('writes and registers component metadata', async () => {
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

    await writeComponentGenerationPlan(plan);

    const metadata = fs.readFileSync(plan.metadataFile, 'utf8');

    expect(metadata).toContain("name: 'Avatar'");
    expect(metadata).toContain("status: 'experimental'");
    expect(metadata).toContain("layer: 'primitives'");
    expect(metadata).toContain("category: 'data-display'");
    expect(metadata).toContain("'react'");
    expect(metadata).toContain("'react-native'");

    const barrel = fs.readFileSync(plan.metadataBarrelFile, 'utf8');

    expect(barrel).toContain(
      "import { avatarMetadata } from './Avatar.metadata';"
    );
    expect(barrel).toContain('export const componentMetadata = [');
    expect(barrel).toContain('  avatarMetadata,');
    expect(
      barrel.match(/import \{ avatarMetadata \} from '\.\/Avatar\.metadata';/g)
    ).toHaveLength(1);
    expect(barrel.match(/ {2}avatarMetadata,/g)).toHaveLength(2);
    expect(barrel).toMatch(/export \{[\s\S]*avatarMetadata,[\s\S]*\};/);
    expect(barrel).toMatch(
      /export const componentMetadata = \[[\s\S]*avatarMetadata,[\s\S]*\] as const;/
    );
  });

  it('generates capabilities from the selected profile', async () => {
    const root = createTempRoot();

    createLayerBarrels(root, 'components');

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Dialog',
        platform: 'web',
        layer: 'components',
        category: 'overlay',
        profile: 'overlay',
        parts: [],
        force: false,
      },
    });

    const result = await writeComponentGenerationPlan(plan);
    const metadata = fs.readFileSync(plan.metadataFile, 'utf8');

    expect(result.createdFiles).toContain(plan.metadataFile);
    expect(metadata).toContain("profile: 'overlay'");
    expect(metadata).toContain("'controlled'");
    expect(metadata).toContain("'uncontrolled'");
    expect(metadata).toContain("'keyboard'");
    expect(metadata).toContain("'focus-management'");
    expect(metadata).toContain("'compound-api'");
    expect(metadata).toContain("'portal'");
  });

  it('generates form-control capabilities in metadata', async () => {
    const root = createTempRoot();

    createLayerBarrels(root, 'primitives');

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'FieldControl',
        platform: 'both',
        layer: 'primitives',
        category: 'form',
        profile: 'form-control',
        parts: [],
        force: false,
      },
    });

    await writeComponentGenerationPlan(plan);

    const metadata = fs.readFileSync(plan.metadataFile, 'utf8');

    expect(metadata).toContain("profile: 'form-control'");
    expect(metadata).toContain("'controlled'");
    expect(metadata).toContain("'uncontrolled'");
    expect(metadata).toContain("'disabled'");
    expect(metadata).toContain("'required'");
    expect(metadata).toContain("'invalid'");
  });

  it('generates compound component parts for each target platform', async () => {
    const root = createTempRoot();

    createLayerBarrels(root, 'components');

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

    await writeComponentGenerationPlan(plan);

    for (const packageName of ['react', 'react-native']) {
      const componentDir = path.join(
        root,
        'packages',
        packageName,
        'src',
        'components',
        'Tabs'
      );

      for (const partName of ['Root', 'List', 'Trigger', 'Content']) {
        const partDir = path.join(componentDir, partName);

        expect(fs.existsSync(path.join(partDir, 'types.ts'))).toBe(true);
        expect(fs.existsSync(path.join(partDir, 'index.ts'))).toBe(true);
        expect(fs.existsSync(path.join(partDir, `Tabs${partName}.tsx`))).toBe(
          true
        );
      }

      const componentSource = fs.readFileSync(
        path.join(componentDir, 'Tabs.tsx'),
        'utf8'
      );

      expect(componentSource).toContain(
        'export const Tabs = Object.assign(TabsRoot, {'
      );
      expect(componentSource).toContain('List: TabsList');
      expect(componentSource).toContain('Trigger: TabsTrigger');
      expect(componentSource).toContain('Content: TabsContent');
      expect(componentSource).not.toContain('Root: TabsRoot');

      const componentIndex = fs.readFileSync(
        path.join(componentDir, 'index.ts'),
        'utf8'
      );

      expect(componentIndex).toContain("export * from './Root';");
      expect(componentIndex).toContain("export * from './List';");
      expect(componentIndex).toContain("export * from './Trigger';");
      expect(componentIndex).toContain("export * from './Content';");

      const styleFile = path.join(
        componentDir,
        packageName === 'react' ? 'Tabs.module.scss' : 'Tabs.styles.ts'
      );

      expect(fs.existsSync(styleFile)).toBe(false);
    }

    expect(fs.existsSync(plan.tokenFactoryFile)).toBe(true);

    for (const tokenTarget of plan.tokenThemeTargets) {
      expect(fs.existsSync(tokenTarget.componentFile)).toBe(true);
    }
  });

  it('generates platform-specific form-control implementations', async () => {
    const root = createTempRoot();

    createLayerBarrels(root, 'primitives');

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'FieldControl',
        platform: 'both',
        layer: 'primitives',
        category: 'form',
        profile: 'form-control',
        parts: [],
        force: false,
      },
    });

    await writeComponentGenerationPlan(plan);

    const webSource = fs.readFileSync(
      path.join(
        root,
        'packages/react/src/primitives/FieldControl/FieldControl.tsx'
      ),
      'utf8'
    );

    const nativeSource = fs.readFileSync(
      path.join(
        root,
        'packages/react-native/src/primitives/FieldControl/FieldControl.tsx'
      ),
      'utf8'
    );

    const webTypes = fs.readFileSync(
      path.join(root, 'packages/react/src/primitives/FieldControl/types.ts'),
      'utf8'
    );

    const nativeTypes = fs.readFileSync(
      path.join(
        root,
        'packages/react-native/src/primitives/FieldControl/types.ts'
      ),
      'utf8'
    );

    const sharedTypes = fs.readFileSync(plan.sharedTypesFile, 'utf8');

    expect(webSource).toContain('<button');
    expect(webSource).toContain('aria-required');
    expect(webSource).toContain('aria-invalid');

    expect(nativeSource).toContain('<Pressable');
    expect(nativeSource).toContain("accessibilityRole='button'");
    expect(nativeSource).toContain('accessibilityState');

    expect(webTypes).toContain(
      "import type { BaseFieldControlProps } from '@vellira-ui/types';"
    );
    expect(nativeTypes).toContain(
      "import type { BaseFieldControlProps } from '@vellira-ui/types';"
    );
    expect(webTypes).toContain(
      'export type FieldControlProps = BaseFieldControlProps;'
    );
    expect(nativeTypes).toContain(
      'export type FieldControlProps = BaseFieldControlProps;'
    );

    expect(sharedTypes).toContain('value?: string');
    expect(sharedTypes).toContain('onValueChange?: (value: string) => void');

    expect(fs.existsSync(plan.tokenFactoryFile)).toBe(true);

    for (const tokenTarget of plan.tokenThemeTargets) {
      expect(fs.existsSync(tokenTarget.componentFile)).toBe(true);
    }
  });

  it('generates composed platform-specific overlay parts', async () => {
    const root = createTempRoot();

    createLayerBarrels(root, 'components');

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Dialog',
        platform: 'both',
        layer: 'components',
        category: 'overlay',
        profile: 'overlay',
        parts: ['Root', 'Trigger', 'Content'],
        force: false,
      },
    });

    await writeComponentGenerationPlan(plan);

    const webComponent = fs.readFileSync(
      path.join(root, 'packages/react/src/components/Dialog/Dialog.tsx'),
      'utf8'
    );

    const nativeComponent = fs.readFileSync(
      path.join(root, 'packages/react-native/src/components/Dialog/Dialog.tsx'),
      'utf8'
    );

    expect(webComponent).toContain(
      'export const Dialog = Object.assign(DialogRoot, {'
    );
    expect(nativeComponent).toContain(
      'export const Dialog = Object.assign(DialogRoot, {'
    );

    const webTrigger = fs.readFileSync(
      path.join(
        root,
        'packages/react/src/components/Dialog/Trigger/DialogTrigger.tsx'
      ),
      'utf8'
    );

    const nativeTrigger = fs.readFileSync(
      path.join(
        root,
        'packages/react-native/src/components/Dialog/Trigger/DialogTrigger.tsx'
      ),
      'utf8'
    );

    expect(webTrigger).toContain("aria-haspopup='dialog'");
    expect(nativeTrigger).toContain("accessibilityRole='button'");

    expect(
      fs.existsSync(
        path.join(
          root,
          'packages/react/src/components/Dialog/Dialog.module.scss'
        )
      )
    ).toBe(false);

    expect(
      fs.existsSync(
        path.join(
          root,
          'packages/react-native/src/components/Dialog/Dialog.styles.ts'
        )
      )
    ).toBe(false);

    expect(fs.existsSync(plan.tokenFactoryFile)).toBe(true);

    for (const tokenTarget of plan.tokenThemeTargets) {
      expect(fs.existsSync(tokenTarget.componentFile)).toBe(true);
    }
  });

  it('writes and registers single-platform component metadata', async () => {
    const root = createTempRoot();
    createLayerBarrels(root, 'components');

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Dialog',
        platform: 'web',
        layer: 'components',
        category: 'overlay',
        profile: 'overlay',
        parts: [],
        force: false,
      },
    });

    await writeComponentGenerationPlan(plan);

    const metadata = fs.readFileSync(plan.metadataFile, 'utf8');
    const barrel = fs.readFileSync(plan.metadataBarrelFile, 'utf8');

    expect(metadata).toContain("name: 'Dialog'");
    expect(metadata).toContain("platforms: ['react']");
    expect(metadata).not.toContain("'react-native'");

    expect(barrel).toContain(
      "import { dialogMetadata } from './Dialog.metadata';"
    );

    expect(barrel).toContain('  dialogMetadata,');
    expect(
      barrel.match(/import \{ dialogMetadata \} from '\.\/Dialog\.metadata';/g)
    ).toHaveLength(1);
    expect(barrel.match(/ {2}dialogMetadata,/g)).toHaveLength(2);
    expect(barrel).toMatch(/export \{[\s\S]*dialogMetadata,[\s\S]*\};/);
    expect(barrel).toMatch(
      /export const componentMetadata = \[[\s\S]*dialogMetadata,[\s\S]*\] as const;/
    );
  });

  it('writes Prettier-clean owned artifacts and docs registry', async () => {
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

    const result = await writeComponentGenerationPlan(plan);

    const formattedFiles = [
      ...new Set([...result.createdFiles, plan.docsContractRegistryFile]),
    ].filter((filePath) => /\.(?:css|json|scss|ts|tsx)$/.test(filePath));

    const repositoryConfig = await prettier.resolveConfig(
      path.join(process.cwd(), 'package.json')
    );

    expect(repositoryConfig).not.toBeNull();
    expect(formattedFiles.length).toBeGreaterThan(0);

    for (const filePath of formattedFiles) {
      const content = fs.readFileSync(filePath, 'utf8');

      expect(
        await prettier.check(content, {
          ...(repositoryConfig ?? {}),
          filepath: filePath,
        })
      ).toBe(true);
    }

    const metadataBarrel = fs.readFileSync(plan.metadataBarrelFile, 'utf8');

    expect(metadataBarrel).toContain('  avatarMetadata,');
  });

  it('keeps generated registrations in canonical module order', async () => {
    const root = createTempRoot();
    createLayerBarrels(root);

    for (const packageName of ['react', 'react-native']) {
      const sourceRoot = path.join(root, 'packages', packageName, 'src');

      fs.writeFileSync(
        path.join(sourceRoot, 'index.ts'),
        `export type { ButtonProps } from './primitives/Button';
export { Button } from './primitives/Button';
`
      );

      fs.writeFileSync(
        path.join(sourceRoot, 'primitives/index.ts'),
        `export * from './Button';
`
      );
    }

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
      `import { buttonMetadata } from './Button.metadata';

export const componentMetadata = [
  buttonMetadata,
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

    fs.mkdirSync(path.dirname(plan.tokenFactoryBarrelFile), {
      recursive: true,
    });

    fs.writeFileSync(
      plan.tokenFactoryBarrelFile,
      `export * from './createButtonPalette.js';
`
    );

    for (const tokenTarget of plan.tokenThemeTargets) {
      fs.mkdirSync(path.dirname(tokenTarget.barrelFile), { recursive: true });

      fs.writeFileSync(
        tokenTarget.barrelFile,
        `export { button } from './button.js';
`
      );
    }

    await writeComponentGenerationPlan(plan);

    for (const target of plan.targets) {
      const layerBarrel = fs.readFileSync(target.barrelFile, 'utf8');

      expect(layerBarrel.indexOf('./Avatar')).toBeLessThan(
        layerBarrel.indexOf('./Button')
      );

      const packageBarrel = fs.readFileSync(target.packageBarrelFile, 'utf8');

      expect(packageBarrel.indexOf('./primitives/Avatar')).toBeLessThan(
        packageBarrel.indexOf('./primitives/Button')
      );
    }

    const metadataBarrel = fs.readFileSync(plan.metadataBarrelFile, 'utf8');

    expect(metadataBarrel.indexOf('./Avatar.metadata')).toBeLessThan(
      metadataBarrel.indexOf('./Button.metadata')
    );

    const tokenFactoryBarrel = fs.readFileSync(
      plan.tokenFactoryBarrelFile,
      'utf8'
    );

    expect(tokenFactoryBarrel.indexOf('./createAvatarTokens.js')).toBeLessThan(
      tokenFactoryBarrel.indexOf('./createButtonPalette.js')
    );

    for (const tokenTarget of plan.tokenThemeTargets) {
      const tokenBarrel = fs.readFileSync(tokenTarget.barrelFile, 'utf8');

      expect(tokenBarrel.indexOf('./avatar.js')).toBeLessThan(
        tokenBarrel.indexOf('./button.js')
      );
    }
  });
});
