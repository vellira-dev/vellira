import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type {
  ComponentMetadata,
  ComponentPlatform,
} from '@vellira-ui/metadata';

import type { ComponentDocsContract } from '../../../apps/docs/src/component-docs';
import { defineComponentDocs } from '../../../apps/docs/src/component-docs';
import { generateComponentDocs } from '../../generators/component-docs/generate-component-docs';
import { generatedComponentDocsHeader } from '../../generators/component-docs/render';

import { checkGeneratedComponentDocsCompleteness } from './check-generated-component-docs';
import { runComponentCompletenessCheck } from './run';
import type { ComponentCompletenessResult } from './types';

const tempRoots: string[] = [];

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe('generated component docs completeness', () => {
  it('fails clearly when React generated docs are missing', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    const result = await checkGeneratedComponentDocsCompleteness({
      root: fixture.root,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result.ready).toBe(false);
    expect(details(result)).toEqual(
      expect.arrayContaining([
        'FixtureSwitch react: missing generated page apps/docs/src/react/fixture-switch.md.',
      ])
    );
  });

  it('fails clearly when React Native generated docs are missing', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react-native'],
    });

    const result = await checkGeneratedComponentDocsCompleteness({
      root: fixture.root,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result.ready).toBe(false);
    expect(details(result)).toEqual(
      expect.arrayContaining([
        'FixtureSwitch react-native: missing generated page apps/docs/src/react-native/fixture-switch.md.',
      ])
    );
  });

  it('uses metadata platform support for generated docs expectations', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
      contractPlatforms: ['react', 'react-native'],
    });

    const result = await checkGeneratedComponentDocsCompleteness({
      root: fixture.root,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result.ready).toBe(false);
    expect(details(result)).toContain(
      'FixtureSwitch: platforms.react-native is not supported by metadata.platforms for FixtureSwitch.'
    );
  });

  it('fails stale generated docs without rewriting them', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const original = fs.readFileSync(fixture.reactDoc, 'utf8');
    const stale = original.replace(
      'FixtureSwitch react summary.',
      'Stale generated summary.'
    );
    expect(stale).not.toBe(original);
    fs.writeFileSync(fixture.reactDoc, stale);
    const before = fs.readFileSync(fixture.reactDoc, 'utf8');

    const result = await checkGeneratedComponentDocsCompleteness({
      root: fixture.root,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result.ready).toBe(false);
    expect(details(result)).toEqual(
      expect.arrayContaining([
        'stale generated page apps/docs/src/react/fixture-switch.md. Run pnpm component-docs:generate.',
      ])
    );
    expect(fs.readFileSync(fixture.reactDoc, 'utf8')).toBe(before);
  });

  it('blocks authored text outside the managed region without rewriting it', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    fs.appendFileSync(fixture.reactDoc, '\nImportant manual guidance.\n');
    const before = fs.readFileSync(fixture.reactDoc, 'utf8');

    const result = await checkGeneratedComponentDocsCompleteness({
      root: fixture.root,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result.ready).toBe(false);
    expect(details(result)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'authored region end marker must terminate the document'
        ),
      ])
    );
    expect(fs.readFileSync(fixture.reactDoc, 'utf8')).toBe(before);
  });

  it('fails when derived navigation cannot resolve an expected page', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    const result = await checkGeneratedComponentDocsCompleteness({
      root: fixture.root,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(details(result)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'component-docs:check failed: Cannot create component docs navigation for FixtureSwitch react: missing generated docs page react/fixture-switch.md.'
        ),
      ])
    );
  });

  it('fails orphaned React generated pages safely', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react-native'],
      contractPlatforms: ['react-native'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });
    writeGeneratedPage(fixture.reactDoc);

    const result = await checkGeneratedComponentDocsCompleteness({
      root: fixture.root,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result.ready).toBe(false);
    expect(details(result)).toContain(
      'apps/docs/src/react/fixture-switch.md: orphaned generated page because ComponentMetadata.platforms does not include react.'
    );
  });

  it('fails orphaned React Native generated pages safely', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
      contractPlatforms: ['react'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });
    writeGeneratedPage(fixture.nativeDoc);

    const result = await checkGeneratedComponentDocsCompleteness({
      root: fixture.root,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result.ready).toBe(false);
    expect(details(result)).toContain(
      'apps/docs/src/react-native/fixture-switch.md: orphaned generated page because ComponentMetadata.platforms does not include react-native.'
    );
  });

  it('ignores generated docs for unrelated components in targeted completeness checks', async () => {
    const accordion = createFixture({
      componentName: 'FixtureAccordion',
      platforms: ['react'],
    });
    const switchFixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
      root: accordion.root,
      docsRoot: accordion.docsRoot,
    });

    await generateComponentDocs({
      root: accordion.root,
      docsRoot: accordion.docsRoot,
      metadata: [accordion.metadata, switchFixture.metadata],
      contracts: [accordion.contract, switchFixture.contract],
    });

    const results = await runComponentCompletenessCheck({
      root: accordion.root,
      metadata: [accordion.metadata],
      componentDocsContracts: [accordion.contract, switchFixture.contract],
      generatedDocsScope: 'targeted',
    });

    const generatedDocsResult = results.at(-1)!;

    expect(generatedDocsResult.componentName).toBe('Generated Component Docs');
    expect(generatedDocsResult.ready).toBe(true);
    expect(details(generatedDocsResult)).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('fixture-switch.md: orphaned generated page'),
      ])
    );
  });

  it('still detects an orphan generated page for the targeted component', async () => {
    const accordion = createFixture({
      componentName: 'FixtureAccordion',
      platforms: ['react'],
      contractPlatforms: ['react'],
    });

    await generateComponentDocs({
      root: accordion.root,
      docsRoot: accordion.docsRoot,
      metadata: [accordion.metadata],
      contracts: [accordion.contract],
    });

    writeGeneratedPage(accordion.nativeDoc);

    const results = await runComponentCompletenessCheck({
      root: accordion.root,
      metadata: [accordion.metadata],
      componentDocsContracts: [accordion.contract],
      generatedDocsScope: 'targeted',
    });

    const generatedDocsResult = results.at(-1)!;

    expect(generatedDocsResult.ready).toBe(false);
    expect(details(generatedDocsResult)).toContain(
      'apps/docs/src/react-native/fixture-accordion.md: orphaned generated page because ComponentMetadata.platforms does not include react-native.'
    );
  });

  it('rejects unregistered manual pages without rewriting', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const authoredPage = path.join(
      fixture.docsRoot,
      'react',
      'unregistered.md'
    );
    const original = '# Independent manual page\n';
    fs.writeFileSync(authoredPage, original);

    const result = await checkGeneratedComponentDocsCompleteness({
      root: fixture.root,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result.ready).toBe(false);
    expect(details(result)).toContain(
      'apps/docs/src/react/unregistered.md: unmanaged component docs page. Register a ComponentDocsContract and generate it, or add an explicitly reviewed standalone-page exception.'
    );
    expect(fs.readFileSync(authoredPage, 'utf8')).toBe(original);
  });

  it('allows only the reviewed standalone VitePress pages', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    for (const name of ['index.md', 'portal.md', 'theme-provider.md']) {
      fs.writeFileSync(
        path.join(fixture.docsRoot, 'react', name),
        '# Manual\n'
      );
    }

    const result = await checkGeneratedComponentDocsCompleteness({
      root: fixture.root,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result.ready).toBe(true);
  });

  it('rejects required metadata with no docs contract', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const result = await checkGeneratedComponentDocsCompleteness({
      root: fixture.root,
      metadata: [fixture.metadata, createMetadata('FixtureRadio', ['react'])],
      contracts: [fixture.contract],
    });

    expect(result.ready).toBe(false);
    expect(details(result)).toContain(
      'FixtureRadio: missing ComponentDocsContract for required documentation.'
    );
  });

  it('ignores unrelated unmanaged pages in targeted checks', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });
    fs.writeFileSync(
      path.join(fixture.docsRoot, 'react', 'unrelated.md'),
      '# Manual\n'
    );

    const results = await runComponentCompletenessCheck({
      root: fixture.root,
      metadata: [fixture.metadata],
      componentDocsContracts: [fixture.contract],
      generatedDocsScope: 'targeted',
    });

    expect(results.at(-1)?.ready).toBe(true);
  });

  it('returns generated docs failures from the local completeness path', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    const results = await runComponentCompletenessCheck({
      root: fixture.root,
      metadata: [fixture.metadata, createMetadata('FixtureInput', ['react'])],
      componentDocsContracts: [fixture.contract],
    });

    expect(results.at(-1)).toMatchObject({
      componentName: 'Generated Component Docs',
      ready: false,
    });
    expect(details(results.at(-1)!)).toEqual(
      expect.arrayContaining([
        'FixtureSwitch react: missing generated page apps/docs/src/react/fixture-switch.md.',
      ])
    );
  });

  it('reports generated docs messages in deterministic order', async () => {
    const zulu = createFixture({
      componentName: 'FixtureZulu',
      platforms: ['react'],
    });
    const alpha = createFixture({
      componentName: 'FixtureAlpha',
      platforms: ['react'],
      root: zulu.root,
      docsRoot: zulu.docsRoot,
    });

    const result = await checkGeneratedComponentDocsCompleteness({
      root: zulu.root,
      metadata: [zulu.metadata, alpha.metadata],
      contracts: [zulu.contract, alpha.contract],
    });

    expect(details(result).slice(0, 2)).toEqual([
      'component-docs:check failed: Cannot create component docs navigation for FixtureAlpha react: missing generated docs page react/fixture-alpha.md.\nCannot create component docs navigation for FixtureZulu react: missing generated docs page react/fixture-zulu.md.',
      'FixtureAlpha react: missing generated page apps/docs/src/react/fixture-alpha.md.',
    ]);
  });

  it('passes valid local Storybook references', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
      storybook: {
        title: 'Primitives/FixtureSwitch',
        story: 'Default',
      },
    });

    writeStorybookFile({
      root: fixture.root,
      metadata: fixture.metadata,
      platform: 'react',
      title: 'Primitives/FixtureSwitch',
      story: 'Default',
    });
    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const result = await checkGeneratedComponentDocsCompleteness({
      root: fixture.root,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result.ready).toBe(true);
  });

  it('fails invalid local Storybook references', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
      storybook: {
        title: 'Primitives/FixtureSwitch',
        story: 'MissingStory',
      },
    });

    writeStorybookFile({
      root: fixture.root,
      metadata: fixture.metadata,
      platform: 'react',
      title: 'Primitives/FixtureSwitch',
      story: 'Default',
    });
    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const result = await checkGeneratedComponentDocsCompleteness({
      root: fixture.root,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result.ready).toBe(false);
    expect(details(result)).toContain(
      'FixtureSwitch react: Storybook story "MissingStory" was not found in packages/react/src/primitives/FixtureSwitch/FixtureSwitch.stories.tsx.'
    );
  });
});

