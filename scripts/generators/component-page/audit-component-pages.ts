import fs from 'node:fs';
import path from 'node:path';

import { getGeneratedComponentPageComponents } from './component-page-components';
import { resolvePageInput } from './model/resolve-page-input';
import {
  loadComponentMetadata,
  validateComponentMetadata,
  validateRelatedComponentSlugs,
} from './metadata/metadata';

type AuditFailure = {
  componentName: string;
  message: string;
};

const root = process.cwd();
const componentFlagIndex = process.argv.indexOf('--component');
const requestedComponentName =
  componentFlagIndex === -1 ? undefined : process.argv[componentFlagIndex + 1];

if (componentFlagIndex !== -1 && !requestedComponentName) {
  console.error('Usage: component-pages:audit [--component ComponentName]');
  process.exit(1);
}

const allGeneratedComponentPageComponents =
  getGeneratedComponentPageComponents(root);

if (
  requestedComponentName &&
  !allGeneratedComponentPageComponents.includes(requestedComponentName)
) {
  console.error('Component page audit failed:');
  console.error(
    `  - ${requestedComponentName}: component is not a generated component page`
  );
  process.exit(1);
}

const generatedComponentPageComponents = requestedComponentName
  ? [requestedComponentName]
  : allGeneratedComponentPageComponents;
const catalogRoot = path.join(
  root,
  'apps',
  'website',
  'src',
  'component-catalog'
);
const catalogComponentsRoot = path.join(catalogRoot, 'components');

const failures: AuditFailure[] = [];

function slugify(componentName: string) {
  return componentName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRegistryEntryPattern(slug: string, flags = '') {
  return new RegExp(
    `\\n\\s*(?:${escapeRegExp(slug)}|${escapeRegExp(
      `'${slug}'`
    )}|${escapeRegExp(`"${slug}"`)}): \\{`,
    flags
  );
}

function readGeneratedFile(componentName: string, kind: string) {
  const filePath = path.join(
    catalogRoot,
    'components',
    componentName,
    `${componentName}${kind}.tsx`
  );

  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function addFailure(componentName: string, message: string) {
  failures.push({ componentName, message });
}

function getEntrySource(componentName: string, componentPagesSource: string) {
  const slug = slugify(componentName);
  const entryStartMatch = componentPagesSource.match(
    getRegistryEntryPattern(slug)
  );
  const entryStart =
    entryStartMatch?.index !== undefined ? entryStartMatch.index + 1 : -1;

  if (entryStart === -1) {
    return null;
  }

  const nextEntryMatch = componentPagesSource
    .slice(entryStart + 1)
    .match(/\n {2}(?:[A-Za-z_$][\w$]*|'[^']+'|"[^"]+"): \{/);
  const registryEndMatch = componentPagesSource
    .slice(entryStart)
    .match(/\n} satisfies/);
  const entryEnd =
    nextEntryMatch?.index !== undefined
      ? entryStart + 1 + nextEntryMatch.index
      : registryEndMatch?.index !== undefined
        ? entryStart + registryEndMatch.index
        : -1;

  return entryEnd === -1
    ? null
    : componentPagesSource.slice(entryStart, entryEnd);
}

function countMatches(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].length;
}

function auditComponent(componentName: string, componentPagesSource: string) {
  const slug = slugify(componentName);
  const apiFile = path.join(
    catalogRoot,
    'components',
    componentName,
    `${slug}Api.ts`
  );
  const usage = readGeneratedFile(componentName, 'Usage');
  const examples = readGeneratedFile(componentName, 'Examples');
  const accessibility = readGeneratedFile(componentName, 'Accessibility');
  const entry = getEntrySource(componentName, componentPagesSource);

  if (!usage) addFailure(componentName, 'missing Usage file');
  if (!examples) addFailure(componentName, 'missing Examples file');
  if (!accessibility) addFailure(componentName, 'missing Accessibility file');
  if (!fs.existsSync(apiFile)) addFailure(componentName, 'missing API file');
  if (!entry) addFailure(componentName, 'missing componentPages entry');

  if (
    entry &&
    countMatches(componentPagesSource, getRegistryEntryPattern(slug, 'g')) !== 1
  ) {
    addFailure(componentName, 'duplicate componentPages entries');
  }

  const apiSource = fs.existsSync(apiFile)
    ? fs.readFileSync(apiFile, 'utf8')
    : '';

  if (apiSource.includes("description: ''")) {
    addFailure(componentName, 'API contains empty description');
  }

  if (apiSource.includes(`description: 'Prop for ${componentName}.`)) {
    addFailure(componentName, 'API contains generic fallback description');
  }

  if (
    apiSource.includes('inheritedProps: inheritedReact') &&
    apiSource.includes('inheritedProps: inheritedNative')
  ) {
    // Shape check only; empty inherited arrays are valid for components with no inherited props.
  } else {
    addFailure(componentName, 'API is missing platform inheritedProps shape');
  }
}

const componentPagesFile = path.join(
  catalogRoot,
  'registry',
  'componentPages.ts'
);
const componentPagesSource = fs.readFileSync(componentPagesFile, 'utf8');
for (const match of componentPagesSource.matchAll(
  /\n\s*(?:([A-Za-z_$][\w$]*)|'([^']+)'|"([^"]+)"): \{[\s\S]*?related: \[([^\]]*)\]/g
)) {
  const componentSlug = match[1] ?? match[2] ?? match[3] ?? 'componentPages';
  const relatedSource = match[4] ?? '';
  const relatedSlugs = [...relatedSource.matchAll(/'([^']+)'/g)].map(
    (item) => item[1]
  );

  for (const message of validateRelatedComponentSlugs({
    componentName: componentSlug,
    related: relatedSlugs,
  })) {
    addFailure('componentPages', message);
  }
}

for (const componentName of generatedComponentPageComponents) {
  const metadata = await loadComponentMetadata({
    catalogComponentsRoot,
    componentName,
  });

  let metadataValid = true;

  try {
    validateComponentMetadata({ componentName, metadata });
  } catch (error) {
    metadataValid = false;
    addFailure(
      componentName,
      error instanceof Error ? error.message : 'invalid metadata'
    );
  }

  if (metadataValid) {
    try {
      await resolvePageInput({
        root,
        catalogComponentsRoot,
        componentName,
      });
    } catch (error) {
      addFailure(
        componentName,
        `effective generator input invalid: ${
          error instanceof Error ? error.message : 'unknown generator error'
        }`
      );
    }
  }

  auditComponent(componentName, componentPagesSource);
}

if (failures.length > 0) {
  console.error('Component page audit failed:');

  for (const failure of failures) {
    console.error(`  - ${failure.componentName}: ${failure.message}`);
  }

  process.exit(1);
}

console.log(
  `Component page audit passed for ${generatedComponentPageComponents.length} components.`
);
