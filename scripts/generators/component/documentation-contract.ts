import path from 'node:path';

import { validateComponentDocs } from '../../../apps/docs/src/component-docs';
import { generateApiDocs } from '../../generate-api-docs';
import { generateComponentDocs } from '../component-docs/generate-component-docs';

import {
  createComponentDocsContractFromPlan,
  getComponentApiDocsTargets,
  getComponentDocsTargets,
  getGeneratedApiDocSections,
} from './docs';
import { createComponentMetadataFromPlan } from './metadata';

import type { ComponentGenerationPlan } from './plan';

export async function checkComponentDocumentationContract(
  plan: ComponentGenerationPlan
): Promise<string[]> {
  const metadata = createComponentMetadataFromPlan(plan);
  const contract = createComponentDocsContractFromPlan(plan);
  const validation = validateComponentDocs(contract, metadata);

  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
  }

  const apiResult = await generateApiDocs({
    rootDir: plan.root,
    check: true,
    silent: true,
    sections: getGeneratedApiDocSections(plan),
  });
  const docsResult = await generateComponentDocs({
    root: plan.root,
    check: true,
    force: plan.force,
    componentName: plan.componentName,
    metadata: [metadata],
    contracts: [validation.value],
  });
  const driftedFiles = new Set<string>();

  for (const relativePath of apiResult.changedFiles) {
    driftedFiles.add(path.join(plan.root, relativePath));
  }

  for (const relativePath of docsResult.changedFiles) {
    driftedFiles.add(path.join(plan.root, relativePath));
  }

  const apiTargets = getComponentApiDocsTargets(plan);
  const docsTargets = getComponentDocsTargets(plan);

  for (const apiTarget of apiTargets) {
    const relativeApiFile = path.relative(plan.root, apiTarget.apiFile);

    if (!apiResult.changedFiles.includes(relativeApiFile)) {
      continue;
    }

    const docsTarget = docsTargets.find(
      (target) => target.platform === apiTarget.platform
    );

    if (docsTarget) {
      driftedFiles.add(docsTarget.docsFile);
    }
  }

  return [...driftedFiles].sort();
}
