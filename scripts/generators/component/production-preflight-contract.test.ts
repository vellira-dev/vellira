import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createComponentGenerationPlan } from './plan';
import { validateComponentGenerationPlan } from './preflight';

import {
  copyTokenLifecycleFixture,
  reserveTokenLifecycleFixture,
} from '../../token-lifecycle/fixtures/lifecycle';

const roots: string[] = [];

type DependencyPlatform = 'react' | 'react-native';

function tempRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-production-preflight-')
  );
  roots.push(root);
  return root;
}

function createRepositoryAuthorities(root: string) {
  copyTokenLifecycleFixture(root);
  reserveTokenLifecycleFixture(root, 'ContractProbe');
  for (const packageName of ['react', 'react-native']) {
    const layerDir = path.join(
      root,
      'packages',
      packageName,
      'src',
      'components'
    );
    fs.mkdirSync(layerDir, { recursive: true });
    fs.writeFileSync(path.join(layerDir, 'index.ts'), '');
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
    'export const componentMetadata = [\n] as const;\n'
  );

  const docsDir = path.join(root, 'apps', 'docs', 'src', 'component-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(
    path.join(docsDir, 'index.ts'),
    'export const componentDocsContracts = [\n] as const;\n'
  );
}

function writeComponentMetadata(
  root: string,
  componentName: string,
  platforms: readonly DependencyPlatform[]
) {
  const metadataDir = path.join(
    root,
    'packages',
    'metadata',
    'src',
    'components'
  );
  const metadataName = `${componentName[0].toLowerCase()}${componentName.slice(1)}Metadata`;

  fs.writeFileSync(
    path.join(metadataDir, `${componentName}.metadata.ts`),
    `import { defineComponentMetadata } from '../defineComponentMetadata';\n\n` +
      `export const ${metadataName} = defineComponentMetadata({\n` +
      `  name: '${componentName}',\n` +
      `  platforms: [${platforms.map((platform) => `'${platform}'`).join(', ')}],\n` +
      `});\n`
  );
}

function plan(
  root: string,
  overrides: Partial<
    Parameters<typeof createComponentGenerationPlan>[0]['options']
  > = {}
) {
  return createComponentGenerationPlan({
    root,
    options: {
      componentName: 'ContractProbe',
      platform: 'web',
      layer: 'components',
      category: 'utility',
      profile: 'base',
      capabilities: [],
      parts: [],
      force: false,
      ...overrides,
    },
  });
}

