import fs from 'node:fs';
import path from 'node:path';

import { formatGeneratedFiles } from '../format-generated-files';

import {
  generatedFileHeader,
  getCatalogPaths,
  getVelliraApiSourceRoots,
} from './helpers/paths';
import { createFileWriter } from './helpers/writer';
import { buildGeneratedPageModel } from './model/build-page-model';
import { resolvePageInput } from './model/resolve-page-input';
import {
  buildAccessibilityItems,
  renderAccessibility,
} from './renderers/accessibility';
import { buildApiFile } from './renderers/api';
import { renderComponentIndex } from './renderers/component-index';
import { renderDemoFiles } from './renderers/demo';
import { buildExamples, renderExamples } from './renderers/examples';
import {
  componentPageProfiles,
  generatorComponentCategories,
  type ComponentProfile,
  type GeneratorComponentCategory,
} from './profiles/profiles';
import { buildPlaygroundArtifacts } from './renderers/playground';
import { updateComponentRegistry } from './renderers/registry';
import { renderUsage } from './renderers/usage';

const [, , componentName, ...args] = process.argv;

const force = args.includes('--force');
const check = args.includes('--check');
const json = args.includes('--json');
const profileFlag = args.find((arg) => arg.startsWith('--profile='));
const profileValue = profileFlag?.slice('--profile='.length);

if (
  profileValue &&
  !componentPageProfiles.includes(profileValue as ComponentProfile)
) {
  console.error(
    `Invalid component page profile "${profileValue}". Expected: ${componentPageProfiles.join(', ')}.`
  );
  process.exit(1);
}

const requestedProfile = profileValue as ComponentProfile | undefined;

const categoryFlag = args.find((arg) => arg.startsWith('--category='));
const categoryValue = categoryFlag?.slice('--category='.length);

if (
  categoryValue &&
  !generatorComponentCategories.includes(
    categoryValue as GeneratorComponentCategory
  )
) {
  console.error(
    `Invalid component category "${categoryValue}". Expected: ${generatorComponentCategories.join(', ')}.`
  );
  process.exit(1);
}

const requestedCategory = categoryValue as
  GeneratorComponentCategory | undefined;

const help =
  componentName === '--help' ||
  componentName === '-h' ||
  args.includes('--help') ||
  args.includes('-h');

const helpText = `
Vellira component page generator

Usage:
  pnpm create:component-page <ComponentName> [options]

Options:
  --force    Overwrite existing generated files
  --check    Check whether generated files are up to date without writing
  --json     Emit a machine-readable check result
  --profile  Override inferred component profile
  --category Override inferred catalog category
  --help     Show this help message
  -h         Alias for --help

Examples:
  pnpm create:component-page Button
  pnpm create:component-page Tabs --force
  pnpm create:component-page Accordion --force --profile=compound
  pnpm create:component-page Select --check
`;

if (help) {
  console.log(helpText.trim());
  process.exit(0);
}

if (!componentName) {
  console.error(helpText.trim());
  process.exit(1);
}

if (!componentName) {
  console.error(
    'Usage: pnpm create:component-page ComponentName [--force] [--check]'
  );
  process.exit(1);
}

const root = process.cwd();

const writeJsonResult = (result: {
  componentName: string;
  status: 'up-to-date' | 'stale';
  staleFiles: string[];
}) => {
  process.stdout.write(
    `${JSON.stringify(
      {
        schemaVersion: '1',
        ...result,
      },
      null,
      2
    )}\n`
  );
};

if (json) {
  console.log = () => {};
}

const {
  catalogRoot,
  catalogComponentsRoot,
  catalogRegistryFile,
  componentsRegistryFile,
  componentPresentationRegistryFile,
  componentCatalogDir,
  slug,
} = getCatalogPaths({ root, componentName });

const velliraApiSourceRoots = getVelliraApiSourceRoots(root);

const fileWriter = createFileWriter({ root, force, check });
const { checkFailures, writeIfMissing } = fileWriter;

