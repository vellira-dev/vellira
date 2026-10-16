import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  ComponentMetadata,
  ComponentPlatform,
} from '@vellira-ui/metadata';
import prettier from 'prettier';

import {
  componentDocsContracts,
  createGeneratedComponentDocsSidebarItems,
  validateComponentDocs,
  type ComponentDocsContract,
} from '../../../apps/docs/src/component-docs';
import { componentMetadata } from '../../../packages/metadata/src/components';

import { readComponentApiSections } from './api';
import { readAuthoredRegion } from './authored-region';
import { inspectComponentDocAuthority } from './legacy-adoption';
import { renderComponentDocPage } from './render';

export type ComponentDocsGenerationResult = {
  status: 'updated' | 'up-to-date' | 'stale';
  changedFiles: string[];
  checkedFiles: string[];
};

type GenerateComponentDocsParams = {
  root: string;
  check?: boolean;
  force?: boolean;
  componentName?: string;
  metadata?: readonly ComponentMetadata[];
  contracts?: readonly ComponentDocsContract[];
  docsRoot?: string;
};

const supportedPlatforms: readonly ComponentPlatform[] = [
  'react',
  'react-native',
];

const docsDirectoryByPlatform = {
  react: 'react',
  'react-native': 'react-native',
} as const satisfies Record<ComponentPlatform, string>;

export async function generateComponentDocs(
  params: GenerateComponentDocsParams
): Promise<ComponentDocsGenerationResult> {
  const {
    root,
    check = false,
    force = false,
    componentName,
    metadata = componentMetadata,
    contracts = componentDocsContracts,
    docsRoot = path.join(root, 'apps', 'docs', 'src'),
  } = params;
  const metadataByName = new Map(
    metadata.map((item) => [item.name, item] as const)
  );
  const contractsByName = new Map(
    contracts.map((contract) => [contract.component, contract] as const)
  );
  const selectedComponentNames = componentName
    ? [componentName]
    : [...contractsByName.keys()].sort();
  const changedFiles: string[] = [];
  const checkedFiles: string[] = [];
  const errors: string[] = [];

  // Check all selected platform files before writing any docs. Neither
  // --force nor --check may silently replace unmarked editorial guidance.
  const preflightErrors: string[] = [];

  for (const selectedComponentName of selectedComponentNames) {
    const selectedMetadata = metadataByName.get(selectedComponentName);

    if (!selectedMetadata) {
      continue;
    }

    for (const platform of supportedPlatforms) {
      if (!selectedMetadata.platforms.includes(platform)) {
        continue;
      }

      const relativeFilePath = path.join(
        'apps',
        'docs',
        'src',
        docsDirectoryByPlatform[platform],
        slugifyComponentName(selectedComponentName) + '.md'
      );
      const filePath = path.join(
        docsRoot,
        docsDirectoryByPlatform[platform],
        slugifyComponentName(selectedComponentName) + '.md'
      );
      const content = fs.existsSync(filePath)
        ? fs.readFileSync(filePath, 'utf8')
        : undefined;
      const inspection = inspectComponentDocAuthority({
        content,
        filePath: relativeFilePath,
      });

      if (inspection.state === 'legacy') {
        preflightErrors.push(
          relativeFilePath +
            ' is an unmarked legacy page. Refusing destructive overwrite' +
            (force ? ' even with --force' : '') +
            '. Use component-docs:adoption-audit and preserve existing guidance in a reviewed migration.'
        );
      } else {
        preflightErrors.push(...inspection.errors);
      }
    }
  }

  if (preflightErrors.length > 0) {
    throw new Error(preflightErrors.sort().join('\n'));
  }

  for (const selectedComponentName of selectedComponentNames) {
    const componentMetadata = metadataByName.get(selectedComponentName);
    const docsContract = contractsByName.get(selectedComponentName);

    if (!componentMetadata) {
      errors.push(
        `Cannot generate docs for ${selectedComponentName}: missing ComponentMetadata.`
      );
      continue;
    }

    if (!docsContract) {
      errors.push(
        `Cannot generate docs for ${selectedComponentName}: missing ComponentDocsContract.`
      );
      continue;
    }

    const validation = validateComponentDocs(docsContract, componentMetadata);

    if (!validation.valid) {
      errors.push(
        ...validation.errors.map(
          (error) => `${selectedComponentName}: ${error}`
        )
      );
      continue;
    }

    for (const platform of supportedPlatforms) {
      if (!componentMetadata.platforms.includes(platform)) {
        continue;
      }

      const platformDocs = docsContract.platforms[platform];

      if (!platformDocs) {
        errors.push(
          `Cannot generate docs for ${selectedComponentName} ${platform}: missing editorial docs for supported platform.`
        );
        continue;
      }

      const relativeFilePath = path.join(
        'apps',
        'docs',
        'src',
        docsDirectoryByPlatform[platform],
        `${slugifyComponentName(selectedComponentName)}.md`
      );
      const filePath = path.join(
        docsRoot,
        docsDirectoryByPlatform[platform],
        `${slugifyComponentName(selectedComponentName)}.md`
      );
      const currentContent = fs.existsSync(filePath)
        ? fs.readFileSync(filePath, 'utf8')
        : undefined;
      const authoredRegion = currentContent
        ? readAuthoredRegion({
            content: currentContent,
            filePath: relativeFilePath,
          })
        : undefined;

      if (authoredRegion && !authoredRegion.valid) {
        errors.push(...authoredRegion.errors);
        continue;
      }

      const apiSections = readComponentApiSections({
        root,
        componentName: selectedComponentName,
        platform,
      });
      const expectedContent = await formatMarkdown(
        filePath,
        renderComponentDocPage({
          componentName: selectedComponentName,
          platform,
          docs: platformDocs,
          apiSections,
          authoredContent: authoredRegion?.content ?? '',
        })
      );

      // TEMPORARY read-only diagnostic: remove after canonical Radio output is committed.
      if (
        check &&
        selectedComponentName === 'Radio' &&
        currentContent !== expectedContent
      ) {
        console.error(
          `RADIO_EXPECTED_${platform}_START\\n${expectedContent}RADIO_EXPECTED_${platform}_END`
        );
      }

      checkedFiles.push(path.relative(root, filePath));

      if (currentContent === expectedContent) {
        continue;
      }

      changedFiles.push(path.relative(root, filePath));

      if (check) {
        continue;
      }

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, expectedContent);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.sort().join('\n'));
  }

  for (const platform of supportedPlatforms) {
    createGeneratedComponentDocsSidebarItems({
      docsRoot,
      platform,
      metadata,
      contracts: selectedComponentNames.map((selectedComponentName) => {
        const contract = contractsByName.get(selectedComponentName);

        if (!contract) {
          throw new Error(
            `Cannot validate component docs navigation for ${selectedComponentName}: missing ComponentDocsContract.`
          );
        }

        return contract;
      }),
    });
  }

  return {
    status:
      changedFiles.length === 0 ? 'up-to-date' : check ? 'stale' : 'updated',
    changedFiles: changedFiles.sort(),
    checkedFiles: checkedFiles.sort(),
  };
}

