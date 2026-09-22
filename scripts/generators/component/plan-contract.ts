import fs from 'node:fs';

import { formatGeneratedContent } from '../format-generated-files';

import {
  getComponentDocsContractVariable,
  renderComponentDocsContract,
} from './docs';
import { checkComponentDocumentationContract } from './documentation-contract';
import { createMetadataTemplateParamsFromPlan } from './metadata';
import { renderMetadataTemplate } from './templates';

import type { ComponentGenerationPlan } from './plan';

export async function checkGeneratedPlanContract(
  plan: ComponentGenerationPlan
): Promise<string[]> {
  const driftedFiles: string[] = [];
  const expectedMetadata = await formatGeneratedContent(
    plan.metadataFile,
    renderMetadataTemplate(createMetadataTemplateParamsFromPlan(plan))
  );

  if (!fileMatches(plan.metadataFile, expectedMetadata)) {
    driftedFiles.push(plan.metadataFile);
  }

  const metadataName = `${plan.componentName[0].toLowerCase()}${plan.componentName.slice(1)}Metadata`;
  const metadataImport = `import { ${metadataName} } from './${plan.componentName}.metadata';`;
  const metadataEntry = `  ${metadataName},`;

  if (
    !fileContainsAll(plan.metadataBarrelFile, [metadataImport, metadataEntry])
  ) {
    driftedFiles.push(plan.metadataBarrelFile);
  }

  const expectedDocsContract = await formatGeneratedContent(
    plan.docsContractFile,
    renderComponentDocsContract(plan)
  );

  if (!fileMatches(plan.docsContractFile, expectedDocsContract)) {
    driftedFiles.push(plan.docsContractFile);
  }

  const docsVariable = getComponentDocsContractVariable(plan.componentName);
  const docsImport = `import { ${docsVariable} } from './${plan.componentName}.docs';`;

  if (
    !fileContainsAll(plan.docsContractRegistryFile, [docsImport, docsVariable])
  ) {
    driftedFiles.push(plan.docsContractRegistryFile);
  }

  driftedFiles.push(...(await checkComponentDocumentationContract(plan)));

  return [...new Set(driftedFiles)];
}

function fileMatches(filePath: string, expected: string): boolean {
  return (
    fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === expected
  );
}

function fileContainsAll(
  filePath: string,
  expectedFragments: readonly string[]
): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const source = fs.readFileSync(filePath, 'utf8');

  return expectedFragments.every((fragment) => source.includes(fragment));
}
