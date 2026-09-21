import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runComponentGenerator } from '../generators/component/run';
import { createComponentGenerationPlan } from '../generators/component/plan';
import {
  createComponentMetadataFromPlan,
  generateComponentDocumentation,
} from '../generators/component/docs';
import { generateComponentWebsitePage } from '../generators/component/website';
import { reserveTokenLifecycleFixture } from '../token-lifecycle/fixtures/lifecycle';
import { formatGeneratedContent } from '../generators/format-generated-files';
import {
  createComponentProductionGeneratorOptions,
  type ComponentProductionInputV1,
  type ComponentProductionStageId,
  type ComponentProductionStageResult,
} from './contracts';
import { runComponentProductionGeneration } from './generation';
import { completeDisclosureFixture } from './fixtures/complete-disclosure';
import { completeOverlayFixture } from './fixtures/complete-overlay';
import { runComponentReviewBundle } from './review-bundle';
import {
  runComponentProductionValidation,
  type ComponentProductionRunDependencies,
} from './run';
import { runComponentProductionStructuredValidation } from './structured-validation';

const FIXTURE_TIMEOUT_MS = 240_000;
const repositoryRoot = process.cwd();
const temporaryWorktrees: Array<{ parent: string; root: string }> = [];

type Fixture = {
  id: string;
  roles: readonly string[];
  contentGroupLabel?: string;
  tokenSurface?: {
    part?: 'Root' | 'Content';
    background: 'root.bg' | 'default.bg';
  };
  input: ComponentProductionInputV1;
};

const fixtures: readonly Fixture[] = [
  {
    id: 'base-web',
    roles: ['base'],
    contentGroupLabel: 'Fixture details',
    input: {
      schemaVersion: '1',
      componentName: 'FixtureBaseProbe',
      platform: 'web',
      layer: 'primitives',
      category: 'data-display',
      profile: 'base',
      capabilities: [],
      componentTokens: false,
      parts: [],
    },
  },
  {
    id: 'boolean-form-control',
    roles: ['form-control', 'cross-platform'],
    input: {
      schemaVersion: '1',
      componentName: 'FixtureBooleanProbe',
      platform: 'both',
      layer: 'primitives',
      category: 'form',
      profile: 'form-control',
      control: 'boolean',
      capabilities: ['controlled', 'uncontrolled', 'disabled', 'required'],
      componentTokens: 'boolean-control',
      workItem: {
        provider: 'github',
        repository: 'vellira-dev/vellira',
        issue: '#1283',
      },
      parts: [],
    },
  },
  {
    id: 'compound-divergent',
    roles: ['compound', 'cross-platform', 'intentional-divergence'],
    tokenSurface: { part: 'Root', background: 'root.bg' },
    input: {
      schemaVersion: '1',
      componentName: 'FixtureCompoundProbe',
      platform: 'both',
      layer: 'components',
      category: 'navigation',
      profile: 'compound',
      capabilities: [
        'compound-api',
        'controlled',
        'uncontrolled',
        'disabled',
        'keyboard',
      ],
      componentTokens: 'disclosure',
      workItem: {
        provider: 'github',
        repository: 'vellira-dev/vellira',
        issue: '#1283',
      },
      parts: ['Root', 'Item', 'Trigger', 'Content'],
    },
  },
  {
    id: 'overlay-web',
    roles: ['overlay'],
    tokenSurface: { part: 'Content', background: 'default.bg' },
    input: {
      schemaVersion: '1',
      componentName: 'FixtureOverlayProbe',
      platform: 'web',
      layer: 'components',
      category: 'overlay',
      profile: 'overlay',
      capabilities: [
        'controlled',
        'uncontrolled',
        'keyboard',
        'focus-management',
        'portal',
      ],
      componentTokens: 'standard',
      workItem: {
        provider: 'github',
        repository: 'vellira-dev/vellira',
        issue: '#1283',
      },
      parts: ['Root', 'Trigger', 'Content'],
    },
  },
  {
    id: 'base-cross-platform',
    roles: ['base', 'cross-platform'],
    contentGroupLabel: 'Fixture details',
    tokenSurface: { background: 'default.bg' },
    input: {
      schemaVersion: '1',
      componentName: 'FixtureCrossPlatformProbe',
      dependencies: { packages: ['@vellira-ui/types'] },
      platform: 'both',
      layer: 'primitives',
      category: 'utility',
      profile: 'base',
      capabilities: ['disabled'],
      componentTokens: 'standard',
      workItem: {
        provider: 'github',
        repository: 'vellira-dev/vellira',
        issue: '#1283',
      },
      parts: [],
    },
  },
];

