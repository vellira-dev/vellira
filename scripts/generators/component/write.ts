import fs from 'node:fs';
import path from 'node:path';

import {
  renderIndexTemplate,
  renderManualTestTemplate,
  renderMetadataTemplate,
  renderNativeStylesTemplate,
  renderSharedFormControlTypesTemplate,
  renderStoryTemplate,
  renderStylesTemplate,
  renderTestTemplate,
} from './templates';

import { formatGeneratedFiles } from '../format-generated-files';

import {
  createComponentTestCoverageContract,
  renderComponentTestCoverageContract,
} from './coverage-contract';
import {
  preserveManualComponentTests,
  restoreManualComponentTests,
} from './manual-test-ownership';
import {
  generateComponentDocumentation,
  registerComponentDocsContract,
  renderComponentDocsContract,
} from './docs';
import {
  createComponentMetadataFromPlan,
  createMetadataTemplateParamsFromPlan,
  resolvePlanCapabilities,
} from './metadata';
import { resolveComponentTemplates } from './resolve-templates';
import { resolvePartTemplates } from './resolve-part-templates';
import { renderSynchronizedPublicApiContract } from './public-api-contract';
import { getGeneratedPublicPropTypeNames } from './public-api';
import { ensureComponentTokenContract } from './component-token-contract';

import {
  shouldGenerateVisualScaffold,
  type ComponentGenerationPlan,
  type ComponentGenerationTarget,
} from './plan';

export type ComponentGenerationResult = {
  createdFiles: string[];
  updatedFiles: string[];
};

function writeFile(params: {
  filePath: string;
  content: string;
  createdFiles: string[];
}) {
  const { filePath, content, createdFiles } = params;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  createdFiles.push(filePath);
}

function writeGeneratedFile(params: {
  filePath: string;
  content: string;
  createdFiles: string[];
  updatedFiles: string[];
}) {
  const { filePath, content, createdFiles, updatedFiles } = params;
  const exists = fs.existsSync(filePath);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);

  if (exists) {
    if (!updatedFiles.includes(filePath)) {
      updatedFiles.push(filePath);
    }

    return;
  }

  createdFiles.push(filePath);
}

function writePart(params: {
  plan: ComponentGenerationPlan;
  target: ComponentGenerationTarget;
  partName: string;
  result: ComponentGenerationResult;
}) {
  const { plan, target, partName, result } = params;

  const partDir = path.join(target.componentDir, partName);
  const partComponentName = `${plan.componentName}${partName}`;

  const templates = resolvePartTemplates({
    plan,
    target,
    partName,
  });

  fs.mkdirSync(partDir, { recursive: true });

  writeFile({
    filePath: path.join(partDir, 'types.ts'),
    content: templates.types,
    createdFiles: result.createdFiles,
  });

  writeFile({
    filePath: path.join(partDir, 'index.ts'),
    content: templates.index,
    createdFiles: result.createdFiles,
  });

  writeFile({
    filePath: path.join(partDir, `${partComponentName}.tsx`),
    content: templates.component,
    createdFiles: result.createdFiles,
  });
}

const EXPORT_FROM_STATEMENT_PATTERN =
  /export(?:\s+type)?\s+(?:\{[\s\S]*?\}|\*)\s+from\s+['"][^'"]+['"];/g;

const NAMED_IMPORT_STATEMENT_PATTERN =
  /^import \{[^}\n]+\} from ['"][^'"]+['"];$/gm;

function moduleSpecifierFromStatement(statement: string): string {
  const match = statement.match(/\bfrom\s+['"]([^'"]+)['"];/);

  if (!match?.[1]) {
    throw new Error(
      `Unable to resolve module specifier from generated registration: ${statement}`
    );
  }

  return match[1];
}

