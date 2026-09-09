import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkComponentCompleteness } from './check-component';

import type { ComponentMetadata } from '@vellira-ui/metadata';

const tempRoots: string[] = [];

function createTempRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-component-completeness-')
  );

  tempRoots.push(root);

  return root;
}

function createMetadataRegistrationFixture(params: {
  root: string;
  componentName: string;
}) {
  const { root, componentName } = params;
  const metadataDir = path.join(
    root,
    'packages',
    'metadata',
    'src',
    'components'
  );
  const metadataFile = path.join(metadataDir, `${componentName}.metadata.ts`);
  const registryFile = path.join(metadataDir, 'index.ts');
  const metadataName = `${componentName[0].toLowerCase()}${componentName.slice(1)}Metadata`;
  const importLine = `import { ${metadataName} } from './${componentName}.metadata';`;

  fs.mkdirSync(metadataDir, { recursive: true });
  fs.writeFileSync(metadataFile, `export const ${metadataName} = {};\n`);

  if (!fs.existsSync(registryFile)) {
    fs.writeFileSync(
      registryFile,
      `${importLine}\n\nexport const componentMetadata = [\n  ${metadataName},\n] as const;\n`
    );
    return;
  }

  let registry = fs.readFileSync(registryFile, 'utf8');

  if (!registry.includes(importLine)) {
    registry = `${importLine}\n${registry}`;
    registry = registry.replace(
      'export const componentMetadata = [\n',
      `export const componentMetadata = [\n  ${metadataName},\n`
    );
    fs.writeFileSync(registryFile, registry);
  }
}

function createCanonicalPackageFixture(params: {
  root: string;
  packageName: string;
}) {
  const packageDir = params.packageName.replace('@vellira-ui/', '');
  const packageRoot = path.join(params.root, 'packages', packageDir);
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify({ name: params.packageName })}\n`
  );
}

function createComponentDependencyMetadataFixture(params: {
  root: string;
  componentName: string;
  platforms: readonly ('react' | 'react-native')[];
}) {
  const metadataDir = path.join(
    params.root,
    'packages',
    'metadata',
    'src',
    'components'
  );
  fs.mkdirSync(metadataDir, { recursive: true });
  fs.writeFileSync(
    path.join(metadataDir, `${params.componentName}.metadata.ts`),
    `import { defineComponentMetadata } from '../defineComponentMetadata';\n\nexport const dependencyMetadata = defineComponentMetadata({\n  name: '${params.componentName}',\n  platforms: [${params.platforms.map((platform) => `'${platform}'`).join(', ')}],\n});\n`
  );
}

function createComponentTokenStructureFixture(params: {
  root: string;
  componentName: string;
}) {
  const lowerName = `${params.componentName[0].toLowerCase()}${params.componentName.slice(1)}`;
  const factoriesDir = path.join(
    params.root,
    'packages',
    'tokens',
    'src',
    'factories'
  );
  const componentFactoriesDir = path.join(factoriesDir, 'components');
  fs.mkdirSync(componentFactoriesDir, { recursive: true });
  fs.writeFileSync(
    path.join(
      componentFactoriesDir,
      `create${params.componentName}Tokens.ts`
    ),
    ''
  );
  fs.writeFileSync(
    path.join(factoriesDir, 'index.ts'),
    `export * from './components/create${params.componentName}Tokens.js';\n`
  );

  for (const theme of ['light', 'dark', 'highContrast']) {
    const themeDir = path.join(
      params.root,
      'packages',
      'tokens',
      'src',
      theme,
      'components'
    );
    fs.mkdirSync(themeDir, { recursive: true });
    fs.writeFileSync(path.join(themeDir, `${lowerName}.ts`), '');
    fs.writeFileSync(
      path.join(themeDir, 'index.ts'),
      `export { ${lowerName}Tokens as ${lowerName} } from './${lowerName}.js';\n`
    );
  }
}

function createComponentFixture(params: {
  root: string;
  packageName: 'react' | 'react-native';
  layer: 'primitives' | 'components' | 'patterns';
  componentName: string;
}) {
  const { root, packageName, layer, componentName } = params;

  const componentDir = path.join(
    root,
    'packages',
    packageName,
    'src',
    layer,
    componentName
  );

  fs.mkdirSync(componentDir, { recursive: true });

  fs.writeFileSync(path.join(componentDir, `${componentName}.tsx`), '');

  fs.writeFileSync(path.join(componentDir, 'types.ts'), '');

  fs.writeFileSync(path.join(componentDir, `${componentName}.test.tsx`), '');

  fs.writeFileSync(path.join(componentDir, `${componentName}.stories.tsx`), '');

  // Local component barrel:
  // packages/react/src/primitives/Avatar/index.ts
  fs.writeFileSync(
    path.join(componentDir, 'index.ts'),
    `export * from './${componentName}';
