import fs from 'node:fs';
import path from 'node:path';

import { formatGeneratedContent } from '../../format-generated-files';

import {
  escapeRegExp,
  identifierFromSlug,
  objectPropertyKey,
} from '../helpers/format';
import type { GeneratedPageModel } from '../model/types';
import type { CatalogCategory } from '../profiles/profiles';

export function insertAfterMarker(params: {
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

    if (check) {
      if (nextSource !== source) {
        checkFailures.push(path.relative(root, filePath));
      }

      return;
    }

    fs.writeFileSync(filePath, nextSource);

    console.log(`♻️ Updated registry: ${existsCheck}`);
    return;
  }

  if (!source.includes(marker)) {
    console.error(`Marker not found in ${filePath}: ${marker}`);
    process.exit(1);
  }

  const nextSource = source.replace(marker, `${marker}\n${content}`);

  if (check) {
    if (nextSource !== source) {
      checkFailures.push(path.relative(root, filePath));
    }

    return;
  }

  fs.writeFileSync(filePath, nextSource);

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
    demos: {
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

  return `  {
    slug: '${model.slug}',
    name: '${model.componentName}',
    description: '${model.componentName} component for Vellira applications.',
    category: '${catalogCategory}',
    status: 'beta',
    order: 999,
    platforms: [${model.platforms.map((platform) => `'${platform}'`).join(', ')}],
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
  componentsRegistryFile: string;
  model: GeneratedPageModel;
  catalogCategory: CatalogCategory;
}) {
  const {
    root,
    force,
    check,
    checkFailures,
    componentsRegistryFile,
    model,
    catalogCategory,
  } = params;
  const source = fs.readFileSync(componentsRegistryFile, 'utf8');
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
      existingEntry.includes(
        `description: '${model.componentName} component for Vellira applications.'`
      ) &&
      existingEntry.includes("status: 'beta'") &&
      existingEntry.includes('order: 999');

    if (!force || !isGeneratedEntry) {
      console.log(`⏭ Skipped component catalog registration: ${model.slug}`);
      return;
    }

    const nextSource =
      source.slice(0, entryStart + 1) + entry + source.slice(entryEnd);

    const formattedNextSource = await formatGeneratedContent(
      componentsRegistryFile,
      nextSource
    );

    if (check) {
      if (formattedNextSource !== source) {
        checkFailures.push(path.relative(root, componentsRegistryFile));
      }

      return;
    }

    fs.writeFileSync(componentsRegistryFile, formattedNextSource);

    console.log(`♻️ Updated component catalog registration: ${model.slug}`);

    return;
  }

  const marker = '] as const satisfies readonly ComponentCatalogEntry[];';

  if (!source.includes(marker)) {
    console.error(
      `Component catalog marker not found in ${componentsRegistryFile}`
    );
    process.exit(1);
  }

  const nextSource = source.replace(marker, `${entry}${marker}`);
  const formattedNextSource = await formatGeneratedContent(
    componentsRegistryFile,
    nextSource
  );

  if (check) {
    if (formattedNextSource !== source) {
      checkFailures.push(path.relative(root, componentsRegistryFile));
    }

    return;
  }

  fs.writeFileSync(componentsRegistryFile, formattedNextSource);
  console.log(`✅ Updated: ${path.relative(root, componentsRegistryFile)}`);
}

export async function updateCatalogPreviewFallback(params: {
  root: string;
  check: boolean;
  checkFailures: string[];
  catalogPreviewFile: string;
  catalogPreviewFallbackFile: string;
  model: GeneratedPageModel;
}) {
  const {
    root,
    check,
    checkFailures,
    catalogPreviewFile,
    catalogPreviewFallbackFile,
    model,
  } = params;
  const curatedSource = fs.readFileSync(catalogPreviewFile, 'utf8');
  const source = fs.readFileSync(catalogPreviewFallbackFile, 'utf8');
  const curatedCase = `case '${model.slug}':`;
  const marker = '// component-catalog-preview-entries';
  const entryMarker = `// component-catalog-preview:${model.slug}`;
  const hasCuratedPreview = curatedSource.includes(curatedCase);
  const hasGeneratedPreview = source.includes(entryMarker);

  if (hasCuratedPreview) {
    if (hasGeneratedPreview) {
      throw new Error(
        `Duplicate component catalog preview ownership for ${model.slug}. Remove the generated fallback when adding a curated preview.`
      );
    }
    console.log(`⏭ Skipped generated catalog preview: curated ${model.slug}`);
    return;
  }

  if (!model.platforms.includes('react')) {
    throw new Error(
      `Component ${model.componentName} requires a curated Web catalog preview because it has no React demo.`
    );
  }

  if (hasGeneratedPreview) {
    console.log(`⏭ Skipped generated catalog preview: ${model.slug}`);
    return;
  }

  if (!source.includes(marker)) {
    throw new Error(
      `Catalog preview marker not found in ${catalogPreviewFallbackFile}`
    );
  }

  const entry = `${entryMarker}\n  ${JSON.stringify(model.slug)}: React.lazy(() =>\n    import('../../components/${model.componentName}').then(\n      ({ ${model.componentName}Demo }) => ({ default: ${model.componentName}Demo })\n    )\n  ),`;
  const nextSource = source.replace(marker, `${marker}\n${entry}`);
  const formattedNextSource = await formatGeneratedContent(
    catalogPreviewFallbackFile,
    nextSource
  );

  if (check) {
    if (formattedNextSource !== source) {
      checkFailures.push(path.relative(root, catalogPreviewFallbackFile));
    }
    return;
  }

  fs.writeFileSync(catalogPreviewFallbackFile, formattedNextSource);
  console.log(`✅ Updated: ${path.relative(root, catalogPreviewFallbackFile)}`);
}

export async function updateComponentRegistry(params: {
  root: string;
  force: boolean;
  check: boolean;
  checkFailures: string[];
  componentCatalogDir: string;
  componentPagesFile: string;
  componentsRegistryFile: string;
  catalogPreviewFile: string;
  catalogPreviewFallbackFile: string;
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
    catalogPreviewFile,
    catalogPreviewFallbackFile,
    catalogCategory,
    model,
  } = params;

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

  insertAfterMarker({
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
    componentsRegistryFile,
    model,
    catalogCategory,
  });

  await updateCatalogPreviewFallback({
    root,
    check,
    checkFailures,
    catalogPreviewFile,
    catalogPreviewFallbackFile,
    model,
  });
}
