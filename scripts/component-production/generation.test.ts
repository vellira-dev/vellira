import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ComponentGenerationPlan } from '../generators/component/plan';
import { synchronizeGeneratedTokenTypes } from '../generators/component/token-types';
import { generateComponentWebsitePage } from '../generators/component/website';

import type { ComponentProductionInputV1 } from './contracts';
import { runComponentProductionGeneration } from './generation';

vi.mock('../generators/component/website', () => ({
  generateComponentWebsitePage: vi.fn(),
}));

vi.mock('../generators/component/token-types', () => ({
  synchronizeGeneratedTokenTypes: vi.fn(),
}));

const tempRoots: string[] = [];

const INPUT: ComponentProductionInputV1 = {
  schemaVersion: '1',
  componentName: 'Avatar',
  platform: 'both',
  layer: 'primitives',
  category: 'data-display',
  profile: 'base',
  capabilities: [],
  parts: [],
};

function createTempRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-component-production-')
  );

  tempRoots.push(root);

  return root;
}

function createRequiredRepositoryStructure(
  root: string,
  layer: 'primitives' | 'components' | 'patterns' = 'primitives'
) {
  for (const packageName of ['react', 'react-native']) {
    const sourceRoot = path.join(root, 'packages', packageName, 'src');
    const layerDir = path.join(sourceRoot, layer);

    fs.mkdirSync(layerDir, { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, 'index.ts'), '');
    fs.writeFileSync(
      path.join(sourceRoot, 'public-api.test.ts'),
      `import * as api from './index';

describe('public API', () => {
  it('exports only documented runtime entries', () => {
    expect(Object.keys(api).sort()).toEqual([
      'Button',
    ]);
  });
});
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

  fs.mkdirSync(path.join(root, 'apps', 'docs', 'src', 'react'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(root, 'apps', 'docs', 'src', 'react-native'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(root, 'apps', 'docs', 'src', '.vitepress'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, 'apps', 'docs', 'src', '.vitepress', 'config.ts'),
    '// vitepress config sentinel\n'
  );
}

function createIconRegistry(root: string, platform: 'react' | 'react-native') {
  const fileName = platform === 'react' ? 'web.source.ts' : 'native.source.ts';
  const iconDir = path.join(root, 'packages', 'icons', 'src');

  fs.mkdirSync(iconDir, { recursive: true });
  fs.writeFileSync(
    path.join(iconDir, fileName),
    `export { default as ChevronDown } from './generated/ChevronDown';
`
  );
}

function createTokenRegistry(root: string) {
  const tokenDir = path.join(root, 'packages', 'tokens', 'src', 'generated');

  fs.mkdirSync(tokenDir, { recursive: true });
  fs.writeFileSync(
    path.join(tokenDir, 'token-types.ts'),
    `export const tokenPaths = [
  'semantic.text.primary',
] as const;
`
  );
}

beforeEach(() => {
  vi.mocked(generateComponentWebsitePage).mockReset();
  vi.mocked(generateComponentWebsitePage).mockReturnValue({
    createdFiles: [],
    updatedFiles: [],
  });

  vi.mocked(synchronizeGeneratedTokenTypes).mockReset();
  vi.mocked(synchronizeGeneratedTokenTypes).mockReturnValue({
    createdFiles: [],
    updatedFiles: [],
  });
});

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, {
      recursive: true,
      force: true,
    });
  }
});

describe('runComponentProductionGeneration', () => {
  it('blocks protected branch writes before planning or generation', async () => {
    let planCalled = false;
    let generatorCalled = false;

    const result = await runComponentProductionGeneration({
      root: '/tmp/vellira-production-test',
      input: INPUT,
      dependencies: {
        validateRepositorySafety: () => ({
          ok: false,
          branch: 'main',
          defaultBranch: 'main',
          reason:
            'Component production refuses direct writes on protected/default branch "main".',
        }),
        createPlan: ({ root }) => {
          planCalled = true;

          return plan(root);
        },
        runGenerator: async () => {
          generatorCalled = true;

          throw new Error('generator must not run');
        },
      },
    });

    expect(planCalled).toBe(false);
    expect(generatorCalled).toBe(false);

    expect(result.preflight).toMatchObject({
      status: 'blocked',
      findings: [
        {
          id: 'preflight:repository-safety',
          severity: 'blocking',
        },
      ],
    });

    expect(result.generation.status).toBe('skipped');
  });

  it('runs deterministic preflight before the canonical generator', async () => {
    const root = path.resolve('/tmp/vellira-production-test');
    const calls: string[] = [];

    const result = await runComponentProductionGeneration({
      root,
      input: INPUT,
      dependencies: {
        validateRepositorySafety: () => ({
          ok: true,
          branch: 'feat/test',
          defaultBranch: 'main',
        }),
        createPlan: ({ root: observedRoot, options }) => {
          calls.push('plan');

          expect(observedRoot).toBe(root);
          expect(options).toMatchObject({
            componentName: 'Avatar',
            platform: 'both',
            force: false,
            dryRun: false,
            check: false,
          });

          return plan(root);
        },
        validatePlan: () => {
          calls.push('preflight');

          return {
            ok: true,
            existingTargets: [],
          };
        },
        runGenerator: async ({ root: observedRoot, options }) => {
          calls.push('generation');

          expect(observedRoot).toBe(root);
          expect(options.force).toBe(false);

          return {
            plan: plan(root),
            createdFiles: [
              path.join(
                root,
                'packages/react/src/primitives/Avatar/Avatar.tsx'
              ),
            ],
            updatedFiles: [
              path.join(root, 'packages/react/src/primitives/index.ts'),
            ],
            dryRun: false,
            check: false,
          };
        },
      },
    });

    expect(calls).toEqual(['plan', 'preflight', 'generation']);

    expect(result.preflight.status).toBe('passed');
    expect(result.generation.status).toBe('passed');
    expect(result.generatedArtifacts).toEqual([
      'packages/react/src/primitives/Avatar/Avatar.tsx',
      'packages/react/src/primitives/index.ts',
    ]);
  });

  it('passes production resource requirements into Generator V2 options', async () => {
    const root = path.resolve('/tmp/vellira-production-test');
    const input: ComponentProductionInputV1 = {
      ...INPUT,
      icons: [{ name: 'ChevronDown', purpose: 'disclosure indicator' }],
      tokens: ['semantic.text.primary'],
    };

    const result = await runComponentProductionGeneration({
      root,
      input,
      dependencies: {
        validateRepositorySafety: () => ({
          ok: true,
          branch: 'feat/test',
          defaultBranch: 'main',
        }),
        createPlan: ({ options }) => {
          expect(options.icons).toEqual([
            { name: 'ChevronDown', purpose: 'disclosure indicator' },
          ]);
          expect(options.tokens).toEqual(['semantic.text.primary']);

          return plan(root);
        },
        validatePlan: () => ({
          ok: true,
          existingTargets: [],
        }),
        runGenerator: async ({ options }) => {
          expect(options.icons).toEqual([
            { name: 'ChevronDown', purpose: 'disclosure indicator' },
          ]);
          expect(options.tokens).toEqual(['semantic.text.primary']);

          return {
            plan: plan(root),
            createdFiles: [
              path.join(
                root,
                'packages/react/src/primitives/Avatar/Avatar.tsx'
              ),
            ],
            updatedFiles: [],
            dryRun: false,
            check: false,
          };
        },
      },
    });

    expect(result.preflight.status).toBe('passed');
    expect(result.generation.status).toBe('passed');
  });

  it('generates metadata with production resource requirements', async () => {
    const root = createTempRoot();

    createRequiredRepositoryStructure(root);
    createIconRegistry(root, 'react');
    createIconRegistry(root, 'react-native');
    createTokenRegistry(root);

    const result = await runComponentProductionGeneration({
      root,
      input: {
        ...INPUT,
        componentName: 'ResourceProbe',
        icons: [{ name: 'ChevronDown', purpose: 'disclosure indicator' }],
        tokens: ['semantic.text.primary'],
      },
      dependencies: {
        validateRepositorySafety: () => ({
          ok: true,
          branch: 'feat/test',
          defaultBranch: 'main',
        }),
      },
    });

    const metadataFile = path.join(
      root,
      'packages',
      'metadata',
      'src',
      'components',
      'ResourceProbe.metadata.ts'
    );
    const metadata = fs.readFileSync(metadataFile, 'utf8');

    expect(result.preflight.status).toBe('passed');
    expect(result.generation.status).toBe('passed');
    expect(metadata).toContain(`    icons: [
      {
        name: 'ChevronDown',
        purpose: 'disclosure indicator',
      },
    ],`);
    expect(metadata).toContain("    tokens: ['semantic.text.primary'],");
  });

  it('blocks missing production resources before component output mutation', async () => {
    const root = createTempRoot();

    createRequiredRepositoryStructure(root);
    createIconRegistry(root, 'react');
    createIconRegistry(root, 'react-native');
    createTokenRegistry(root);

    const result = await runComponentProductionGeneration({
      root,
      input: {
        ...INPUT,
        componentName: 'MissingResourceProbe',
        icons: [{ name: 'MissingIcon', purpose: 'missing affordance' }],
      },
      dependencies: {
        validateRepositorySafety: () => ({
          ok: true,
          branch: 'feat/test',
          defaultBranch: 'main',
        }),
      },
    });

    expect(result.preflight.status).toBe('blocked');
    expect(result.preflight.findings[0]?.message).toContain(
      'missing-icon-resource'
    );
    expect(result.generation.status).toBe('skipped');
    expect(
      fs.existsSync(
        path.join(
          root,
          'packages',
          'metadata',
          'src',
          'components',
          'MissingResourceProbe.metadata.ts'
        )
      )
    ).toBe(false);
    expect(
      fs.existsSync(
        path.join(
          root,
          'packages',
          'react',
          'src',
          'primitives',
          'MissingResourceProbe'
        )
      )
    ).toBe(false);
  });

  it('stops before generation when deterministic preflight blocks', async () => {
    let generatorCalled = false;

    const result = await runComponentProductionGeneration({
      root: '/tmp/vellira-production-test',
      input: INPUT,
      dependencies: {
        validateRepositorySafety: () => ({
          ok: true,
          branch: 'feat/test',
          defaultBranch: 'main',
        }),
        createPlan: ({ root }) => plan(root),
        validatePlan: () => ({
          ok: false,
          errors: ['Missing metadata barrel file.'],
        }),
        runGenerator: async () => {
          generatorCalled = true;
          throw new Error('generator must not run');
        },
      },
    });

    expect(generatorCalled).toBe(false);

    expect(result.preflight.status).toBe('blocked');
    expect(result.preflight.findings).toEqual([
      {
        id: 'preflight:1',
        stage: 'preflight',
        severity: 'blocking',
        message: 'Missing metadata barrel file.',
      },
    ]);

    expect(result.generation.status).toBe('skipped');
    expect(result.generatedArtifacts).toEqual([]);
  });

  it('reports canonical generator runtime failure', async () => {
    const result = await runComponentProductionGeneration({
      root: '/tmp/vellira-production-test',
      input: INPUT,
      dependencies: {
        validateRepositorySafety: () => ({
          ok: true,
          branch: 'feat/test',
          defaultBranch: 'main',
        }),
        createPlan: ({ root }) => plan(root),
        validatePlan: () => ({
          ok: true,
          existingTargets: [],
        }),
        runGenerator: async () => {
          throw new Error('Canonical generator write failed.');
        },
      },
    });

    expect(result.preflight.status).toBe('passed');

    expect(result.generation).toMatchObject({
      id: 'generation',
      status: 'failed',
      findings: [
        {
          id: 'generation:runtime',
          stage: 'generation',
          severity: 'blocking',
          message: 'Canonical generator write failed.',
        },
      ],
    });
  });

  it('fails closed when generator reports an artifact outside the repository', async () => {
    const root = path.resolve('/tmp/vellira-production-test');

    const result = await runComponentProductionGeneration({
      root,
      input: INPUT,
      dependencies: {
        validateRepositorySafety: () => ({
          ok: true,
          branch: 'feat/test',
          defaultBranch: 'main',
        }),
        createPlan: () => plan(root),
        validatePlan: () => ({
          ok: true,
          existingTargets: [],
        }),
        runGenerator: async () => ({
          plan: plan(root),
          createdFiles: [path.resolve(root, '../escaped.ts')],
          updatedFiles: [],
          dryRun: false,
          check: false,
        }),
      },
    });

    expect(result.generation.status).toBe('failed');
    expect(result.generatedArtifacts).toEqual([]);
    expect(result.generation.findings[0]?.message).toContain(
      'escaped the production repository root'
    );
  });
});

function plan(root: string): ComponentGenerationPlan {
  return {
    root,
    componentName: 'Avatar',
    layer: 'primitives',
    category: 'data-display',
    profile: 'base',
    control: 'value',
    typeOwnership: 'platform',
    capabilities: [],
    icons: [],
    tokens: [],
    componentTokens: 'standard',
    force: false,
    parts: [],
    targets: [],
    sharedTypesFile: path.join(root, 'packages/types/src/avatar.ts'),
    sharedTypesBarrelFile: path.join(root, 'packages/types/src/index.ts'),
    metadataFile: path.join(root, 'packages/metadata/src/Avatar.metadata.ts'),
    metadataBarrelFile: path.join(root, 'packages/metadata/src/index.ts'),
    tokenFactoryFile: path.join(
      root,
      'packages/tokens/src/factories/avatar.ts'
    ),
    tokenFactoryBarrelFile: path.join(
      root,
      'packages/tokens/src/factories/index.ts'
    ),
    tokenThemeTargets: [],
    docsRoot: path.join(root, 'apps/docs'),
    docsContractFile: path.join(root, 'apps/docs/src/component-docs/Avatar.ts'),
    docsContractRegistryFile: path.join(
      root,
      'apps/docs/src/component-docs/index.ts'
    ),
  };
}