export * from './types';
`
  );

  // Package layer barrel:
  // packages/react/src/primitives/index.ts
  const layerDir = path.dirname(componentDir);

  fs.writeFileSync(
    path.join(layerDir, 'index.ts'),
    `export * from './${componentName}';
`
  );

  createMetadataRegistrationFixture({ root, componentName });

  return componentDir;
}

function createWebsiteDocumentationFixture(params: {
  root: string;
  componentName: string;
}) {
  const { root, componentName } = params;

  const slug = componentName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

  const registryDir = path.join(
    root,
    'apps',
    'website',
    'src',
    'component-catalog',
    'registry'
  );

  fs.mkdirSync(registryDir, { recursive: true });

  fs.writeFileSync(
    path.join(registryDir, 'components.ts'),
    `export const webComponents = [
  {
    slug: '${slug}',
    name: '${componentName}',
  },
];
`
  );

  fs.writeFileSync(
    path.join(registryDir, 'componentPages.ts'),
    `export const componentPages = {
  '${slug}': {
    name: '${componentName}',
    Accessibility: () => null,
    api: {
      react: [],
      'react-native': [],
    },
  },
};
`
  );
}

function createTokenRegistryFixture(params: {
  root: string;
  tokens: readonly string[];
}) {
  const { root, tokens } = params;

  const generatedDir = path.join(
    root,
    'packages',
    'tokens',
    'src',
    'generated'
  );

  fs.mkdirSync(generatedDir, { recursive: true });

  fs.writeFileSync(
    path.join(generatedDir, 'token-types.ts'),
    `export const tokenPaths = [
${tokens.map((token) => `  '${token}',`).join('\n')}
] as const;
`
  );
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, {
      recursive: true,
      force: true,
    });
  }
});

describe('component completeness checker', () => {
  it('reports a complete single-platform component as ready', () => {
    const root = createTempRoot();

    createComponentFixture({
      root,
      packageName: 'react',
      layer: 'primitives',
      componentName: 'Avatar',
    });

    createWebsiteDocumentationFixture({
      root,
      componentName: 'Avatar',
    });

    const metadata: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        tests: true,
        storybook: true,
        docs: true,
        accessibility: true,
      },
    };

    const result = checkComponentCompleteness({
      root,
      metadata,
    });

    expect(result.ready).toBe(true);

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'implementation',
          ok: true,
        }),
        expect.objectContaining({
          name: 'types',
          ok: true,
        }),
        expect.objectContaining({
          name: 'tests',
          ok: true,
        }),
        expect.objectContaining({
          name: 'storybook',
          ok: true,
        }),
      ])
    );
  });

  it('reports missing required runtime files', () => {
    const root = createTempRoot();

    const componentDir = path.join(
      root,
      'packages/react/src/primitives/Avatar'
    );

    fs.mkdirSync(componentDir, { recursive: true });

    fs.writeFileSync(path.join(componentDir, 'Avatar.tsx'), '');

    const metadata: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        tests: true,
        storybook: true,
        docs: true,
        accessibility: true,
      },
    };

    const result = checkComponentCompleteness({
      root,
      metadata,
    });

    expect(result.ready).toBe(false);

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'types',
          ok: false,
        }),
        expect.objectContaining({
          name: 'tests',
          ok: false,
        }),
        expect.objectContaining({
          name: 'storybook',
          ok: false,
        }),
      ])
    );
  });

  it('checks every declared platform', () => {
    const root = createTempRoot();

    createComponentFixture({
      root,
      packageName: 'react',
      layer: 'components',
      componentName: 'Dialog',
    });

    const metadata: ComponentMetadata = {
      name: 'Dialog',
      layer: 'components',
      category: 'overlay',
      platforms: ['react', 'react-native'],
      profile: 'overlay',
      status: 'experimental',
      requirements: {
        tests: true,
        storybook: true,
        docs: true,
        accessibility: true,
      },
    };

    const result = checkComponentCompleteness({
      root,
      metadata,
    });

    expect(result.ready).toBe(false);

    const nativeImplementationFailure = result.checks.find(
      (check) =>
        check.name === 'implementation' &&
        check.platform === 'react-native' &&
        check.ok === false
    );

    expect(nativeImplementationFailure).toBeDefined();
  });

  it('reports missing package exports', () => {
    const root = createTempRoot();

    createComponentFixture({
      root,
      packageName: 'react',
      layer: 'primitives',
      componentName: 'Avatar',
    });

    const layerBarrelFile = path.join(
      root,
      'packages/react/src/primitives/index.ts'
    );

    fs.writeFileSync(layerBarrelFile, '');

    const metadata: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        tests: true,
        storybook: true,
        docs: true,
        accessibility: true,
      },
    };

    const result = checkComponentCompleteness({
      root,
      metadata,
    });

    expect(result.ready).toBe(false);

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'exports',
          ok: false,
        }),
      ])
    );
  });

  it('does not require tests or Storybook when metadata disables them', () => {
    const root = createTempRoot();

    const componentDir = createComponentFixture({
      root,
      packageName: 'react',
      layer: 'primitives',
      componentName: 'Avatar',
    });

    fs.rmSync(path.join(componentDir, 'Avatar.test.tsx'));

    fs.rmSync(path.join(componentDir, 'Avatar.stories.tsx'));

    const metadata: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        tests: false,
        storybook: false,
        docs: false,
        accessibility: false,
      },
    };

    const result = checkComponentCompleteness({
      root,
      metadata,
    });

    expect(result.ready).toBe(true);

    expect(result.checks.some((check) => check.name === 'tests')).toBe(false);

    expect(result.checks.some((check) => check.name === 'storybook')).toBe(
      false
    );
  });

  it('requires tests and Storybook when metadata enables them', () => {
    const root = createTempRoot();

    const componentDir = createComponentFixture({
      root,
      packageName: 'react',
      layer: 'primitives',
      componentName: 'Avatar',
    });

    fs.rmSync(path.join(componentDir, 'Avatar.test.tsx'));

    fs.rmSync(path.join(componentDir, 'Avatar.stories.tsx'));

    const metadata: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        tests: true,
        storybook: true,
        docs: false,
        accessibility: false,
      },
    };

    const result = checkComponentCompleteness({
      root,
      metadata,
    });

    expect(result.ready).toBe(false);

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'tests',
          ok: false,
        }),
        expect.objectContaining({
          name: 'storybook',
          ok: false,
        }),
      ])
    );
  });

  it('reports missing website catalog registration', () => {
    const root = createTempRoot();

    createComponentFixture({
      root,
      packageName: 'react',
      layer: 'primitives',
      componentName: 'Avatar',
    });

    const registryDir = path.join(
      root,
      'apps',
      'website',
      'src',
      'component-catalog',
      'registry'
    );

    fs.mkdirSync(registryDir, { recursive: true });

    fs.writeFileSync(
      path.join(registryDir, 'components.ts'),
      `export const webComponents = [];