async function formatMarkdown(filePath: string, content: string) {
  const config = await prettier.resolveConfig(filePath);

  return prettier.format(content, {
    ...config,
    filepath: filePath,
    parser: 'markdown',
  });
}

function slugifyComponentName(componentName: string) {
  return componentName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function printHelp() {
  console.log(
    `
Vellira VitePress component docs generator

Usage:
  pnpm component-docs:generate [ComponentName] [options]

Options:
  --check    Check generated component docs without writing files
  --force    Re-render managed docs only; never overwrite unmarked legacy pages
  --help     Show this help message
  -h         Alias for --help

Examples:
  pnpm component-docs:generate
  pnpm component-docs:generate Switch --force
  pnpm component-docs:generate Switch --check
`.trim()
  );
}

async function runCli() {
  const args = process.argv.slice(2);
  const help = args.includes('--help') || args.includes('-h');
  const check = args.includes('--check');
  const force = args.includes('--force');
  const supportedOptions = new Set(['--check', '--force', '--help', '-h']);
  const unknownOptions = args.filter(
    (arg) => arg.startsWith('-') && !supportedOptions.has(arg)
  );
  const componentNames = args.filter((arg) => !arg.startsWith('-'));

  if (help) {
    printHelp();
    process.exit(0);
  }

  if (unknownOptions.length > 0) {
    console.error(`Unknown option: ${unknownOptions.join(', ')}`);
    console.error('');
    printHelp();
    process.exit(1);
  }

  if (componentNames.length > 1) {
    console.error(
      `Expected at most one component name, received: ${componentNames.join(', ')}.`
    );
    console.error('');
    printHelp();
    process.exit(1);
  }

  try {
    const result = await generateComponentDocs({
      root: process.cwd(),
      check,
      force,
      componentName: componentNames[0],
    });

    if (check && result.status === 'stale') {
      console.error('Generated component docs are out of date:');

      for (const filePath of result.changedFiles) {
        console.error(`  - ${filePath}`);
      }

      process.exit(1);
    }

    if (result.status === 'up-to-date') {
      console.log('Generated component docs are up to date.');
      process.exit(0);
    }

    console.log('Generated component docs:');

    for (const filePath of result.changedFiles) {
      console.log(`  - ${filePath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const isCli =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  await runCli();
}
