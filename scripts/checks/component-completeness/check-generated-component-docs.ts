import fs from 'node:fs';
import path from 'node:path';

import type {
  ComponentMetadata,
  ComponentPlatform,
} from '@vellira-ui/metadata';

import type { ComponentDocsContract } from '../../../apps/docs/src/component-docs';
import {
  componentDocsContracts,
  validateComponentDocs,
} from '../../../apps/docs/src/component-docs';
import { generateComponentDocs } from '../../generators/component-docs/generate-component-docs';
import { generatedComponentDocsHeader } from '../../generators/component-docs/render';

import type {
  ComponentCheckResult,
  ComponentCompletenessResult,
} from './types';

const supportedPlatforms: readonly ComponentPlatform[] = [
  'react',
  'react-native',
];

const docsDirectoryByPlatform = {
  react: 'react',
  'react-native': 'react-native',
} as const satisfies Record<ComponentPlatform, string>;

const packageNameByPlatform = {
  react: 'react',
  'react-native': 'react-native',
} as const satisfies Record<ComponentPlatform, string>;

export async function checkGeneratedComponentDocsCompleteness(params: {
  root: string;
  metadata: readonly ComponentMetadata[];
  contracts?: readonly ComponentDocsContract[];
  orphanComponentNames?: readonly string[];
}): Promise<ComponentCompletenessResult> {
  const {
    root,
    metadata,
    contracts = componentDocsContracts,
    orphanComponentNames,
  } = params;
  const checks: ComponentCheckResult[] = [];

  checks.push(...checkExpectedDocs({ root, metadata, contracts }));
  checks.push(...checkCanonicalDocsContractCoverage({ metadata, contracts }));
  checks.push(...checkStorybookReferences({ root, metadata, contracts }));
  checks.push(
    ...(await checkGeneratedDocsFreshness({ root, metadata, contracts }))
  );
  checks.push(
    ...checkUnregisteredComponentDocsPages({
      root,
      metadata,
      contracts,
      orphanComponentNames,
    })
  );
  checks.push(
    ...checkOrphanedGeneratedDocs({
      root,
      metadata,
      contracts,
      orphanComponentNames,
    })
  );

  const orderedChecks = checks.sort(compareChecks);

  return {
    componentName: 'Generated Component Docs',
    ready: orderedChecks.every((check) => check.ok),
    checks: orderedChecks,
  };
}

// VitePress overviews are not component pages. Portal and ThemeProvider are
// intentional independent pages, not components in the canonical metadata
// registry. All other component pages must be covered by docs contracts.
const standaloneDocsPageNames = new Set([
  'index.md',
  'portal.md',
  'theme-provider.md',
]);

function checkCanonicalDocsContractCoverage(params: {
  metadata: readonly ComponentMetadata[];
  contracts: readonly ComponentDocsContract[];
}): ComponentCheckResult[] {
  const contracts = new Set(params.contracts.map((item) => item.component));

  return params.metadata
    .filter((item) => item.requirements.docs && !contracts.has(item.name))
    .map((item) => ({
      name: 'component-docs' as const,
      ok: false,
      details: `${item.name}: missing ComponentDocsContract for required documentation.`,
    }));
}

function checkUnregisteredComponentDocsPages(params: {
  root: string;
  metadata: readonly ComponentMetadata[];
  contracts: readonly ComponentDocsContract[];
  orphanComponentNames?: readonly string[];
}): ComponentCheckResult[] {
  const { root, metadata, contracts, orphanComponentNames } = params;
  const expectedPaths = new Set<string>();
  const targetedSlugs = orphanComponentNames
    ? new Set(orphanComponentNames.map(slugifyComponentName))
    : undefined;
  const checks: ComponentCheckResult[] = [];

  for (const contract of contracts) {
    const component = metadata.find((item) => item.name === contract.component);
    if (!component) continue;

    for (const platform of component.platforms) {
      expectedPaths.add(
        expectedGeneratedDocPath({
          root,
          componentName: component.name,
          platform,
        }).absolutePath
      );
    }
  }

  for (const platform of supportedPlatforms) {
    const docsDir = path.join(root, 'apps', 'docs', 'src', platform);
    if (!fs.existsSync(docsDir)) continue;

    for (const fileName of fs.readdirSync(docsDir).sort(compareCodeUnit)) {
      if (!fileName.endsWith('.md') || standaloneDocsPageNames.has(fileName)) {
        continue;
      }

      const absolutePath = path.join(docsDir, fileName);
      if (!fs.statSync(absolutePath).isFile() || expectedPaths.has(absolutePath)) {
        continue;
      }

      // Generated orphans have their own more specific failing check.
      if (fs.readFileSync(absolutePath, 'utf8').includes(generatedComponentDocsHeader)) {
        continue;
      }

      const slug = fileName.slice(0, -'.md'.length);
      if (targetedSlugs && !targetedSlugs.has(slug)) continue;

      checks.push({
        name: 'component-docs',
        platform,
        ok: false,
        details: `${path.relative(root, absolutePath)}: unmanaged component docs page. Register a ComponentDocsContract and generate it, or add an explicitly reviewed standalone-page exception.`,
      });
    }
  }

  return checks;
}