const invalidFixture: ComponentProductionInputV1 = {
  schemaVersion: '1',
  componentName: 'FixtureInvalidResourceProbe',
  platform: 'web',
  layer: 'primitives',
  category: 'utility',
  profile: 'base',
  capabilities: [],
  icons: [
    {
      name: 'DefinitelyMissingFixtureIcon',
      purpose: 'prove fail-closed resource validation',
    },
  ],
  componentTokens: false,
  parts: [],
};

afterEach(() => {
  for (const worktree of temporaryWorktrees.splice(0)) {
    spawnSync(
      'git',
      [
        '-c',
        `safe.directory=${repositoryRoot}`,
        'worktree',
        'remove',
        '--force',
        worktree.root,
      ],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        shell: false,
      }
    );
    fs.rmSync(worktree.parent, { recursive: true, force: true });
  }

  spawnSync(
    'git',
    ['-c', `safe.directory=${repositoryRoot}`, 'worktree', 'prune'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      shell: false,
    }
  );
});

describe('component production end-to-end fixtures', () => {
  it(
    'reports exactly every real generation mutation for a fresh both-platform base component',
    async () => {
      const fixture = fixtures.find(
        (item) => item.id === 'base-cross-platform'
      );
      if (!fixture) throw new Error('Base cross-platform fixture is missing.');

      const root = createIsolatedWorktree();
      const beforeReservation = fingerprintWorkingTree(root);

      await prepareTokenLifecycle(root, fixture.input);
      const beforeGeneration = fingerprintWorkingTree(root);

      expect(
        changedWorkingTreePaths(beforeReservation, beforeGeneration)
      ).toEqual(['packages/metadata/src/tokenLifecycle.ts']);

      const generation = await runComponentProductionGeneration({
        root,
        input: fixture.input,
      });

      expect(generation.preflight, fixture.id).toMatchObject({
        status: 'passed',
      });
      expect(
        generation.generation,
        `${fixture.id}: ${generation.generation.findings
          .map((finding) => finding.message)
          .join('\n')}`
      ).toMatchObject({ status: 'passed' });

      const afterGeneration = fingerprintWorkingTree(root);
      const actualChangedPaths = changedWorkingTreePaths(
        beforeGeneration,
        afterGeneration
      );

      expect(generation.generatedArtifacts).toEqual(actualChangedPaths);
      expect(generation.generation.artifacts).toEqual(actualChangedPaths);

      const generatedPreviewFile = `apps/website/src/component-catalog/components/${fixture.input.componentName}/${fixture.input.componentName}CatalogPreview.tsx`;
      expect(actualChangedPaths).not.toContain(generatedPreviewFile);
      expect(generation.generatedArtifacts).not.toContain(generatedPreviewFile);
      expect(
        fs.readFileSync(
          path.join(
            root,
            'apps/website/src/component-catalog/registry/generatedCatalogPreviews.ts'
          ),
          'utf8'
        )
      ).not.toContain(`${slugify(fixture.input.componentName)}:`);
      expect(
        fs.readFileSync(
          path.join(
            root,
            'apps/website/src/component-catalog/registry/componentPresentation.ts'
          ),
          'utf8'
        )
      ).not.toContain(`slug: '${slugify(fixture.input.componentName)}'`);
      expect(actualChangedPaths).toContain(
        'packages/metadata/src/tokenLifecycle.ts'
      );
    },
    FIXTURE_TIMEOUT_MS
  );

  it.each(fixtures)(
    '$id completes the generated production lifecycle',
    async (fixture) => {
      const root = createIsolatedWorktree();

      await generateFixture(root, fixture);
      expectCanonicalGeneratedSurfaces(root, fixture.input);
      expectIncompleteWebsitePresentation(root, fixture.input.componentName);

      if (fixture.roles.includes('intentional-divergence'))
        expectCompoundPlatformDivergence(root);
      if (['compound', 'overlay'].includes(fixture.input.profile)) {
        const scaffold = await runComponentProductionStructuredValidation({
          root,
          input: fixture.input,
        });
        expect(scaffold.stages[0].status, fixture.id).toBe('blocked');
        expect(scaffold.stages[1].status, fixture.id).toBe('skipped');
        expect(
          scaffold.stages[0].findings.some((finding) =>
            finding.message.includes('no executable test evidence')
          ),
          fixture.id
        ).toBe(true);
        if (fixture.input.profile === 'compound')
          await completeDisclosureFixture(root, fixture.input.componentName);
        else await completeOverlayFixture(root, fixture.input.componentName);
        await regenerateFixtureDocumentation(root, fixture);
      }
      await completeWebsitePresentationFixture(root, fixture);
      await regenerateFixtureDocumentation(root, fixture);
      expectCompletedWebsitePresentation(root, fixture.input.componentName);
      // Behavior and its derived docs are complete; missing accessibility and
      // token presentation must still block the unmodified quality gate.
      if (fixture.contentGroupLabel || fixture.tokenSurface) {
        const scaffold = await runComponentProductionStructuredValidation({
          root,
          input: fixture.input,
        });
        expect(scaffold.stages[1].status, fixture.id).toBe('blocked');
        const missingRules = scaffold.stages[1].findings.map(
          (finding) => finding.id
        );
        if (fixture.contentGroupLabel) {
          expect(
            missingRules.some((id) =>
              id.endsWith(':platform.accessibility-semantics')
            ),
            fixture.id
          ).toBe(true);
        }
        if (fixture.tokenSurface) {
          expect(
            missingRules.some((id) =>
              id.endsWith(':conformity.component-token-contract')
            ),
            fixture.id
          ).toBe(true);
        }
      }
      if (fixture.contentGroupLabel) await completeContentGroup(root, fixture);
      if (fixture.tokenSurface) await completeTokenSurface(root, fixture);
      await regenerateFixtureDocumentation(root, fixture);
      expectCompletedWebsitePresentation(root, fixture.input.componentName);
      await expectDeterministicRegeneration(root, fixture);
      await expect(
        runComponentGenerator({
          root,
          options: {
            ...createComponentProductionGeneratorOptions(fixture.input),
            check: true,
          },
        })
      ).resolves.toMatchObject({ check: true });
      runSemanticFixtureTests(root, fixture);
      commitFixtureCandidate(root);

      const structured = await runComponentProductionStructuredValidation({
        root,
        input: fixture.input,
      });

      expect(structured.stages[0], `${fixture.id}: completeness`).toMatchObject(
        {
          id: 'completeness',
          status: 'passed',
        }
      );
      expect(
        structured.stages[1],
        `${fixture.id}: quality: ${structured.stages[1].findings.map((finding) => finding.message).join('\n')}`
      ).toMatchObject({
        id: 'quality',
        status: 'passed',
      });
      expect(structured.completeness, fixture.id).not.toBeNull();
      expect(structured.quality, fixture.id).not.toBeNull();

      const result = await runMachineReadableValidation({
        root,
        input: fixture.input,
        structured,
      });

      expect(result, fixture.id).toMatchObject({
        schemaVersion: '1',
        status: 'ready',
        readyForReview: true,
        reviewBundle: {
          schemaVersion: '1',
          status: 'ready',
          readyForHumanReview: true,
          workingTreeClean: true,
        },
      });
      expect(result.blockingFindings, fixture.id).toEqual([]);
    },
    FIXTURE_TIMEOUT_MS
  );

  it(
    'rejects invalid resources before writing component artifacts',
    async () => {
      await expectInvalidFixtureToFailClosed(createIsolatedWorktree());
    },
    FIXTURE_TIMEOUT_MS
  );

  it(
    'blocks compound completeness until instance-isolation evidence exists',
    async () => {
      const root = createIsolatedWorktree();
      const fixture = divergentCompoundFixture();

      await prepareTokenLifecycle(root, fixture.input);
      const generation = await runComponentProductionGeneration({
        root,
        input: fixture.input,
      });

      expect(
        generation.generation.status,
        generation.generation.findings
          .map((finding) => finding.message)
          .join('\n')
      ).toBe('passed');

      const webContract = readCoverageContract(root, fixture.input, 'react');
      const nativeContract = readCoverageContract(
        root,
        fixture.input,
        'react-native'
      );

      expect(webContract.componentSpecific.requirements).toContain(
        'instance-isolation'
      );
      expect(nativeContract.componentSpecific.requirements).not.toContain(
        'instance-isolation'
      );
      expect(nativeContract.componentSpecific.requirements).not.toContain(
        'keyboard'
      );

      const beforeEvidence = await runComponentProductionStructuredValidation({
        root,
        input: fixture.input,
        checkPlanContract: async () => [],
      });

      expect(beforeEvidence.stages[0].status).toBe('blocked');
      expect(
        beforeEvidence.stages[0].findings.some((finding) =>
          finding.message.includes('instance-isolation')
        )
      ).toBe(true);

      const manualTest = path.join(
        componentDirectory(root, fixture.input, 'react'),
        `${fixture.input.componentName}.manual.test.tsx`
      );
      const manualSource = fs.readFileSync(manualTest, 'utf8');

      expect(manualSource).toContain('// Coverage contract:');
      expect(manualSource).toContain('instance-isolation');
      expect(
        beforeEvidence.stages[0].findings.some((finding) =>
          finding.message.includes('no executable test evidence')
        )
      ).toBe(true);
    },
    FIXTURE_TIMEOUT_MS
  );
});