`
    );

    fs.writeFileSync(
      path.join(registryDir, 'componentPages.ts'),
      `export const componentPages = {
  avatar: {
    name: 'Avatar',
  },
};
`
    );

    const metadata: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        tests: false,
        storybook: false,
        docs: true,
        accessibility: false,
      },
    };

    const result = checkComponentCompleteness({
      root,
      metadata,
    });

    expect(result.ready).toBe(false);

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'website',
          ok: false,
          details: 'Missing "avatar" in website component catalog.',
        }),
      ])
    );
  });

  it('reports missing website component page registration', () => {
    const root = createTempRoot();

    createComponentFixture({
      root,
      packageName: 'react',
      layer: 'primitives',
      componentName: 'Avatar',
    });

    const registryDir = path.join(
      root,
      'apps',
      'website',
      'src',
      'component-catalog',
      'registry'
    );

    fs.mkdirSync(registryDir, { recursive: true });

    fs.writeFileSync(
      path.join(registryDir, 'components.ts'),
      `export const webComponents = [
  {
    slug: 'avatar',
    name: 'Avatar',
  },
];
`
    );

    fs.writeFileSync(
      path.join(registryDir, 'componentPages.ts'),
      `export const componentPages = {};
`
    );

    const metadata: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        tests: false,
        storybook: false,
        docs: true,
        accessibility: false,
      },
    };

    const result = checkComponentCompleteness({
      root,
      metadata,
    });

    expect(result.ready).toBe(false);

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'website',
          ok: false,
          details: 'Missing "avatar" in website component pages registry.',
        }),
      ])
    );
  });

  it('reports missing API documentation', () => {
    const root = createTempRoot();

    createComponentFixture({
      root,
      packageName: 'react',
      layer: 'primitives',
      componentName: 'Avatar',
    });

    const registryDir = path.join(
      root,
      'apps',
      'website',
      'src',
      'component-catalog',
      'registry'
    );

    fs.mkdirSync(registryDir, { recursive: true });

    fs.writeFileSync(
      path.join(registryDir, 'components.ts'),
      `export const webComponents = [
  {
    slug: 'avatar',
    name: 'Avatar',
  },
];
`
    );

    fs.writeFileSync(
      path.join(registryDir, 'componentPages.ts'),
      `export const componentPages = {
  avatar: {
    name: 'Avatar',
  },
};
`
    );

    const metadata: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        tests: false,
        storybook: false,
        docs: true,
        accessibility: false,
      },
    };

    const result = checkComponentCompleteness({
      root,
      metadata,
    });

    expect(result.ready).toBe(false);

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'api-docs',
          ok: false,
        }),
      ])
    );
  });

  it('reports missing API documentation for a declared platform', () => {
    const root = createTempRoot();

    createComponentFixture({
      root,
      packageName: 'react',
      layer: 'components',
      componentName: 'Dialog',
    });

    createComponentFixture({
      root,
      packageName: 'react-native',
      layer: 'components',
      componentName: 'Dialog',
    });

    const registryDir = path.join(
      root,
      'apps',
      'website',
      'src',
      'component-catalog',
      'registry'
    );

    fs.mkdirSync(registryDir, { recursive: true });

    fs.writeFileSync(
      path.join(registryDir, 'components.ts'),
      `export const webComponents = [
  {
    slug: 'dialog',
    name: 'Dialog',
  },
];
`
    );

    fs.writeFileSync(
      path.join(registryDir, 'componentPages.ts'),
      `export const componentPages = {
  dialog: {
    name: 'Dialog',
    api: {
      react: [],
    },
  },
};
`
    );

    const metadata: ComponentMetadata = {
      name: 'Dialog',
      layer: 'components',
      category: 'overlay',
      platforms: ['react', 'react-native'],
      profile: 'overlay',
      status: 'experimental',
      requirements: {
        tests: false,
        storybook: false,
        docs: true,
        accessibility: false,
      },
    };

    const result = checkComponentCompleteness({
      root,
      metadata,
    });

    expect(result.ready).toBe(false);

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'api-docs',
          ok: false,
          details: 'Missing react-native API documentation for "dialog".',
        }),
      ])
    );
  });

  it('reports missing accessibility documentation when required', () => {
    const root = createTempRoot();

    createComponentFixture({
      root,
      packageName: 'react',
      layer: 'primitives',
      componentName: 'Avatar',
    });

    const registryDir = path.join(
      root,
      'apps',
      'website',
      'src',
      'component-catalog',
      'registry'
    );

    fs.mkdirSync(registryDir, { recursive: true });

    fs.writeFileSync(
      path.join(registryDir, 'components.ts'),
      `export const webComponents = [
  {
    slug: 'avatar',
    name: 'Avatar',
  },
];
`
    );

    fs.writeFileSync(
      path.join(registryDir, 'componentPages.ts'),
      `export const componentPages = {
  avatar: {
    name: 'Avatar',
    api: {
      react: [],
    },
  },
};
`
    );

    const metadata: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        tests: false,
        storybook: false,
        docs: true,
        accessibility: true,
      },
    };

    const result = checkComponentCompleteness({
      root,
      metadata,
    });

    expect(result.ready).toBe(false);

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'accessibility',
          ok: false,
          details: 'Missing accessibility documentation for "avatar".',
        }),
      ])
    );
  });

  it('passes declared token requirements when all tokens exist', () => {
    const root = createTempRoot();

    createComponentFixture({
      root,
      packageName: 'react',
      layer: 'primitives',
      componentName: 'Avatar',
    });

    createTokenRegistryFixture({
      root,
      tokens: ['colors.gray.500', 'semantic.text.primary'],
    });

    const metadata: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        tests: false,
        storybook: false,
        docs: false,
        accessibility: false,
        tokens: ['colors.gray.500', 'semantic.text.primary'],
      },
    };

    const result = checkComponentCompleteness({
      root,
      metadata,
    });

    expect(result.ready).toBe(true);

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'tokens',
          ok: true,
        }),
      ])
    );
  });

  it('reports missing declared token requirements', () => {
    const root = createTempRoot();

    createComponentFixture({
      root,
      packageName: 'react',
      layer: 'primitives',
      componentName: 'Avatar',
    });

    createTokenRegistryFixture({
      root,
      tokens: ['colors.gray.500'],
    });

    const metadata: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        tests: false,
        storybook: false,
        docs: false,
        accessibility: false,
        tokens: ['colors.gray.500', 'components.avatar.background'],
      },
    };

    const result = checkComponentCompleteness({
      root,
      metadata,
    });

    expect(result.ready).toBe(false);

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'tokens',
          ok: false,
          details: 'Missing required tokens: components.avatar.background',
        }),
      ])
    );
  });

  it('reports missing canonical metadata registration', () => {
    const root = createTempRoot();

    createComponentFixture({
      root,
      packageName: 'react',
      layer: 'primitives',
      componentName: 'Avatar',
    });

    fs.writeFileSync(
      path.join(root, 'packages', 'metadata', 'src', 'components', 'index.ts'),
      'export const componentMetadata = [] as const;\n'
    );

    const metadata: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        tests: false,
        storybook: false,
        docs: false,
        accessibility: false,
      },
    };

    const result = checkComponentCompleteness({ root, metadata });

    expect(result.ready).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'metadata',
          ok: false,
        }),
      ])
    );
  });

  it('enforces shared type ownership through the canonical generator plan', () => {
    const root = createTempRoot();

    for (const packageName of ['react', 'react-native'] as const) {
      const componentDir = createComponentFixture({
        root,
        packageName,
        layer: 'components',
        componentName: 'Disclosure',
      });

      const rootDir = path.join(componentDir, 'Root');
      fs.mkdirSync(rootDir, { recursive: true });
      fs.writeFileSync(
        path.join(componentDir, 'types.ts'),
        "export type { DisclosureProps } from './Root';\n"
      );
      fs.writeFileSync(
        path.join(rootDir, 'index.ts'),
        "export type { DisclosureProps } from './types';\n"
      );
      fs.writeFileSync(
        path.join(rootDir, 'types.ts'),
        "import type { BaseDisclosureProps } from '@vellira-ui/types';\nexport type DisclosureProps = BaseDisclosureProps;\n"
      );
    }

    createCanonicalPackageFixture({
      root,
      packageName: '@vellira-ui/types',
    });

    const sharedTypesDir = path.join(root, 'packages', 'types', 'src');
    fs.mkdirSync(sharedTypesDir, { recursive: true });
    fs.writeFileSync(
      path.join(sharedTypesDir, 'disclosure.ts'),
      'export interface BaseDisclosureProps {}\n'
    );
    fs.writeFileSync(
      path.join(sharedTypesDir, 'index.ts'),
      "export * from './disclosure';\n"
    );

    const metadata: ComponentMetadata = {
      name: 'Disclosure',
      layer: 'components',
      category: 'navigation',
      platforms: ['react', 'react-native'],
      profile: 'compound',
      status: 'experimental',
      capabilities: ['compound-api', 'controlled', 'uncontrolled'],
      dependencies: {
        packages: ['@vellira-ui/types'],
      },
      requirements: {
        tests: false,
        storybook: false,
        docs: false,
        accessibility: false,
      },
    };

    expect(
      checkComponentCompleteness({ root, metadata }).checks.find(
        (check) => check.name === 'type-ownership'
      )
    ).toMatchObject({ ok: true });

    fs.rmSync(path.join(sharedTypesDir, 'disclosure.ts'));

    expect(
      checkComponentCompleteness({ root, metadata }).checks.find(
        (check) => check.name === 'type-ownership'
      )
    ).toMatchObject({ ok: false });
  });

  it('reuses generator authority validation for dependency renderer availability', () => {
    const root = createTempRoot();

    createComponentFixture({
      root,
      packageName: 'react',
      layer: 'components',
      componentName: 'Dialog',
    });
    createComponentFixture({
      root,
      packageName: 'react-native',
      layer: 'components',
      componentName: 'Dialog',
    });
    createComponentDependencyMetadataFixture({
      root,
      componentName: 'Tooltip',
      platforms: ['react'],
    });

    const metadata: ComponentMetadata = {
      name: 'Dialog',
      layer: 'components',
      category: 'overlay',
      platforms: ['react', 'react-native'],
      profile: 'base',
      status: 'experimental',
      dependencies: {
        components: ['Tooltip'],
      },
      requirements: {
        tests: false,
        storybook: false,
        docs: false,
        accessibility: false,
      },
    };

    const authority = checkComponentCompleteness({
      root,
      metadata,
    }).checks.find((check) => check.name === 'production-authorities');

    expect(authority).toMatchObject({ ok: false });
    expect(authority?.details).toContain(
      'unsupported-component-dependency-platform'
    );
    expect(authority?.details).toContain('requiredPlatform="react-native"');
  });

  it('validates declared canonical icons, assets and tokens through shared authorities', () => {
    const root = createTempRoot();

    createComponentFixture({
      root,
      packageName: 'react',
      layer: 'primitives',
      componentName: 'Avatar',
    });
    createTokenRegistryFixture({
      root,
      tokens: ['semantic.text.primary'],
    });

    const iconDir = path.join(root, 'packages', 'icons', 'src');
    fs.mkdirSync(iconDir, { recursive: true });
    fs.writeFileSync(
      path.join(iconDir, 'web.source.ts'),
      "export { default as Search } from './Search';\n"
    );

    const assetDir = path.join(root, 'packages', 'assets', 'brand');
    fs.mkdirSync(assetDir, { recursive: true });
    fs.writeFileSync(path.join(assetDir, 'avatar.svg'), '<svg />');

    const metadata: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        tests: false,
        storybook: false,
        docs: false,
        accessibility: false,
        tokens: ['semantic.text.primary'],
        icons: [{ name: 'Search', purpose: 'search affordance' }],
        assets: [{ path: 'brand/avatar.svg', purpose: 'avatar fallback' }],
      },
    };

    const result = checkComponentCompleteness({ root, metadata });

    expect(
      result.checks.find((check) => check.name === 'production-authorities')
    ).toMatchObject({ ok: true });
    expect(
      result.checks.find((check) => check.name === 'tokens')
    ).toMatchObject({
      ok: true,
    });
  });

  it('checks explicit component-token structure without duplicating token semantics', () => {
    const root = createTempRoot();

    createComponentFixture({
      root,
      packageName: 'react',
      layer: 'primitives',
      componentName: 'Avatar',
    });
    createComponentTokenStructureFixture({
      root,
      componentName: 'Avatar',
    });

    const metadata: ComponentMetadata = {
      name: 'Avatar',
      layer: 'primitives',
      category: 'data-display',
      platforms: ['react'],
      profile: 'base',
      status: 'experimental',
      requirements: {
        tests: false,
        storybook: false,
        docs: false,
        accessibility: false,
        componentTokens: 'standard',
      },
    };

    expect(
      checkComponentCompleteness({ root, metadata }).checks.find(
        (check) => check.name === 'component-tokens'
      )
    ).toMatchObject({ ok: true });

    fs.rmSync(
      path.join(
        root,
        'packages',
        'tokens',
        'src',
        'dark',
        'components',
        'avatar.ts'
      )
    );

    expect(
      checkComponentCompleteness({ root, metadata }).checks.find(
        (check) => check.name === 'component-tokens'
      )
    ).toMatchObject({ ok: false });
  });
});