function insertSortedModuleStatement(params: {
  content: string;
  statement: string;
  pattern: RegExp;
}): string {
  const { content, statement, pattern } = params;

  if (content.includes(statement)) {
    return content;
  }

  const source = moduleSpecifierFromStatement(statement);
  const matches = [...content.matchAll(pattern)];

  if (matches.length === 0) {
    return content.length === 0
      ? `${statement}\n`
      : `${content.trimEnd()}\n${statement}\n`;
  }

  let previousSource: string | null = null;

  for (const match of matches) {
    const matchedStatement = match[0];
    const matchedSource = moduleSpecifierFromStatement(matchedStatement);

    if (previousSource !== null && matchedSource < previousSource) {
      throw new Error(
        'Existing generated registration statements are not in canonical module order.'
      );
    }

    previousSource = matchedSource;

    if (matchedSource > source) {
      if (match.index === undefined) {
        throw new Error(
          'Unable to resolve generated registration insertion point.'
        );
      }

      return (
        content.slice(0, match.index) +
        `${statement}\n` +
        content.slice(match.index)
      );
    }
  }

  const last = matches.at(-1);

  if (!last || last.index === undefined) {
    throw new Error('Unable to resolve generated registration append point.');
  }

  const insertAt = last.index + last[0].length;

  const nextContent =
    content.slice(0, insertAt) + `\n${statement}` + content.slice(insertAt);

  return nextContent.endsWith('\n') ? nextContent : `${nextContent}\n`;
}

function insertSortedExportStatement(
  content: string,
  exportLine: string
): string {
  return insertSortedModuleStatement({
    content,
    statement: exportLine,
    pattern: EXPORT_FROM_STATEMENT_PATTERN,
  });
}

function insertSortedNamedImport(content: string, importLine: string): string {
  const source = moduleSpecifierFromStatement(importLine);
  const matches = [...content.matchAll(NAMED_IMPORT_STATEMENT_PATTERN)];

  if (content.includes(importLine)) {
    return content;
  }

  if (matches.length === 0) {
    return `${importLine}\n\n${content}`;
  }

  let previousSource: string | null = null;

  for (const match of matches) {
    const matchedSource = moduleSpecifierFromStatement(match[0]);

    if (previousSource !== null && matchedSource < previousSource) {
      throw new Error(
        'Existing metadata imports are not in canonical module order.'
      );
    }

    previousSource = matchedSource;

    if (matchedSource > source) {
      if (match.index === undefined) {
        throw new Error('Unable to resolve metadata import insertion point.');
      }

      return (
        content.slice(0, match.index) +
        `${importLine}\n` +
        content.slice(match.index)
      );
    }
  }

  const last = matches.at(-1);

  if (!last || last.index === undefined) {
    throw new Error('Unable to resolve metadata import append point.');
  }

  const insertAt = last.index + last[0].length;

  return (
    content.slice(0, insertAt) + `\n${importLine}` + content.slice(insertAt)
  );
}

function updateBarrel(params: {
  barrelFile: string;
  exportLine: string;
  updatedFiles: string[];
}) {
  const { barrelFile, exportLine, updatedFiles } = params;

  const content = fs.existsSync(barrelFile)
    ? fs.readFileSync(barrelFile, 'utf8')
    : '';

  if (content.includes(exportLine)) {
    return;
  }

  const nextContent = insertSortedExportStatement(content, exportLine);

  fs.mkdirSync(path.dirname(barrelFile), { recursive: true });
  fs.writeFileSync(barrelFile, nextContent);
  updatedFiles.push(barrelFile);
}

function synchronizePublicApiContract(params: {
  componentName: string;
  publicApiTestFile: string;
  updatedFiles: string[];
}) {
  const { componentName, publicApiTestFile, updatedFiles } = params;

  const nextContent = renderSynchronizedPublicApiContract({
    componentName,
    publicApiTestFile,
  });
  const content = fs.readFileSync(publicApiTestFile, 'utf8');

  if (content === nextContent) {
    return;
  }

  fs.writeFileSync(publicApiTestFile, nextContent);

  if (!updatedFiles.includes(publicApiTestFile)) {
    updatedFiles.push(publicApiTestFile);
  }
}

function registerPackageRootExports(params: {
  plan: ComponentGenerationPlan;
  target: ComponentGenerationTarget;
  result: ComponentGenerationResult;
}) {
  const { plan, target, result } = params;
  const exportPath = `./${plan.layer}/${plan.componentName}`;

  for (const propTypeName of getGeneratedPublicPropTypeNames(plan)) {
    updateBarrel({
      barrelFile: target.packageBarrelFile,
      exportLine: `export type { ${propTypeName} } from '${exportPath}';`,
      updatedFiles: result.updatedFiles,
    });
  }

  updateBarrel({
    barrelFile: target.packageBarrelFile,
    exportLine: `export { ${plan.componentName} } from '${exportPath}';`,
    updatedFiles: result.updatedFiles,
  });

  synchronizePublicApiContract({
    componentName: plan.componentName,
    publicApiTestFile: target.publicApiTestFile,
    updatedFiles: result.updatedFiles,
  });
}