async function generateFixture(root: string, fixture: Fixture) {
  await prepareTokenLifecycle(root, fixture.input);

  const generation = await runComponentProductionGeneration({
    root,
    input: fixture.input,
  });

  expect(generation.preflight, fixture.id).toMatchObject({ status: 'passed' });
  expect(
    generation.generation,
    `${fixture.id}: ${generation.generation.findings
      .map((finding) => finding.message)
      .join('\n')}`
  ).toMatchObject({ status: 'passed' });
  expect(generation.generatedArtifacts.length, fixture.id).toBeGreaterThan(0);
}

async function prepareTokenLifecycle(
  root: string,
  input: ComponentProductionInputV1
) {
  if (input.componentTokens !== false) {
    reserveTokenLifecycleFixture(root, input.componentName);
  }
}

async function regenerateFixtureDocumentation(root: string, fixture: Fixture) {
  const plan = createComponentGenerationPlan({
    root,
    options: {
      ...createComponentProductionGeneratorOptions(fixture.input),
      force: true,
    },
  });
  await generateComponentDocumentation({
    root,
    plan,
    metadata: createComponentMetadataFromPlan(plan),
    createdFiles: [],
    updatedFiles: [],
  });
  generateComponentWebsitePage({
    root,
    componentName: fixture.input.componentName,
    profile: fixture.input.profile,
    category: fixture.input.category,
  });
}

