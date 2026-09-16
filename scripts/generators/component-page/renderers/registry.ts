import fs from 'node:fs';
import path from 'node:path';

import { formatGeneratedContent } from '../../format-generated-files';

import {
  escapeRegExp,
  identifierFromSlug,
  objectPropertyKey,
} from '../helpers/format';
import { generatedFileHeader } from '../helpers/paths';
import type { GeneratedPageModel } from '../model/types';
import type { CatalogCategory } from '../profiles/profiles';
import {
  requiresGeneratedCatalogPreview,
  synchronizeGeneratedCatalogPreview,
  synchronizeGeneratedCatalogPreviewRegistry,
} from './catalog-preview-registry';

export async function insertAfterMarker(params: {
  root: string;
  force: boolean;
  check: boolean;
  checkFailures: string[];
  filePath: string;
  marker: string;
  content: string;
  existsCheck: string;
  slug: string;
}) {
  const {
    root,
    force,
    check,
    checkFailures,
    filePath,
    marker,
    content,
    existsCheck,
    slug,
  } = params;
  const originalSource = fs.readFileSync(filePath, 'utf8');
  const source = originalSource;

  const entryPattern = new RegExp(
    `\\n\\s*(?:${escapeRegExp(slug)}|${escapeRegExp(
      `'${slug}'`
    )}|${escapeRegExp(`"${slug}"`)}): \\{`
  );

  if (source.includes(existsCheck) || entryPattern.test(source)) {
    if (!force) {
      console.log(`⏭ Skipped registry update: ${existsCheck}`);
      return;
    }

    const entryStartMatch = source.match(entryPattern);
    const entryStart =
      entryStartMatch?.index !== undefined ? entryStartMatch.index + 1 : -1;

    if (entryStart === -1) {
      console.error(`Existing registry entry not found for ${slug}`);
      process.exit(1);
    }

    const nextEntryMatch = source
      .slice(entryStart + 1)
      .match(/\n {2}(?:[A-Za-z_$][\w$]*|'[^']+'|"[^"]+"): \{/);

    const registryEndMatch = source
      .slice(entryStart)
      .match(/\n}(?: satisfies [^;]+)?;/);

    const entryEnd =
      nextEntryMatch?.index !== undefined
        ? entryStart + 1 + nextEntryMatch.index
        : registryEndMatch?.index !== undefined
          ? entryStart + registryEndMatch.index
          : -1;

    if (entryEnd === -1) {
      console.error(`Could not determine registry entry boundary for ${slug}`);
      process.exit(1);
    }

    const nextSource =
      source.slice(0, entryStart) + content + source.slice(entryEnd);
    const formattedNextSource = await formatGeneratedContent(
      filePath,
      nextSource
    );

    if (check) {
      if (formattedNextSource !== source) {
        checkFailures.push(path.relative(root, filePath));
      }

      return;
    }

    fs.writeFileSync(filePath, formattedNextSource);

    console.log(`♻️ Updated registry: ${existsCheck}`);
    return;
  }

  if (!source.includes(marker)) {
    console.error(`Marker not found in ${filePath}: ${marker}`);
    process.exit(1);
  }

  const nextSource = source.replace(marker, `${marker}\n${content}`);
  const formattedNextSource = await formatGeneratedContent(filePath, nextSource);

  if (check) {
    if (formattedNextSource !== source) {
      checkFailures.push(path.relative(root, filePath));
    }

    return;
  }

  fs.writeFileSync(filePath, formattedNextSource);

  console.log(`✅ Updated: ${path.relative(root, filePath)}`);
}

export function insertMissingLinesAfterMarker(params: {
  root: string;
  check: boolean;
  checkFailures: string[];
  componentName: string;
  filePath: string;
  marker: string;
  lines: string[];
}) {
  const { root, check, checkFailures, componentName, filePath, marker, lines } =
    params;

  const originalSource = fs.readFileSync(filePath, 'utf8');
  let source = originalSource;

  if (!source.includes(marker)) {
    console.error(`Marker not found in ${filePath}: ${marker}`);
    process.exit(1);
  }

  const missingLines = lines.filter((line) => !source.includes(line));

  if (missingLines.length === 0) {
    console.log('⏭ Skipped registry imports: already present');
    return;
  }

  source = source.replace(
    new RegExp(
      `\\nimport \\{[^;]*?\\} from '../components/${escapeRegExp(
        componentName
      )}';`,
      'g'
    ),
    ''
  );

  const nextSource = source.replace(
    marker,
    `${marker}\n${missingLines.join('\n')}`
  );

  if (check) {
    if (nextSource !== originalSource) {
      checkFailures.push(path.relative(root, filePath));
    }

    return;
  }

  fs.writeFileSync(filePath, nextSource);

  console.log(`✅ Updated imports: ${path.relative(root, filePath)}`);
}