function checkExpectedDocs(params: {
  root: string;
  metadata: readonly ComponentMetadata[];
  contracts: readonly ComponentDocsContract[];
}) {
  const { root, metadata, contracts } = params;
  const metadataByName = new Map(
    metadata.map((item) => [item.name, item] as const)
  );
  const checks: ComponentCheckResult[] = [];

  for (const contract of contracts) {
    const componentMetadata = metadataByName.get(contract.component);

    if (!componentMetadata) {
      checks.push({
        name: 'component-docs',
        ok: false,
        details: `${contract.component}: missing ComponentMetadata for registered generated docs contract.`,
      });
      continue;
    }

    const validation = validateComponentDocs(contract, componentMetadata);

    if (!validation.valid) {
      checks.push(
        ...validation.errors.map((error) => ({
          name: 'component-docs' as const,
          ok: false,
          details: `${contract.component}: ${error}`,
        }))
      );
      continue;
    }

    for (const platform of componentMetadata.platforms) {
      const expectedFile = expectedGeneratedDocPath({
        root,
        componentName: componentMetadata.name,
        platform,
      });

      checks.push({
        name: 'component-docs',
        platform,
        ok: fs.existsSync(expectedFile.absolutePath),
        details: fs.existsSync(expectedFile.absolutePath)
          ? undefined
          : `${componentMetadata.name} ${platform}: missing generated page ${expectedFile.relativePath}.`,
      });
    }
  }

  return checks;
}