async function completeWebsitePresentationFixture(
  root: string,
  fixture: Fixture
) {
  const metadataFile = path.join(
    root,
    'apps/website/src/component-catalog/components',
    fixture.input.componentName,
    'metadata.ts'
  );
  const metadata = fs.readFileSync(metadataFile, 'utf8');

  expect(metadata).not.toContain('related:');
  expect(metadata).not.toContain('catalogPreview:');

  fs.writeFileSync(
    metadataFile,
    await formatGeneratedContent(
      metadataFile,
      metadata.replace(
        `profile: '${fixture.input.profile === 'base' ? 'primitive' : fixture.input.profile}',`,
        `profile: '${fixture.input.profile === 'base' ? 'primitive' : fixture.input.profile}',\n  related: [],\n  catalogPreview: {},`
      )
    )
  );
}

function expectIncompleteWebsitePresentation(
  root: string,
  componentName: string
) {
  const slug = slugify(componentName);
  const previewFile = path.join(
    root,
    'apps/website/src/component-catalog/components',
    componentName,
    `${componentName}CatalogPreview.tsx`
  );
  const previewRegistry = fs.readFileSync(
    path.join(
      root,
      'apps/website/src/component-catalog/registry/generatedCatalogPreviews.ts'
    ),
    'utf8'
  );
  const presentationRegistry = fs.readFileSync(
    path.join(
      root,
      'apps/website/src/component-catalog/registry/componentPresentation.ts'
    ),
    'utf8'
  );

  expect(fs.existsSync(previewFile)).toBe(false);
  expect(previewRegistry).not.toContain(`${slug}:`);
  expect(presentationRegistry).not.toContain(`slug: '${slug}'`);

  const result = spawnSync(
    'pnpm',
    ['create:component-page', componentName, '--force', '--check'],
    {
      cwd: root,
      encoding: 'utf8',
      shell: false,
      env: { ...process.env, CI: 'true' },
    }
  );
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');

  expect(result.status, output).not.toBe(0);
  expect(output).toContain('catalogPreview must be explicitly defined');
}