function createFixture(params: {
  componentName: string;
  platforms: readonly ComponentPlatform[];
  contractPlatforms?: readonly ComponentPlatform[];
  root?: string;
  docsRoot?: string;
  storybook?: {
    title: string;
    story: string;
  };
}) {
  const {
    componentName,
    platforms,
    contractPlatforms = platforms,
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-component-docs-')),
    docsRoot = path.join(root, 'apps', 'docs', 'src'),
    storybook,
  } = params;

  if (!tempRoots.includes(root)) {
    tempRoots.push(root);
  }

  const metadata = createMetadata(componentName, platforms);
  const contract = createContract({
    componentName,
    platforms: contractPlatforms,
    storybook,
  });

  writeApiFixtures(root, componentName, platforms);

  const slug = slugifyComponentName(componentName);

  return {
    root,
    docsRoot,
    metadata,
    contract,
    reactDoc: path.join(docsRoot, 'react', `${slug}.md`),
    nativeDoc: path.join(docsRoot, 'react-native', `${slug}.md`),
  };
}

function createMetadata(
  componentName: string,
  platforms: readonly ComponentPlatform[]
): ComponentMetadata {
  return {
    name: componentName,
    layer: 'primitives',
    category: 'form',
    platforms,
    profile: 'form-control',
    status: 'experimental',
    requirements: {
      tests: false,
      storybook: false,
      docs: true,
      accessibility: false,
    },
  };
}