function renderDiscoverySource(discovery: GeneratedPageModel['discovery']) {
  if (!discovery) {
    return '';
  }

  return `    discovery: ${JSON.stringify(discovery)},\n`;
}

export function renderPageConfigSnippet(model: GeneratedPageModel) {
  const slugIdentifier = identifierFromSlug(model.slug);
  const demoEntries = [
    model.platforms.includes('react')
      ? `      react: ${model.componentName}Demo,`
      : null,
    model.platforms.includes('react-native')
      ? `      'react-native': Native${model.componentName}Demo,`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `
  ${objectPropertyKey(model.slug)}: {
    name: '${model.componentName}',
${renderDiscoverySource(model.discovery)}    demos: {
${demoEntries}
    },
    Usage: ${model.componentName}Usage,
    Examples: ${model.componentName}Examples,
    Accessibility: ${model.componentName}Accessibility,
    api: ${slugIdentifier}Api,
    related: ${
      model.related.length > 0
        ? `[${model.related.map((item) => `'${item}'`).join(', ')}]`
        : '[]'
    },
  },
`;
}

export function renderCatalogEntry(params: {
  model: GeneratedPageModel;
  catalogCategory: CatalogCategory;
}) {
  const { model, catalogCategory } = params;
  const docsEntries = model.platforms
    .map(
      (platform) =>
        `      '${platform}': 'https://docs.vellira.dev/${platform}/${model.slug}',`
    )
    .join('\n');
  const description =
    model.discovery?.description ??
    `${model.componentName} component for Vellira applications.`;

  return `  {
    component: '${model.componentName}',
    slug: '${model.slug}',
    name: '${model.componentName}',
    description: ${JSON.stringify(description)},
    category: '${catalogCategory}',
    order: 999,
    docs: {
${docsEntries}
    },
  },
`;
}

export async function updateCatalogRegistry(params: {
  root: string;
  force: boolean;
  check: boolean;
  checkFailures: string[];
  componentPresentationRegistryFile: string;
  model: GeneratedPageModel;
  catalogCategory: CatalogCategory;
}) {
  const {
    root,
    force,
    check,
    checkFailures,
    componentPresentationRegistryFile,
    model,
    catalogCategory,
  } = params;
  const source = fs.readFileSync(componentPresentationRegistryFile, 'utf8');
  const entry = renderCatalogEntry({ model, catalogCategory });
  const slugMarker = `slug: '${model.slug}'`;

  if (source.includes(slugMarker)) {
    const slugIndex = source.indexOf(slugMarker);
    const entryStart = source.lastIndexOf('\n  {', slugIndex);

    if (entryStart < 0) {
      console.error(
        `Could not determine component catalog entry start for ${model.slug}`
      );
      process.exit(1);
    }

    let depth = 0;
    let entryEnd = -1;

    for (let index = entryStart + 1; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;

      if (source[index] === '}') {
        depth -= 1;

        if (depth === 0) {
          entryEnd = index + 1;

          if (source[entryEnd] === ',') entryEnd += 1;
          if (source[entryEnd] === '\n') entryEnd += 1;

          break;
        }
      }
    }

    if (entryEnd < 0) {
      console.error(
        `Could not determine component catalog entry end for ${model.slug}`
      );
      process.exit(1);
    }

    const existingEntry = source.slice(entryStart + 1, entryEnd);

    const isGeneratedEntry =
      existingEntry.includes(`component: '${model.componentName}'`) &&
      existingEntry.includes('order: 999');

    if (!force || !isGeneratedEntry) {
      console.log(`⏭ Skipped component catalog registration: ${model.slug}`);
      return;
    }

    const nextSource =
      source.slice(0, entryStart + 1) + entry + source.slice(entryEnd);

    const formattedNextSource = await formatGeneratedContent(
      componentPresentationRegistryFile,
      nextSource
    );

    if (check) {
      if (formattedNextSource !== source) {
        checkFailures.push(
          path.relative(root, componentPresentationRegistryFile)
        );
      }

      return;
    }

    fs.writeFileSync(componentPresentationRegistryFile, formattedNextSource);

    console.log(`♻️ Updated component catalog registration: ${model.slug}`);

    return;
  }

  const marker =
    '] as const satisfies readonly ComponentCatalogPresentationEntry[];';

  if (!source.includes(marker)) {
    console.error(
      `Component catalog marker not found in ${componentPresentationRegistryFile}`
    );
    process.exit(1);
  }

  const nextSource = source.replace(marker, `${entry}${marker}`);
  const formattedNextSource = await formatGeneratedContent(
    componentPresentationRegistryFile,
    nextSource
  );

  if (check) {
    if (formattedNextSource !== source) {
      checkFailures.push(
        path.relative(root, componentPresentationRegistryFile)
      );
    }

    return;
  }

  fs.writeFileSync(componentPresentationRegistryFile, formattedNextSource);
  console.log(
    `✅ Updated: ${path.relative(root, componentPresentationRegistryFile)}`
  );
}

export async function updateComponentRegistry(params: {
  root: string;
  force: boolean;
  check: boolean;
  checkFailures: string[];
  componentCatalogDir: string;
  componentPagesFile: string;
  componentsRegistryFile: string;
  componentPresentationRegistryFile: string;
  catalogCategory: CatalogCategory;
  model: GeneratedPageModel;
}) {
  const {
    root,
    force,
    check,
    checkFailures,
    componentCatalogDir,
    componentPagesFile,
    componentsRegistryFile,
    componentPresentationRegistryFile,
    catalogCategory,
    model,
  } = params;

  await synchronizeGeneratedCatalogPreview({
    root,
    check,
    checkFailures,
    componentCatalogDir,
    componentPresentationRegistryFile,
    model,
    generatedFileHeader,
  });

  const catalogPreviewFile = path.join(
    componentCatalogDir,
    `${model.componentName}CatalogPreview.tsx`
  );
  const generatedCatalogPreviewRequired = requiresGeneratedCatalogPreview({
    componentPresentationRegistryFile,
    model,
  });

  if (generatedCatalogPreviewRequired && !fs.existsSync(catalogPreviewFile)) {
    const relativePreviewFile = path.relative(root, catalogPreviewFile);

    if (check) {
      if (!checkFailures.includes(relativePreviewFile)) {
        checkFailures.push(relativePreviewFile);
      }
    } else {
      console.error(
        `Catalog signature preview is required before registering ${model.componentName}: ${relativePreviewFile}`
      );
      process.exit(1);
    }
  }

  await synchronizeGeneratedCatalogPreviewRegistry({
    root,
    check,
    checkFailures,
    componentCatalogDir,
    componentsRegistryFile,
  });

  const requiredDemoFiles = [
    model.platforms.includes('react')
      ? path.join(componentCatalogDir, `${model.componentName}Demo.tsx`)
      : null,
    model.platforms.includes('react-native')
      ? path.join(componentCatalogDir, `Native${model.componentName}Demo.tsx`)
      : null,
  ].filter((filePath): filePath is string => Boolean(filePath));

  const missingDemoFiles = requiredDemoFiles.filter(
    (filePath) => !fs.existsSync(filePath)
  );

  if (missingDemoFiles.length > 0) {
    console.log('\n⚠️ Registry update skipped. Missing website demos:');

    for (const filePath of missingDemoFiles) {
      console.log(`   - ${path.relative(root, filePath)}`);
    }

    return;
  }

  const registryImportNames = [
    `${model.componentName}Accessibility`,
    model.platforms.includes('react') ? `${model.componentName}Demo` : null,
    `${model.componentName}Examples`,
    `${model.componentName}Usage`,
    model.platforms.includes('react-native')
      ? `Native${model.componentName}Demo`
      : null,
    `${identifierFromSlug(model.slug)}Api`,
  ].filter((name): name is string => Boolean(name));

  const registryImports = [
    `import {
${registryImportNames.map((name) => `  ${name},`).join('\n')}
} from '../components/${model.componentName}';`,
  ];

  insertMissingLinesAfterMarker({
    root,
    check,
    checkFailures,
    componentName: model.componentName,
    filePath: componentPagesFile,
    marker: '// component-page-imports',
    lines: registryImports,
  });

  await insertAfterMarker({
    root,
    force,
    check,
    checkFailures,
    filePath: componentPagesFile,
    marker: '// component-page-entries',
    content: renderPageConfigSnippet(model).trimEnd().replace(/^\n/, ''),
    existsCheck: `${objectPropertyKey(model.slug)}: {`,
    slug: model.slug,
  });

  await updateCatalogRegistry({
    root,
    force,
    check,
    checkFailures,
    componentPresentationRegistryFile,
    model,
    catalogCategory,
  });
}
