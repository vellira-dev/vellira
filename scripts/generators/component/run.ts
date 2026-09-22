import path from 'node:path';

import { getComponentApiDocsTargets, getComponentDocsTargets } from './docs';
import {
  checkMetadataExportContract,
  normalizeMetadataRegistryForMutation,
  synchronizeMetadataExportContract,
} from './metadata-export-contract';
import { createComponentGenerationPlan } from './plan';
import { checkGeneratedPlanContract } from './plan-contract';
import {
  checkReadmeInventoryContract,
  getReadmeInventoryFile,
  synchronizeReadmeInventoryContract,
} from './readme-inventory-contract';
import { validateComponentGenerationPlan } from './preflight';
import { writeComponentGenerationPlan } from './write';
import { generateComponentWebsitePage } from './website';
import {
  checkComponentWebsiteContract,
  getPlannedComponentWebsiteArtifacts,
} from './website-contract';
import {
  checkPublicApiContractSynchronization,
  getPublicSymbolContractFile,
  synchronizePublicSymbolContracts,
} from './public-api-contract';
import { checkComponentTokenContract } from './component-token-contract';
import {
  checkSharedTypesContract,
  writeSharedTypesContract,
} from './compound-shared-types';
import {
  getGeneratedTokenTypesFile,
  synchronizeGeneratedTokenTypes,
} from './token-types';
import {
  checkComponentTokenLifecycleContract,
  ensureComponentTokenLifecycleContract,
  getTokenLifecycleRegistryFile,
  needsComponentTokenLifecycleMutation,
} from './token-lifecycle-contract';
import {
  checkComponentTokenPreservationContract,
  getPlannedComponentTokenPreservationArtifacts,
  synchronizeComponentTokenPreservationContract,
} from './token-preservation-contract';
import {
  analyzeComponentTokenArchitectureRegistration,
  checkComponentTokenArchitectureRegistration,
  getComponentTokenArchitectureRegistrationFile,
  synchronizeComponentTokenArchitectureRegistration,
} from './token-architecture-registration-contract';

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
  plan: ReturnType<typeof createComponentGenerationPlan>,
  architectureRegistrationRequired: boolean
) {
  const files = [
    ...plan.targets.flatMap((target) => [
      target.barrelFile,
      target.packageBarrelFile,
      target.publicApiTestFile,
    ]),
    getPublicSymbolContractFile(plan.root),
    getReadmeInventoryFile(plan.root),
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

    if (needsComponentTokenLifecycleMutation(plan.componentName, plan.root)) {
      files.push(getTokenLifecycleRegistryFile(plan.root));
    }

    files.push(...getPlannedComponentTokenPreservationArtifacts(plan));

    if (architectureRegistrationRequired) {
      files.push(getComponentTokenArchitectureRegistrationFile(plan.root));
    }
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

  const architectureRegistration =
    await analyzeComponentTokenArchitectureRegistration(plan);

  if (params.options.check) {
    const driftedFiles = [
      ...checkPublicApiContractSynchronization(plan),
      ...checkReadmeInventoryContract(plan),
      ...checkMetadataExportContract(plan.metadataBarrelFile),
      ...checkComponentTokenLifecycleContract(plan),
      ...checkComponentTokenPreservationContract(plan),
      ...(await checkComponentTokenArchitectureRegistration(plan)),
      ...(await checkComponentTokenContract(plan)),
      ...checkSharedTypesContract(plan),
      ...(await checkGeneratedPlanContract(plan)),
      ...checkComponentWebsiteContract(plan),
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
    const websitePlan = getPlannedComponentWebsiteArtifacts(plan);

    return {
      plan,
      createdFiles: [
        ...new Set([
          ...getPlannedCreatedFiles(plan),
          ...websitePlan.createdFiles,
        ]),
      ],
      updatedFiles: [
        ...new Set([
          ...getPlannedUpdatedFiles(
            plan,
            architectureRegistration.mutationRequired
          ),
          ...websitePlan.updatedFiles,
        ]),
      ],
      dryRun: true,
      check: false,
    };
  }

  normalizeMetadataRegistryForMutation(plan.metadataBarrelFile);

  const sharedTypesResult = writeSharedTypesContract(plan);
  const result = await writeComponentGenerationPlan(plan);

  synchronizeReadmeInventoryContract({ plan, result });

  const architectureResult = { updatedFiles: [] as string[] };
  await synchronizeComponentTokenArchitectureRegistration({
    plan,
    result: architectureResult,
  });

  const preservationResult = { updatedFiles: [] as string[] };
  await synchronizeComponentTokenPreservationContract({
    plan,
    result: preservationResult,
  });

  synchronizePublicSymbolContracts({
    plan,
    updatedFiles: result.updatedFiles,
  });

  synchronizeMetadataExportContract({
    metadataBarrelFile: plan.metadataBarrelFile,
    updatedFiles: result.updatedFiles,
  });

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

  // Publish current ownership only after every generated surface succeeds.
  const lifecycleResult = { updatedFiles: [] as string[] };
  ensureComponentTokenLifecycleContract({ plan, result: lifecycleResult });

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
      ...lifecycleResult.updatedFiles,
      ...architectureResult.updatedFiles,
      ...preservationResult.updatedFiles,
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
