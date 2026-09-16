import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { getCatalogPaths } from '../component-page/helpers/paths';

import type { ComponentGenerationPlan } from './plan';
import { checkComponentPresentationContract } from './presentation-contract';

export type PlannedComponentWebsiteArtifacts = {
  createdFiles: string[];
  updatedFiles: string[];
};

type ComponentPageCheckPayload = {
  schemaVersion: '1';
  componentName: string;
  status: 'up-to-date' | 'stale';
  staleFiles: string[];
};

export function getPlannedComponentWebsiteArtifacts(
  plan: ComponentGenerationPlan
): PlannedComponentWebsiteArtifacts {
  const {
    componentCatalogDir,
    catalogRegistryFile,
    componentPresentationRegistryFile,
    generatedCatalogPreviewsFile,
    slug,
  } = getCatalogPaths({
    root: plan.root,
    componentName: plan.componentName,
  });

  const hasReact = plan.targets.some(
    (target) => target.packageName === 'react'
  );
  const hasNative = plan.targets.some(
    (target) => target.packageName === 'react-native'
  );
  const metadataFile = path.join(componentCatalogDir, 'metadata.ts');

  const createdFiles = [
    ...(!fs.existsSync(metadataFile) ? [metadataFile] : []),
    path.join(componentCatalogDir, `${plan.componentName}Usage.tsx`),
    path.join(componentCatalogDir, `${plan.componentName}Examples.tsx`),
    path.join(componentCatalogDir, `${plan.componentName}Accessibility.tsx`),
    path.join(componentCatalogDir, `${slug}Api.ts`),
    path.join(componentCatalogDir, `${slug}PlaygroundSchema.ts`),
    path.join(componentCatalogDir, `${plan.componentName}Playground.tsx`),
    ...(hasReact
      ? [path.join(componentCatalogDir, `${plan.componentName}Demo.tsx`)]
      : []),
    ...(hasNative
      ? [path.join(componentCatalogDir, `Native${plan.componentName}Demo.tsx`)]
      : []),
    path.join(componentCatalogDir, `${plan.componentName}CatalogPreview.tsx`),
    path.join(componentCatalogDir, 'index.ts'),
  ];

  return {
    createdFiles: [...new Set(createdFiles)].sort(),
    updatedFiles: [
      catalogRegistryFile,
      componentPresentationRegistryFile,
      generatedCatalogPreviewsFile,
    ].sort(),
  };
}

function checkDiscoveryContentContract(plan: ComponentGenerationPlan) {
  const metadataFile = path.join(
    plan.root,
    'apps/website/src/component-catalog/components',
    plan.componentName,
    'metadata.ts'
  );

  if (!fs.existsSync(metadataFile)) {
    return [];
  }

  const source = fs.readFileSync(metadataFile, 'utf8');

  if (!/\bdiscovery\s*:/.test(source)) {
    // Legacy component pages are adopted by the bounded #1136 backfill rather
    // than becoming launch blockers merely because this contract exists.
    return [];
  }

  if (
    /["']?status["']?\s*:\s*["']needs-authored-intent["']/.test(source)
  ) {
    return [metadataFile];
  }

  return [];
}

export function checkComponentWebsiteContract(
  plan: ComponentGenerationPlan
): string[] {
  const profile = plan.profile === 'base' ? 'primitive' : plan.profile;
  const result = spawnSync(
    'pnpm',
    [
      '--silent',
      'create:component-page',
      plan.componentName,
      '--force',
      '--check',
      '--json',
      `--profile=${profile}`,
      `--category=${plan.category}`,
    ],
    {
      cwd: plan.root,
      encoding: 'utf8',
      stdio: 'pipe',
    }
  );

  if (result.error) {
    throw new Error(
      `Website component contract check failed for ${plan.componentName}: ${result.error.message}`
    );
  }

  let payload: ComponentPageCheckPayload;

  try {
    payload = JSON.parse(result.stdout) as ComponentPageCheckPayload;
  } catch {
    const output = [result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n')
      .trim();

    throw new Error(
      [
        `Website component contract check returned invalid JSON for ${plan.componentName}.`,
        output,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  if (
    payload.schemaVersion !== '1' ||
    payload.componentName !== plan.componentName ||
    !Array.isArray(payload.staleFiles)
  ) {
    throw new Error(
      `Website component contract check returned an invalid payload for ${plan.componentName}.`
    );
  }

  const presentationDrift = checkComponentPresentationContract(plan);
  const discoveryDrift = checkDiscoveryContentContract(plan);

  if (result.status === 0 && payload.status === 'up-to-date') {
    return [...new Set([...presentationDrift, ...discoveryDrift])].sort();
  }

  if (result.status === 1 && payload.status === 'stale') {
    return [
      ...new Set([
        ...payload.staleFiles.map((filePath) => path.join(plan.root, filePath)),
        ...presentationDrift,
        ...discoveryDrift,
      ]),
    ].sort();
  }

  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join('\n')
    .trim();

  throw new Error(
    [
      `Website component contract check failed for ${plan.componentName} with exit code ${String(result.status)}.`,
      output,
    ]
      .filter(Boolean)
      .join('\n')
  );
}