function expectCompletedWebsitePresentation(
  root: string,
  componentName: string
) {
  const slug = slugify(componentName);
  const previewFile = path.join(
    root,
    'apps/website/src/component-catalog/components',
    componentName,
    `${componentName}CatalogPreview.tsx`
  );
  const preview = fs.readFileSync(previewFile, 'utf8');
  const registry = fs.readFileSync(
    path.join(
      root,
      'apps/website/src/component-catalog/registry/generatedCatalogPreviews.ts'
    ),
    'utf8'
  );

  expect(preview).toContain(
    `import { ${componentName} } from '@vellira-ui/react';`
  );
  expect(preview).not.toMatch(/Demo|Playground/);
  expect(registry).toMatch(
    new RegExp(`(?:${slug}|['"]${slug}['"]): ${componentName}CatalogPreview`)
  );
  expect(
    fs.readFileSync(
      path.join(
        root,
        'apps/website/src/component-catalog/registry/componentPresentation.ts'
      ),
      'utf8'
    )
  ).toContain(`slug: '${slug}'`);
}

function runSemanticFixtureTests(root: string, fixture: Fixture) {
  for (const platform of ['react', 'react-native'] as const) {
    const tests = [fixture]
      .filter(
        (fixture) =>
          fixture.input.profile === 'compound' ||
          (fixture.input.profile === 'base' &&
            fixture.input.capabilities.includes('disabled')) ||
          (platform === 'react' && fixture.input.profile === 'overlay')
      )
      .map(
        ({ input }) =>
          `src/${input.layer}/${input.componentName}/${input.componentName}.manual.test.tsx`
      );
    if (tests.length === 0) continue;
    const result = spawnSync(
      'pnpm',
      ['exec', 'vitest', 'run', ...tests, '--config', 'vitest.config.ts'],
      {
        cwd: path.join(root, 'packages', platform),
        encoding: 'utf8',
        shell: false,
        env: { ...process.env, CI: 'true' },
      }
    );
    expect(
      result.status,
      `${platform} fixture behavior:\n${result.stdout}\n${result.stderr}`
    ).toBe(0);
  }
}

async function completeContentGroup(root: string, fixture: Fixture) {
  const disabled = fixture.input.capabilities.includes('disabled');
  const name = fixture.input.componentName;
  if (disabled) {
    const sharedFile = path.join(
      root,
      'packages/types/src',
      `${name[0].toLowerCase()}${name.slice(1)}.ts`
    );
    fs.writeFileSync(
      sharedFile,
      await formatGeneratedContent(
        sharedFile,
        `export type Base${name}Props = { disabled?: boolean };`
      )
    );
    const barrel = path.join(root, 'packages/types/src/index.ts');
    fs.writeFileSync(
      barrel,
      await formatGeneratedContent(
        barrel,
        `${fs.readFileSync(barrel, 'utf8')}\nexport * from './${name[0].toLowerCase()}${name.slice(1)}';\n`
      )
    );
    // Website metadata is author-owned after generation. Add the newly
    // completed root state explicitly instead of overwriting curated examples.
    const metadataFile = path.join(
      root,
      'apps/website/src/component-catalog/components',
      name,
      'metadata.ts'
    );
    const metadata = fs.readFileSync(metadataFile, 'utf8');
    expect(metadata).toContain('examples: [');
    fs.writeFileSync(
      metadataFile,
      await formatGeneratedContent(
        metadataFile,
        metadata.replace(
          'examples: [',
          "examples: [{ title: 'Disabled', description: 'Disabled content group.', props: ['disabled'] },"
        )
      )
    );
  }
  for (const platform of selectedPlatforms(fixture.input)) {
    const file = path.join(
      componentDirectory(root, fixture.input, platform.platform),
      `${fixture.input.componentName}.tsx`
    );
    let source = fs.readFileSync(file, 'utf8');
    if (disabled)
      source = source.replace('children,', 'children, disabled = false,');
    if (disabled) {
      const typesFile = path.join(
        componentDirectory(root, fixture.input, platform.platform),
        'types.ts'
      );
      fs.writeFileSync(
        typesFile,
        await formatGeneratedContent(
          typesFile,
          `import type { ReactNode } from 'react';
import type { Base${name}Props } from '@vellira-ui/types';
export type ${name}Props = Base${name}Props & { children?: ReactNode };`
        )
      );
    }
    const element = platform.platform === 'react' ? '<div ' : '<View ';
    expect(source.split(element)).toHaveLength(2);
    let semantics =
      platform.platform === 'react'
        ? `role='group' aria-label=${JSON.stringify(fixture.contentGroupLabel)}`
        : `accessible={true} accessibilityLabel=${JSON.stringify(fixture.contentGroupLabel)}`;
    if (disabled)
      semantics +=
        platform.platform === 'react'
          ? ' aria-disabled={disabled} inert={disabled}'
          : " accessibilityState={{ disabled }} pointerEvents={disabled ? 'none' : 'auto'}";
    fs.writeFileSync(
      file,
      await formatGeneratedContent(
        file,
        source.replace(element, `${element}${semantics} `)
      )
    );
    if (disabled) {
      const testFile = path.join(
        componentDirectory(root, fixture.input, platform.platform),
        `${name}.manual.test.tsx`
      );
      const marker = fs.existsSync(testFile)
        ? fs.readFileSync(testFile, 'utf8').split('\n')[0]
        : '// Coverage contract: disabled';
      fs.writeFileSync(
        testFile,
        await formatGeneratedContent(
          testFile,
          `${marker}
import { render } from '@test-utils/render';
import { expect, it } from 'vitest';
import { ${name} } from './${name}';
it('exposes disabled content-group semantics', () => {
  const { container, unmount } = render(<${name} disabled>Disabled content</${name}>);
  expect(container.firstElementChild?.getAttribute('aria-disabled')).toBe('true');
  unmount();
});`
        )
      );
    }
  }
}