const {
  componentConfig,
  componentProfile,
  catalogCategory,
  extractedProps,
  playgroundProps,
  platforms,
  reactApiProps,
  nativeApiProps,
  reactPlaygroundApiProps,
  nativePlaygroundApiProps,
  getDemoProps,
  getChangeHandlerName,
} = await resolvePageInput({
  root,
  catalogComponentsRoot,
  componentName,
  requireRelatedDecision: true,
  requestedProfile,
  requestedCategory,
});

if (platforms.length === 0) {
  console.error(
    `Component "${componentName}" was not found in react or react-native packages.`
  );
  process.exit(1);
}

const usageFile = path.join(componentCatalogDir, `${componentName}Usage.tsx`);

const { content: usageContent, children: usageChildren } = renderUsage({
  componentName,
  componentConfig,
  playgroundProps,
  reactApiProps: reactPlaygroundApiProps,
  nativeApiProps: nativePlaygroundApiProps,
  generatedFileHeader,
  getDemoProps,
});

const reactUsageChildren = usageChildren.react ?? '';
const nativeUsageChildren = usageChildren['react-native'] ?? '';

await writeIfMissing(usageFile, usageContent);

const examplesFile = path.join(
  componentCatalogDir,
  `${componentName}Examples.tsx`
);

const generatedExamples = buildExamples({
  componentName,
  componentConfig,
  componentProfile,
  extractedProps,
  playgroundProps,
});

const examplesContent = renderExamples({
  componentName,
  platforms,
  componentConfig,
  generatedExamples,
  generatedFileHeader,
  reactApiProps,
  nativeApiProps,
  getDemoProps,
});

await writeIfMissing(examplesFile, examplesContent);

const accessibilityFile = path.join(
  componentCatalogDir,
  `${componentName}Accessibility.tsx`
);

const reactAccessibilityItems = buildAccessibilityItems({
  platform: 'react',
  componentConfig,
  componentProfile,
  extractedProps,
  reactApiProps,
  nativeApiProps,
});

const nativeAccessibilityItems = buildAccessibilityItems({
  platform: 'react-native',
  componentConfig,
  componentProfile,
  extractedProps,
  reactApiProps,
  nativeApiProps,
});

const accessibilityContent = renderAccessibility({
  componentName,
  reactAccessibilityItems,
  nativeAccessibilityItems,
  generatedFileHeader,
});

await writeIfMissing(accessibilityFile, accessibilityContent);

const apiFile = path.join(componentCatalogDir, `${slug}Api.ts`);

const {
  content: apiContent,
  reactSplit,
  nativeSplit,
  reactApiSections,
  nativeApiSections,
} = buildApiFile({
  root,
  componentName,
  slug,
  componentConfig,
  extractedProps,
  reactApiProps,
  nativeApiProps,
  velliraApiSourceRoots,
  generatedFileHeader,
});

await writeIfMissing(apiFile, apiContent);

const playgroundSchemaFile = path.join(
  componentCatalogDir,
  `${slug}PlaygroundSchema.ts`
);

const playgroundFile = path.join(
  componentCatalogDir,
  `${componentName}Playground.tsx`
);

const playgroundArtifacts = buildPlaygroundArtifacts({
  componentName,
  slug,
  componentConfig,
  playgroundProps,
  reactApiProps: reactPlaygroundApiProps,
  nativeApiProps: nativePlaygroundApiProps,
  generatedFileHeader,
  getChangeHandlerName,
});

await writeIfMissing(playgroundSchemaFile, playgroundArtifacts.schemaContent);
await writeIfMissing(playgroundFile, playgroundArtifacts.content);

const reactStaticDemoProps = getDemoProps('react');
const nativeStaticDemoProps = getDemoProps('react-native');
const reactDemoChildren = componentConfig.react?.children ?? '';
const nativeDemoChildren = componentConfig.native?.children ?? '';
const nativeResponsivePresentation =
  componentConfig.native?.responsivePresentation === true;