function writeSharedTypes(params: {
  plan: ComponentGenerationPlan;
  result: ComponentGenerationResult;
}) {
  const { plan, result } = params;

  if (plan.profile !== 'form-control') {
    return;
  }

  writeFile({
    filePath: plan.sharedTypesFile,
    content: renderSharedFormControlTypesTemplate({
      componentName: plan.componentName,
      control: plan.control,
    }),
    createdFiles: result.createdFiles,
  });

  const sharedFileName = path.basename(plan.sharedTypesFile, '.ts');

  updateBarrel({
    barrelFile: plan.sharedTypesBarrelFile,
    exportLine: `export * from './${sharedFileName}';`,
    updatedFiles: result.updatedFiles,
  });
}

function writeComponentTokens(params: {
  plan: ComponentGenerationPlan;
  result: ComponentGenerationResult;
}) {
  ensureComponentTokenContract(params);
}

function writeTarget(params: {
  plan: ComponentGenerationPlan;
  target: ComponentGenerationTarget;
  result: ComponentGenerationResult;
}) {
  const { plan, target, result } = params;
  const { componentName } = plan;
  const capabilities = resolvePlanCapabilities(plan);
  const preservedManualTests = preserveManualComponentTests(
    target.componentDir
  );

  if (fs.existsSync(target.componentDir)) {
    fs.rmSync(target.componentDir, {
      recursive: true,
      force: true,
    });
  }

  fs.mkdirSync(target.componentDir, { recursive: true });

  for (const partName of plan.parts) {
    writePart({
      plan,
      target,
      partName,
      result,
    });
  }

  const templates = resolveComponentTemplates({
    plan,
    target,
  });

  writeFile({
    filePath: path.join(target.componentDir, 'types.ts'),
    content: templates.types,
    createdFiles: result.createdFiles,
  });

  writeFile({
    filePath: path.join(target.componentDir, 'index.ts'),
    content: renderIndexTemplate({ componentName, parts: plan.parts }),
    createdFiles: result.createdFiles,
  });

  writeFile({
    filePath: path.join(target.componentDir, `${componentName}.tsx`),
    content: templates.component,
    createdFiles: result.createdFiles,
  });

  writeFile({
    filePath: path.join(target.componentDir, `${componentName}.stories.tsx`),
    content: renderStoryTemplate({
      componentName,
      layer: plan.layer,
      isNative: target.isNative,
      profile: plan.profile,
      control: plan.control,
      capabilities,
      parts: plan.parts,
    }),
    createdFiles: result.createdFiles,
  });

  writeFile({
    filePath: path.join(target.componentDir, `${componentName}.test.tsx`),
    content: renderTestTemplate({
      componentName,
      isNative: target.isNative,
      profile: plan.profile,
      control: plan.control,
      capabilities,
      parts: plan.parts,
    }),
    createdFiles: result.createdFiles,
  });

  const coverageContract = createComponentTestCoverageContract({
    componentName,
    profile: plan.profile,
    control: plan.control,
    capabilities,
    parts: plan.parts,
    isNative: target.isNative,
  });

  writeFile({
    filePath: path.join(
      target.componentDir,
      `${componentName}.test-contract.json`
    ),
    content: renderComponentTestCoverageContract(coverageContract),
    createdFiles: result.createdFiles,
  });

  if (
    coverageContract.componentSpecific.required &&
    preservedManualTests.length === 0
  ) {
    writeFile({
      filePath: path.join(
        target.componentDir,
        `${componentName}.manual.test.tsx`
      ),
      content: renderManualTestTemplate({
        componentName,
        isNative: target.isNative,
        requirements: coverageContract.componentSpecific.requirements,
      }),
      createdFiles: result.createdFiles,
    });
  }

  if (shouldGenerateVisualScaffold(plan)) {
    writeFile({
      filePath: path.join(
        target.componentDir,
        target.isNative
          ? `${componentName}.styles.ts`
          : `${componentName}.module.scss`
      ),
      content: target.isNative
        ? renderNativeStylesTemplate({
            componentName,
            profile: plan.profile,
            control: plan.control,
          })
        : renderStylesTemplate({
            componentName,
            profile: plan.profile,
            control: plan.control,
          }),
      createdFiles: result.createdFiles,
    });
  }

  restoreManualComponentTests({
    componentDir: target.componentDir,
    tests: preservedManualTests,
  });

  for (const test of preservedManualTests) {
    const restoredPath = path.join(target.componentDir, test.relativePath);

    if (!result.updatedFiles.includes(restoredPath)) {
      result.updatedFiles.push(restoredPath);
    }
  }

  updateBarrel({
    barrelFile: target.barrelFile,
    exportLine: `export * from './${componentName}';`,
    updatedFiles: result.updatedFiles,
  });

  registerPackageRootExports({ plan, target, result });
}