function createContract(params: {
  componentName: string;
  platforms: readonly ComponentPlatform[];
  storybook?: {
    title: string;
    story: string;
  };
}): ComponentDocsContract {
  const { componentName, platforms, storybook } = params;

  return defineComponentDocs({
    component: componentName,
    platforms: Object.fromEntries(
      platforms.map((platform) => [
        platform,
        {
          title: `${componentName} ${platform}`,
          description: `${componentName} ${platform} generated documentation.`,
          summary: `${componentName} ${platform} summary.`,
          storybook: platform === 'react' ? storybook : undefined,
        },
      ])
    ),
  }) as ComponentDocsContract;
}

function writeApiFixtures(
  root: string,
  componentName: string,
  platforms: readonly ComponentPlatform[]
) {
  for (const platform of platforms) {
    const packageName = platform === 'react' ? 'react' : 'react-native';
    const packageDir = path.join(root, 'packages', packageName);
    const sourceRoot = path.join(packageDir, 'src');
    const packageIndexFile = path.join(sourceRoot, 'index.ts');
    const componentDir = path.join(sourceRoot, 'primitives', componentName);
    const componentFile = path.join(componentDir, `${componentName}.tsx`);
    const componentBarrelFile = path.join(componentDir, 'index.ts');
    const exportPath = `./primitives/${componentName}`;

    fs.mkdirSync(componentDir, { recursive: true });

    if (!fs.existsSync(componentFile)) {
      fs.writeFileSync(
        componentFile,
        [
          `export type ${componentName}Props = {`,
          '  checked?: boolean;',
          '};',
          '',
          `export function ${componentName}(_props: ${componentName}Props) {`,
          '  return null;',
          '}',
          '',
        ].join('\n')
      );
    }

    if (!fs.existsSync(componentBarrelFile)) {
      fs.writeFileSync(
        componentBarrelFile,
        [
          `export { ${componentName} } from './${componentName}';`,
          `export type { ${componentName}Props } from './${componentName}';`,
          '',
        ].join('\n')
      );
    }

    fs.mkdirSync(path.dirname(packageIndexFile), { recursive: true });

    const packageIndexContent = fs.existsSync(packageIndexFile)
      ? fs.readFileSync(packageIndexFile, 'utf8')
      : '';
    const publicExportLines = [
      `export { ${componentName} } from '${exportPath}';`,
      `export type { ${componentName}Props } from '${exportPath}';`,
    ];
    const missingPublicExports = publicExportLines.filter(
      (line) => !packageIndexContent.includes(line)
    );

    if (missingPublicExports.length > 0) {
      fs.writeFileSync(
        packageIndexFile,
        [packageIndexContent.trimEnd(), ...missingPublicExports, '']
          .filter(Boolean)
          .join('\n')
      );
    }

    const apiFile = path.join(packageDir, 'API.md');
    const apiPrefix = platform === 'react' ? 'web' : 'native';
    const apiId = `${apiPrefix}.${componentName}Props.${componentName}`;

    const existingContent = fs.existsSync(apiFile)
      ? fs.readFileSync(apiFile, 'utf8')
      : `# ${platform} API\n\n`;

    fs.writeFileSync(
      apiFile,
      [
        existingContent.trimEnd(),
        `<!-- api-docgen:start ${apiId} -->`,
        '',
        '| Prop | Type | Required | Description |',
        '| --- | --- | --- | --- |',
        '| checked | boolean | No | Controlled state. |',
        '',
        `<!-- api-docgen:end ${apiId} -->`,
        '',
      ].join('\n')
    );
  }
}

function writeGeneratedPage(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    ['---', 'title: Orphan', '---', '', generatedComponentDocsHeader, ''].join(
      '\n'
    )
  );
}

function writeStorybookFile(params: {
  root: string;
  metadata: ComponentMetadata;
  platform: ComponentPlatform;
  title: string;
  story: string;
}) {
  const { root, metadata, platform, title, story } = params;
  const storybookFile = path.join(
    root,
    'packages',
    platform === 'react' ? 'react' : 'react-native',
    'src',
    metadata.layer,
    metadata.name,
    `${metadata.name}.stories.tsx`
  );

  fs.mkdirSync(path.dirname(storybookFile), { recursive: true });
  fs.writeFileSync(
    storybookFile,
    [
      `const meta = {`,
      `  title: '${title}',`,
      `};`,
      '',
      'export default meta;',
      '',
      `export const ${story} = {};`,
      '',
    ].join('\n')
  );
}

function details(result: ComponentCompletenessResult) {
  return result.checks.flatMap((check) => check.details ?? []);
}

function slugifyComponentName(componentName: string) {
  return componentName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
