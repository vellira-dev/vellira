import path from 'node:path';

import { getComponentApiDocsTargets, getComponentDocsTargets } from './docs';
import { createComponentGenerationPlan } from './plan';
import { validateComponentGenerationPlan } from './preflight';
import { writeComponentGenerationPlan } from './write';
import { generateComponentWebsitePage } from './website';
import { checkPublicApiContractSynchronization } from './public-api-contract';
import { checkComponentTokenContract } from './component-token-contract';
import {
  checkSharedTypesContract,
  writeSharedTypesContract,
} from './compound-shared-types';
import {
  getGeneratedTokenTypesFile,
  synchronizeGeneratedTokenTypes,
} from './token-types';

import type { ComponentGeneratorOptions } from './cli';

export type RunComponentGeneratorResult = {
  plan: ReturnType<typeof createComponentGenerationPlan>;
  createdFiles: string[];
  updatedFiles: string[];
  dryRun: boolean;
  check: boolean;
};

function generatesSharedTypes(
  plan: ReturnType<typeof createComponentGenerationPlan>
) {
  return plan.typeOwnership === 'shared';
}

function getPlannedCreatedFiles(
  plan: ReturnType<typeof createComponentGenerationPlan>
) {
  const files: string[] = [
    plan.metadataFile,
    plan.docsContractFile,
    ...getComponentDocsTargets(plan).map((target) => target.docsFile),
  ];

  if (plan.componentTokens !== false) {
    files.push(
      plan.tokenFactoryFile,
      ...plan.tokenThemeTargets.map((target) => target.componentFile)
    );
  }

  if (generatesSharedTypes(plan)) {
    files.push(plan.sharedTypesFile);
  }

  for (const target of plan.targets) {
    const { componentDir, isNative } = target;
    const { componentName } = plan;

    files.push(
      path.join(componentDir, 'types.ts'),
      path.join(componentDir, 'index.ts'),
      path.join(componentDir, `${componentName}.tsx`),
      path.join(componentDir, `${componentName}.stories.tsx`),
      path.join(componentDir, `${componentName}.test.tsx`),
      path.join(componentDir, `${componentName}.test-contract.json`),
      path.join(
        componentDir,
        isNative ? `${componentName}.styles.ts` : `${componentName}.module.scss`
      )
    );

    for (const partName of plan.parts) {
      const partDir = path.join(componentDir, partName);

      files.push(
        path.join(partDir, 'types.ts'),
        path.join(partDir, 'index.ts'),
        path.join(partDir, `${componentName}${partName}.tsx`)
      );
    }
  }

  return files;
}

function getPlannedUpdatedFiles(
  plan: ReturnType<typeof createComponentGenerationPlan>
) {
  const files = [
    ...plan.targets.flatMap((target) => [
      target.barrelFile,
      target.packageBarrelFile,
      target.publicApiTestFile,
    ]),
    plan.metadataBarrelFile,
    plan.docsContractRegistryFile,
    ...getComponentApiDocsTargets(plan).map((target) => target.apiFile),
  ];

  if (plan.componentTokens !== false) {
    files.push(
      plan.tokenFactoryBarrelFile,
      ...plan.tokenThemeTargets.map((target) => target.barrelFile),
      getGeneratedTokenTypesFile(plan.root)
    );
  }

  if (generatesSharedTypes(plan)) {
    files.push(plan.sharedTypesBarrelFile);
  }

  return [...new Set(files)];
}

export async function runComponentGenerator(params: {
  root: string;
  options: ComponentGeneratorOptions;
}): Promise<RunComponentGeneratorResult> {
  const plan = createComponentGenerationPlan(params);

  const preflight = validateComponentGenerationPlan(
    plan,
    params.options.check
      ? {
          allowExistingTargets: true,
        }
      : undefined
  );

  if (!preflight.ok) {
    throw new Error(preflight.errors.join('\n'));
  }

  if (params.options.check) {
    const driftedFiles = [
      ...checkPublicApiContractSynchronization({
        componentName: plan.componentName,
        targets: plan.targets,
      }),
      ...checkComponentTokenContract(plan),
      ...checkSharedTypesContract(plan),
    ];

    if (driftedFiles.length > 0) {
      throw new Error(
        `Component generator check detected contract drift:\n${[
          ...new Set(driftedFiles),
        ].join('\n')}`
      );
    }

    return {
      plan,
      createdFiles: [],
      updatedFiles: [],
      dryRun: false,
      check: true,
    };
  }

  if (params.options.dryRun) {
    return {
      plan,
      createdFiles: getPlannedCreatedFiles(plan),
      updatedFiles: getPlannedUpdatedFiles(plan),
      dryRun: true,
      check: false,
    };
  }

  const sharedTypesResult = writeSharedTypesContract(plan);
  const result = await writeComponentGenerationPlan(plan);

  const tokenTypesResult =
    plan.componentTokens === false
      ? {
          createdFiles: [],
          updatedFiles: [],
        }
      : synchronizeGeneratedTokenTypes({
          root: params.root,
        });

  const websiteResult = generateComponentWebsitePage({
    root: params.root,
    componentName: plan.componentName,
    profile: plan.profile,
    category: plan.category,
  });

  const createdFiles = [
    ...new Set([
      ...sharedTypesResult.createdFiles,
      ...result.createdFiles,
      ...tokenTypesResult.createdFiles,
      ...websiteResult.createdFiles,
    ]),
  ];

  const createdFileSet = new Set(createdFiles);

  const updatedFiles = [
    ...new Set([
      ...sharedTypesResult.updatedFiles,
      ...result.updatedFiles,
      ...tokenTypesResult.updatedFiles,
      ...websiteResult.updatedFiles,
    ]),
  ].filter((filePath) => !createdFileSet.has(filePath));

  return {
    plan,
    createdFiles,
    updatedFiles,
    dryRun: false,
    check: false,
  };
}