const relatedComponents = componentConfig.related ?? [];
const generatedPageModel = buildGeneratedPageModel({
  componentName,
  slug,
  platforms,
  discovery: componentConfig.discovery,
  reactStaticDemoProps,
  nativeStaticDemoProps,
  reactDemoChildren,
  nativeDemoChildren,
  reactImports: componentConfig.react?.imports ?? [],
  nativeImports: componentConfig.native?.imports ?? [],
  nativeResponsivePresentation,
  playgroundProps,
  playgroundInitialValues: playgroundArtifacts.initialValues,
  reactUsageChildren,
  nativeUsageChildren,
  generatedExamples,
  reactAccessibilityItems,
  nativeAccessibilityItems,
  reactApiSections,
  nativeApiSections,
  reactInheritedProps: reactSplit.inheritedProps,
  nativeInheritedProps: nativeSplit.inheritedProps,
  relatedComponents,
});

const reactDemoFile = path.join(
  componentCatalogDir,
  `${componentName}Demo.tsx`
);
const nativeDemoFile = path.join(
  componentCatalogDir,
  `Native${componentName}Demo.tsx`
);

const demoFiles = renderDemoFiles({
  componentName,
  componentConfig,
  platforms,
  playgroundProps,
  reactApiProps,
  nativeApiProps,
  reactPlaygroundPropBindings: playgroundArtifacts.reactPropBindings,
  nativePlaygroundPropBindings: playgroundArtifacts.nativePropBindings,
  reactStaticDemoProps,
  nativeStaticDemoProps,
  reactDemoChildren,
  nativeDemoChildren,
  nativeResponsivePresentation,
  generatedFileHeader,
  getChangeHandlerName,
});

if (demoFiles.reactContent) {
  await writeIfMissing(reactDemoFile, demoFiles.reactContent);
}

if (demoFiles.nativeContent) {
  await writeIfMissing(nativeDemoFile, demoFiles.nativeContent);
}

const componentIndexFile = path.join(componentCatalogDir, 'index.ts');

const componentIndexContent = renderComponentIndex({
  componentName,
  slug,
  platforms,
  generatedFileHeader,
});

await writeIfMissing(componentIndexFile, componentIndexContent);

const registryFiles = [catalogRegistryFile, componentPresentationRegistryFile];

const registrySourcesBefore = check
  ? null
  : new Map(
      registryFiles.map((filePath) => [
        filePath,
        fs.readFileSync(filePath, 'utf8'),
      ])
    );

await updateComponentRegistry({
  root,
  force,
  check,
  checkFailures,
  componentCatalogDir,
  componentPagesFile: catalogRegistryFile,
  componentsRegistryFile,
  componentPresentationRegistryFile,
  catalogCategory,
  model: generatedPageModel,
});

if (registrySourcesBefore) {
  const changedRegistryFiles = registryFiles.filter(
    (filePath) =>
      fs.readFileSync(filePath, 'utf8') !== registrySourcesBefore.get(filePath)
  );

  await formatGeneratedFiles(changedRegistryFiles);
}

if (check) {
  if (checkFailures.length > 0) {
    if (json) {
      writeJsonResult({
        componentName,
        status: 'stale',
        staleFiles: [...new Set(checkFailures)].sort(),
      });
      process.exit(1);
    }

    console.error('Generated component page files are out of date:');

    for (const filePath of [...new Set(checkFailures)].sort()) {
      console.error(`  - ${filePath}`);
    }

    process.exit(1);
  }

  if (json) {
    writeJsonResult({
      componentName,
      status: 'up-to-date',
      staleFiles: [],
    });
    process.exit(0);
  }

  console.log(`Generated component page is up to date: ${componentName}`);
  process.exit(0);
}

console.log('Extracted props:', extractedProps);

console.log(`Component: ${componentName}`);
console.log(`Slug: ${slug}`);
console.log(`Platforms: ${platforms.join(', ')}`);
console.log(`Catalog root: ${catalogRoot}`);