function registerMetadata(params: {
  metadataBarrelFile: string;
  componentName: string;
  updatedFiles: string[];
}) {
  const { metadataBarrelFile, componentName, updatedFiles } = params;

  const metadataName = `${componentName[0].toLowerCase()}${componentName.slice(1)}Metadata`;
  const importLine = `import { ${metadataName} } from './${componentName}.metadata';`;

  let content = fs.readFileSync(metadataBarrelFile, 'utf8');

  if (!content.includes(importLine)) {
    content = insertSortedNamedImport(content, importLine);
  }

  const registryMarker = 'export const componentMetadata = [';
  const registryStart = content.indexOf(registryMarker);

  if (registryStart === -1) {
    throw new Error(
      `Missing componentMetadata registry in ${metadataBarrelFile}`
    );
  }

  const registryEnd = content.indexOf('] as const;', registryStart);

  if (registryEnd === -1) {
    throw new Error(
      `Invalid componentMetadata registry in ${metadataBarrelFile}`
    );
  }

  const registryContent = content.slice(registryStart, registryEnd);
  const registryEntry = `  ${metadataName},`;

  if (!registryContent.includes(registryEntry)) {
    content =
      content.slice(0, registryEnd) +
      `${registryEntry}\n` +
      content.slice(registryEnd);
  }

  fs.writeFileSync(metadataBarrelFile, content);

  if (!updatedFiles.includes(metadataBarrelFile)) {
    updatedFiles.push(metadataBarrelFile);
  }
}

function writeMetadata(params: {
  plan: ComponentGenerationPlan;
  result: ComponentGenerationResult;
}) {
  const { plan, result } = params;

  writeFile({
    filePath: plan.metadataFile,
    content: renderMetadataTemplate(createMetadataTemplateParamsFromPlan(plan)),
    createdFiles: result.createdFiles,
  });

  registerMetadata({
    metadataBarrelFile: plan.metadataBarrelFile,
    componentName: plan.componentName,
    updatedFiles: result.updatedFiles,
  });
}

async function writeComponentDocs(params: {
  plan: ComponentGenerationPlan;
  result: ComponentGenerationResult;
}) {
  const { plan, result } = params;

  writeGeneratedFile({
    filePath: plan.docsContractFile,
    content: renderComponentDocsContract(plan),
    createdFiles: result.createdFiles,
    updatedFiles: result.updatedFiles,
  });

  registerComponentDocsContract({
    registryFile: plan.docsContractRegistryFile,
    componentName: plan.componentName,
    updatedFiles: result.updatedFiles,
  });

  await generateComponentDocumentation({
    root: plan.root,
    plan,
    metadata: createComponentMetadataFromPlan(plan),
    createdFiles: result.createdFiles,
    updatedFiles: result.updatedFiles,
  });
}

export async function writeComponentGenerationPlan(
  plan: ComponentGenerationPlan
): Promise<ComponentGenerationResult> {
  const result: ComponentGenerationResult = {
    createdFiles: [],
    updatedFiles: [],
  };

  writeSharedTypes({ plan, result });
  writeComponentTokens({ plan, result });

  for (const target of plan.targets) {
    writeTarget({
      plan,
      target,
      result,
    });
  }

  writeMetadata({
    plan,
    result,
  });

  await writeComponentDocs({
    plan,
    result,
  });

  await formatGeneratedFiles([
    ...result.createdFiles,
    plan.docsContractFile,
    plan.docsContractRegistryFile,
  ]);

  return result;
}