function expectError(
  result: ReturnType<typeof validateComponentGenerationPlan>
) {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('Expected preflight to fail.');
  }
  return result.errors;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('component production dependency/resource preflight', () => {
  it('accepts existing canonical package, component, and asset dependencies', () => {
    const root = tempRoot();
    createRepositoryAuthorities(root);

    const coreDir = path.join(root, 'packages', 'core');
    fs.mkdirSync(coreDir, { recursive: true });
    fs.writeFileSync(
      path.join(coreDir, 'package.json'),
      JSON.stringify({ name: '@vellira-ui/core' })
    );

    writeComponentMetadata(root, 'Tooltip', ['react']);

    const assetFile = path.join(
      root,
      'packages',
      'assets',
      'styles',
      'contract-probe.css'
    );
    fs.mkdirSync(path.dirname(assetFile), { recursive: true });
    fs.writeFileSync(assetFile, '.probe {}\n');

    const result = validateComponentGenerationPlan(
      plan(root, {
        dependencies: {
          packages: ['@vellira-ui/core'],
          components: ['Tooltip'],
        },
        assets: [
          {
            path: 'styles/contract-probe.css',
            purpose: 'canonical probe surface',
          },
        ],
      })
    );

    expect(result).toEqual({ ok: true, existingTargets: [] });
  });

  it('fails closed for a missing declared canonical package before mutation', () => {
    const root = tempRoot();
    createRepositoryAuthorities(root);
    const result = validateComponentGenerationPlan(
      plan(root, {
        dependencies: { packages: ['@vellira-ui/core'] },
      })
    );

    expect(expectError(result).join('\n')).toContain(
      'missing-canonical-package-dependency: package="@vellira-ui/core"'
    );
    expect(
      fs.existsSync(
        path.join(
          root,
          'packages',
          'react',
          'src',
          'components',
          'ContractProbe'
        )
      )
    ).toBe(false);
  });

  it('fails closed for a missing declared canonical component before mutation', () => {
    const root = tempRoot();
    createRepositoryAuthorities(root);
    const result = validateComponentGenerationPlan(
      plan(root, {
        dependencies: { components: ['Tooltip'] },
      })
    );

    expect(expectError(result).join('\n')).toContain(
      'missing-component-dependency: component="Tooltip"'
    );
  });

  it('fails closed when a root component dependency lacks a selected renderer', () => {
    const root = tempRoot();
    createRepositoryAuthorities(root);
    writeComponentMetadata(root, 'Tooltip', ['react']);

    const metadataFile = path.join(
      root,
      'packages',
      'metadata',
      'src',
      'components',
      'Tooltip.metadata.ts'
    );
    const result = validateComponentGenerationPlan(
      plan(root, {
        platform: 'both',
        dependencies: { components: ['Tooltip'] },
      })
    );

    expect(expectError(result)).toContain(
      `unsupported-component-dependency-platform: component="Tooltip" requiredPlatform="react-native" metadata="${metadataFile}"`
    );
  });

  it('fails closed when a platform-scoped dependency is unavailable on that renderer', () => {
    const root = tempRoot();
    createRepositoryAuthorities(root);
    writeComponentMetadata(root, 'Tooltip', ['react']);

    const result = validateComponentGenerationPlan(
      plan(root, {
        platform: 'both',
        dependencies: {
          platforms: {
            'react-native': { components: ['Tooltip'] },
          },
        },
      })
    );

    expect(expectError(result).join('\n')).toContain(
      'unsupported-component-dependency-platform: component="Tooltip" requiredPlatform="react-native"'
    );
  });

  it('fails closed when dependency metadata cannot prove renderer availability', () => {
    const root = tempRoot();
    createRepositoryAuthorities(root);
    fs.writeFileSync(
      path.join(
        root,
        'packages',
        'metadata',
        'src',
        'components',
        'Tooltip.metadata.ts'
      ),
      'export const tooltipMetadata = {};\n'
    );

    const result = validateComponentGenerationPlan(
      plan(root, {
        dependencies: { components: ['Tooltip'] },
      })
    );

    expect(expectError(result).join('\n')).toContain(
      'invalid-component-dependency-metadata: component="Tooltip"'
    );
  });

  it('rejects self-dependencies deterministically', () => {
    const root = tempRoot();
    createRepositoryAuthorities(root);
    const result = validateComponentGenerationPlan(
      plan(root, {
        dependencies: { components: ['ContractProbe'] },
      })
    );

    expect(expectError(result)).toContain(
      'invalid-component-dependency: component="ContractProbe" cannot depend on itself'
    );
  });

  it('rejects renderer-specific dependencies for an unselected platform', () => {
    const root = tempRoot();
    createRepositoryAuthorities(root);
    const result = validateComponentGenerationPlan(
      plan(root, {
        dependencies: {
          platforms: {
            'react-native': { components: ['Tooltip'] },
          },
        },
      })
    );

    expect(expectError(result)).toContain(
      'invalid-platform-dependency: platform="react-native" is not selected for component="ContractProbe"'
    );
  });

  it('fails closed for a missing canonical asset before mutation', () => {
    const root = tempRoot();
    createRepositoryAuthorities(root);
    const result = validateComponentGenerationPlan(
      plan(root, {
        assets: [
          {
            path: 'styles/missing.css',
            purpose: 'canonical probe surface',
          },
        ],
      })
    );

    expect(expectError(result).join('\n')).toContain(
      'missing-design-asset: path="styles/missing.css" purpose="canonical probe surface"'
    );
  });

  it('rejects assets outside the canonical brand/fonts/styles authority', () => {
    const root = tempRoot();
    createRepositoryAuthorities(root);
    const result = validateComponentGenerationPlan(
      plan(root, {
        assets: [
          {
            path: '../private/probe.css',
            purpose: 'invalid private fallback',
          },
        ],
      })
    );

    expect(expectError(result)).toContain(
      'invalid-design-asset-path: path="../private/probe.css" purpose="invalid private fallback" — expected a canonical brand/, fonts/, or styles/ asset path'
    );
  });
});