async function completeTokenSurface(root: string, fixture: Fixture) {
  const surface = fixture.tokenSurface;
  if (!surface) throw new Error('Fixture token presentation is missing.');
  const name = fixture.input.componentName;
  const tokenName = `${name[0].toLowerCase()}${name.slice(1)}`;
  for (const platform of selectedPlatforms(fixture.input)) {
    const directory = componentDirectory(
      root,
      fixture.input,
      platform.platform
    );
    const runtimeFile = path.join(
      directory,
      surface.part ?? '',
      `${name}${surface.part ?? ''}.tsx`
    );
    let source = fs.readFileSync(runtimeFile, 'utf8');
    const relative = surface.part ? '..' : '.';
    const native = platform.platform === 'react-native';
    const styleFile = path.join(
      directory,
      native ? `${name}.styles.ts` : `${name}.module.scss`
    );
    const styleSource = native
      ? `import { StyleSheet } from 'react-native';
import type { NativeTheme } from '../../theme';
export const createStyles = (theme: NativeTheme) => StyleSheet.create({
  ${tokenName}: { backgroundColor: theme.components.${tokenName}.${surface.background} },
});`
      : `.${tokenName} { background: var(--${slugify(name)}-${surface.background.replaceAll('.', '-')}); }`;

    if (native) {
      const styleImport = `import { styles } from '${relative}/${name}.styles';`;
      source = source.replace(styleImport, '');
      source = `import { useThemeStyles } from '${surface.part ? '../../..' : '../..'}/theme';
import { createStyles } from '${relative}/${name}.styles';\n${source}`;
      expect(source.split('return ')).toHaveLength(2);
      source = source.replace(
        'return ',
        'const styles = useThemeStyles(createStyles);\n  return '
      );
      if (surface.part)
        source = source.replace('<View>', `<View style={styles.${tokenName}}>`);
    } else if (surface.part) {
      source = `import styles from '${relative}/${name}.module.scss';\n${source}`;
      expect(source.split('<div')).toHaveLength(2);
      source = source.replace('<div', `<div className={styles.${tokenName}}`);
    }
    for (const [file, content] of [
      [runtimeFile, source],
      [styleFile, styleSource],
    ]) {
      fs.writeFileSync(file, await formatGeneratedContent(file, content));
    }
  }
}

async function expectInvalidFixtureToFailClosed(root: string) {
  const generation = await runComponentProductionGeneration({
    root,
    input: invalidFixture,
  });

  expect(generation.preflight.status).toBe('blocked');
  expect(generation.generation.status).toBe('skipped');
  expect(generation.generatedArtifacts).toEqual([]);
  expect(
    fs.existsSync(
      path.join(
        root,
        'packages/react/src/primitives',
        invalidFixture.componentName
      )
    )
  ).toBe(false);
}

async function expectDeterministicRegeneration(root: string, fixture: Fixture) {
  const before = fingerprintWorkingTree(root);

  await regenerateFixtureDocumentation(root, fixture);

  expect(fingerprintWorkingTree(root)).toEqual(before);
}