async function checkGeneratedDocsFreshness(params: {
  root: string;
  metadata: readonly ComponentMetadata[];
  contracts: readonly ComponentDocsContract[];
}) {
  const { root, metadata, contracts } = params;
  const checks: ComponentCheckResult[] = [];

  try {
    const result = await generateComponentDocs({
      root,
      check: true,
      metadata,
      contracts,
    });

    if (result.status === 'stale') {
      checks.push(
        ...result.changedFiles.map((filePath) => ({
          name: 'component-docs' as const,
          ok: false,
          details: `stale generated page ${filePath}. Run pnpm component-docs:generate.`,
        }))
      );
    } else {
      checks.push({
        name: 'component-docs',
        ok: true,
      });
    }
  } catch (error) {
    checks.push({
      name: 'component-docs',
      ok: false,
      details: `component-docs:check failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }

  return checks;
}

function checkOrphanedGeneratedDocs(params: {
  root: string;
  metadata: readonly ComponentMetadata[];
  contracts: readonly ComponentDocsContract[];
  orphanComponentNames?: readonly string[];
}) {
  const { root, metadata, contracts, orphanComponentNames } = params;
  const metadataBySlug = new Map(
    metadata.map((item) => [slugifyComponentName(item.name), item] as const)
  );
  const contractSlugs = new Set(
    contracts.map((contract) => slugifyComponentName(contract.component))
  );
  const orphanScopeSlugs = orphanComponentNames
    ? new Set(orphanComponentNames.map(slugifyComponentName))
    : undefined;
  const expectedFiles = new Set<string>();
  const checks: ComponentCheckResult[] = [];

  for (const contract of contracts) {
    const componentMetadata = metadata.find(
      (item) => item.name === contract.component
    );

    if (!componentMetadata) {
      continue;
    }

    for (const platform of componentMetadata.platforms) {
      expectedFiles.add(
        expectedGeneratedDocPath({
          root,
          componentName: componentMetadata.name,
          platform,
        }).absolutePath
      );
    }
  }

  for (const platform of supportedPlatforms) {
    const docsDir = path.join(
      root,
      'apps',
      'docs',
      'src',
      docsDirectoryByPlatform[platform]
    );

    if (!fs.existsSync(docsDir)) {
      continue;
    }

    const fileNames = fs
      .readdirSync(docsDir)
      .filter((fileName) => fileName.endsWith('.md'))
      .sort(compareCodeUnit);

    for (const fileName of fileNames) {
      const absolutePath = path.join(docsDir, fileName);
      const content = fs.readFileSync(absolutePath, 'utf8');

      if (!content.includes(generatedComponentDocsHeader)) {
        continue;
      }

      if (expectedFiles.has(absolutePath)) {
        continue;
      }

      const relativePath = path.relative(root, absolutePath);
      const componentSlug = fileName.replace(/\.md$/, '');

      if (orphanScopeSlugs && !orphanScopeSlugs.has(componentSlug)) {
        continue;
      }

      const componentMetadata = metadataBySlug.get(componentSlug);

      checks.push({
        name: 'component-docs',
        platform,
        ok: false,
        details: orphanReason({
          relativePath,
          platform,
          componentMetadata,
          hasDocsContract: contractSlugs.has(componentSlug),
        }),
      });
    }
  }

  return checks;
}

function checkStorybookReferences(params: {
  root: string;
  metadata: readonly ComponentMetadata[];
  contracts: readonly ComponentDocsContract[];
}) {
  const { root, metadata, contracts } = params;
  const metadataByName = new Map(
    metadata.map((item) => [item.name, item] as const)
  );
  const checks: ComponentCheckResult[] = [];

  for (const contract of contracts) {
    const componentMetadata = metadataByName.get(contract.component);

    if (!componentMetadata) {
      continue;
    }

    for (const platform of supportedPlatforms) {
      const platformDocs = contract.platforms[platform];

      if (!platformDocs?.storybook) {
        continue;
      }

      const storybookFile = path.join(
        root,
        'packages',
        packageNameByPlatform[platform],
        'src',
        componentMetadata.layer,
        componentMetadata.name,
        `${componentMetadata.name}.stories.tsx`
      );

      if (!fs.existsSync(storybookFile)) {
        checks.push({
          name: 'component-docs',
          platform,
          ok: false,
          details: `${componentMetadata.name} ${platform}: missing Storybook file for generated docs reference ${path.relative(
            root,
            storybookFile
          )}.`,
        });
        continue;
      }

      const content = fs.readFileSync(storybookFile, 'utf8');
      const titlePattern = new RegExp(
        `title:\\s*['"\`]${escapeRegExp(platformDocs.storybook.title)}['"\`]`
      );
      const storyPattern = new RegExp(
        `export\\s+const\\s+${escapeRegExp(platformDocs.storybook.story)}\\b`
      );

      if (!titlePattern.test(content)) {
        checks.push({
          name: 'component-docs',
          platform,
          ok: false,
          details: `${componentMetadata.name} ${platform}: Storybook title "${platformDocs.storybook.title}" was not found in ${path.relative(
            root,
            storybookFile
          )}.`,
        });
      }

      if (!storyPattern.test(content)) {
        checks.push({
          name: 'component-docs',
          platform,
          ok: false,
          details: `${componentMetadata.name} ${platform}: Storybook story "${platformDocs.storybook.story}" was not found in ${path.relative(
            root,
            storybookFile
          )}.`,
        });
      }
    }
  }

  return checks;
}

function expectedGeneratedDocPath(params: {
  root: string;
  componentName: string;
  platform: ComponentPlatform;
}) {
  const { root, componentName, platform } = params;
  const relativePath = path.join(
    'apps',
    'docs',
    'src',
    docsDirectoryByPlatform[platform],
    `${slugifyComponentName(componentName)}.md`
  );

  return {
    relativePath,
    absolutePath: path.join(root, relativePath),
  };
}

function orphanReason(params: {
  relativePath: string;
  platform: ComponentPlatform;
  componentMetadata?: ComponentMetadata;
  hasDocsContract: boolean;
}) {
  const { relativePath, platform, componentMetadata, hasDocsContract } = params;

  if (!componentMetadata) {
    return `${relativePath}: orphaned generated page for unknown component.`;
  }

  if (!componentMetadata.platforms.includes(platform)) {
    return `${relativePath}: orphaned generated page because ComponentMetadata.platforms does not include ${platform}.`;
  }

  if (!hasDocsContract) {
    return `${relativePath}: orphaned generated page because no ComponentDocsContract is registered.`;
  }

  return `${relativePath}: orphaned generated page is no longer expected.`;
}

function slugifyComponentName(componentName: string) {
  return componentName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function compareChecks(a: ComponentCheckResult, b: ComponentCheckResult) {
  return (
    compareCodeUnit(a.platform ?? '', b.platform ?? '') ||
    compareCodeUnit(a.details ?? '', b.details ?? '')
  );
}

function compareCodeUnit(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