async function runMachineReadableValidation(params: {
  root: string;
  input: ComponentProductionInputV1;
  structured: Awaited<
    ReturnType<typeof runComponentProductionStructuredValidation>
  >;
}) {
  const dependencies: Pick<
    ComponentProductionRunDependencies,
    | 'runCommandValidation'
    | 'runStructuredValidation'
    | 'runFinalValidation'
    | 'runReviewBundle'
  > = {
    runCommandValidation: () => ({ stages: commandStages() }),
    runStructuredValidation: async () => params.structured,
    runFinalValidation: () => ({ stages: finalStages() }),
    runReviewBundle: runComponentReviewBundle,
  };

  return runComponentProductionValidation({
    root: params.root,
    input: params.input,
    dependencies,
  });
}

function createIsolatedWorktree() {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-component-production-e2e-')
  );
  const root = path.join(parent, 'repo');
  const result = spawnSync(
    'git',
    [
      '-c',
      `safe.directory=${repositoryRoot}`,
      'worktree',
      'add',
      '--detach',
      root,
      'HEAD',
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      shell: false,
    }
  );

  if (result.status !== 0) {
    fs.rmSync(parent, { recursive: true, force: true });
    throw new Error(
      `Unable to create component production fixture worktree: ${result.stderr}`
    );
  }

  temporaryWorktrees.push({ parent, root });
  linkInstalledDependencies(root);

  return root;
}

function linkInstalledDependencies(root: string) {
  linkDirectory(
    path.join(repositoryRoot, 'node_modules'),
    path.join(root, 'node_modules')
  );

  for (const collection of ['apps', 'packages']) {
    const sourceCollection = path.join(repositoryRoot, collection);

    if (!fs.existsSync(sourceCollection)) {
      continue;
    }

    for (const entry of fs.readdirSync(sourceCollection, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) {
        continue;
      }

      linkDirectory(
        path.join(sourceCollection, entry.name, 'node_modules'),
        path.join(root, collection, entry.name, 'node_modules')
      );
    }
  }
}

function linkDirectory(source: string, target: string) {
  if (!fs.existsSync(source) || fs.existsSync(target)) {
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(
    source,
    target,
    process.platform === 'win32' ? 'junction' : 'dir'
  );
}

function expectCanonicalGeneratedSurfaces(
  root: string,
  input: ComponentProductionInputV1
) {
  const slug = slugify(input.componentName);
  const websiteDir = path.join(
    root,
    'apps/website/src/component-catalog/components',
    input.componentName
  );

  expectFile(
    root,
    `packages/metadata/src/components/${input.componentName}.metadata.ts`
  );

  for (const platform of selectedPlatforms(input)) {
    const componentDir = `packages/${platform.packageName}/src/${input.layer}/${input.componentName}`;

    for (const fileName of [
      `${input.componentName}.tsx`,
      'types.ts',
      'index.ts',
      `${input.componentName}.test.tsx`,
      `${input.componentName}.test-contract.json`,
      `${input.componentName}.stories.tsx`,
    ]) {
      expectFile(root, `${componentDir}/${fileName}`);
    }

    expectFile(root, `apps/docs/src/${platform.docsDirectory}/${slug}.md`);
  }

  for (const fileName of [
    'index.ts',
    `${input.componentName}Examples.tsx`,
    `${input.componentName}Playground.tsx`,
    `${input.componentName}Accessibility.tsx`,
    `${slug}Api.ts`,
  ]) {
    expect(fs.existsSync(path.join(websiteDir, fileName)), fileName).toBe(true);
  }

  if (input.platform === 'web' || input.platform === 'both') {
    expect(
      fs.existsSync(path.join(websiteDir, `${input.componentName}Demo.tsx`))
    ).toBe(true);
  }

  if (input.platform === 'native' || input.platform === 'both') {
    expect(
      fs.existsSync(
        path.join(websiteDir, `Native${input.componentName}Demo.tsx`)
      )
    ).toBe(true);
  }

  if (input.componentTokens !== false) {
    expectFile(
      root,
      `packages/tokens/src/factories/components/create${input.componentName}Tokens.ts`
    );
  }
}

function expectCompoundPlatformDivergence(root: string) {
  const fixture = divergentCompoundFixture();
  const web = readCoverageContract(root, fixture.input, 'react');
  const native = readCoverageContract(root, fixture.input, 'react-native');

  expect(web.componentSpecific.requirements).toContain('instance-isolation');
  expect(web.componentSpecific.requirements).toContain('keyboard');
  expect(native.componentSpecific.requirements).not.toContain(
    'instance-isolation'
  );
  expect(native.componentSpecific.requirements).not.toContain('keyboard');
  expect(web).not.toEqual(native);
}

function divergentCompoundFixture() {
  const fixture = fixtures.find((item) =>
    item.roles.includes('intentional-divergence')
  );

  if (!fixture) {
    throw new Error('Compound divergence fixture is missing.');
  }

  return fixture;
}

function readCoverageContract(
  root: string,
  input: ComponentProductionInputV1,
  platform: 'react' | 'react-native'
): {
  baseline: { requirements: string[] };
  componentSpecific: { required: boolean; requirements: string[] };
} {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        componentDirectory(root, input, platform),
        `${input.componentName}.test-contract.json`
      ),
      'utf8'
    )
  ) as {
    baseline: { requirements: string[] };
    componentSpecific: { required: boolean; requirements: string[] };
  };
}

function componentDirectory(
  root: string,
  input: ComponentProductionInputV1,
  platform: 'react' | 'react-native'
) {
  return path.join(
    root,
    'packages',
    platform === 'react' ? 'react' : 'react-native',
    'src',
    input.layer,
    input.componentName
  );
}

function selectedPlatforms(input: ComponentProductionInputV1) {
  const platforms: Array<{
    platform: 'react' | 'react-native';
    packageName: 'react' | 'react-native';
    docsDirectory: 'react' | 'react-native';
  }> = [];

  if (input.platform === 'web' || input.platform === 'both') {
    platforms.push({
      platform: 'react',
      packageName: 'react',
      docsDirectory: 'react',
    });
  }

  if (input.platform === 'native' || input.platform === 'both') {
    platforms.push({
      platform: 'react-native',
      packageName: 'react-native',
      docsDirectory: 'react-native',
    });
  }

  return platforms;
}

function commitFixtureCandidate(root: string) {
  runGit(root, ['add', '-A']);
  runGit(root, [
    '-c',
    'user.name=Vellira Fixture',
    '-c',
    'user.email=fixture@vellira.invalid',
    'commit',
    '-m',
    'test: materialize component production e2e candidate',
  ]);

  expect(
    runGit(root, ['status', '--porcelain=v1', '--untracked-files=all'])
  ).toBe('');
}

function fingerprintWorkingTree(root: string) {
  const fingerprint = new Map<string, string>();

  for (const record of runGit(root, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
  ])
    .split('\u0000')
    .filter(Boolean)) {
    const filePath = record.slice(3);
    const absolutePath = path.join(root, filePath);
    const hash = fs.existsSync(absolutePath)
      ? crypto
          .createHash('sha256')
          .update(fs.readFileSync(absolutePath))
          .digest('hex')
      : '<missing>';

    fingerprint.set(filePath, `${record.slice(0, 2)} ${hash}`);
  }

  return fingerprint;
}

function changedWorkingTreePaths(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>
) {
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((filePath) => before.get(filePath) !== after.get(filePath))
    .sort();
}

function runGit(root: string, args: readonly string[]) {
  const result = spawnSync('git', ['-c', `safe.directory=${root}`, ...args], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(
      `Git command failed: git ${args.join(' ')}\n${result.stderr ?? ''}`
    );
  }

  return result.stdout ?? '';
}

function expectFile(root: string, relativePath: string) {
  expect(fs.existsSync(path.join(root, relativePath)), relativePath).toBe(true);
}

function slugify(componentName: string) {
  return componentName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function passedStage(
  id: ComponentProductionStageId
): ComponentProductionStageResult {
  return {
    id,
    status: 'passed',
    summary: `${id} passed in the repository-level E2E fixture boundary.`,
    findings: [],
    artifacts: [],
  };
}

function commandStages(): ComponentProductionStageResult[] {
  return [
    'format',
    'lint',
    'tests',
    'typecheck',
    'build',
    'storybook',
    'docs',
    'website',
  ].map((id) => passedStage(id as ComponentProductionStageId));
}

function finalStages(): ComponentProductionStageResult[] {
  return ['public-api', 'tooling', 'visual', 'smoke'].map((id) =>
    passedStage(id as ComponentProductionStageId)
  );
}
