import { pathToFileURL } from 'node:url';

import type { ComponentMetadata } from '@vellira-ui/metadata';

import { componentMetadata } from '../../packages/metadata/src';
import { runComponentCompletenessCheck } from '../checks/component-completeness/run';
import { runComponentQualityCheck } from '../checks/component-quality/engine';

import {
  COMPONENT_PRODUCTION_VALIDATION_WORKER_SCHEMA_VERSION,
  type ComponentProductionValidationWorkerPlatform,
  type ComponentProductionValidationWorkerResult,
} from './structured-validation-protocol';

export type ComponentProductionStructuredValidationWorkerDependencies = {
  metadata?: readonly ComponentMetadata[];
  runCompleteness?: typeof runComponentCompletenessCheck;
  runQuality?: typeof runComponentQualityCheck;
};

export async function runComponentProductionStructuredValidationWorkerTask(params: {
  root: string;
  componentName: string;
  platform: ComponentProductionValidationWorkerPlatform;
  dependencies?: ComponentProductionStructuredValidationWorkerDependencies;
}): Promise<ComponentProductionValidationWorkerResult> {
  const metadata = params.dependencies?.metadata ?? componentMetadata;

  const component = metadata.find(
    (candidate) =>
      candidate.name.toLowerCase() === params.componentName.toLowerCase()
  );

  if (!component) {
    return {
      schemaVersion: COMPONENT_PRODUCTION_VALIDATION_WORKER_SCHEMA_VERSION,
      status: 'blocked',
      componentName: params.componentName,
      code: 'component-not-registered',
      message: `${params.componentName} is not registered in canonical component metadata.`,
    };
  }

  const runCompleteness =
    params.dependencies?.runCompleteness ?? runComponentCompletenessCheck;

  const completeness = await runCompleteness({
    root: params.root,
    metadata: [component],
    generatedDocsScope: 'targeted',
  });

  const runQuality =
    params.dependencies?.runQuality ?? runComponentQualityCheck;

  const quality = await runQuality({
    componentName: component.name,
    platform: params.platform,
    rootDir: params.root,
  });

  return {
    schemaVersion: COMPONENT_PRODUCTION_VALIDATION_WORKER_SCHEMA_VERSION,
    status: 'ok',
    componentName: component.name,
    completeness,
    quality,
  };
}

async function main() {
  const [componentName, platform, ...extraArgs] = process.argv.slice(2);

  if (
    !componentName ||
    extraArgs.length > 0 ||
    (platform !== 'web' && platform !== 'native' && platform !== 'all')
  ) {
    throw new Error(
      'Usage: structured-validation-worker <ComponentName> <web|native|all>'
    );
  }

  const result = await runComponentProductionStructuredValidationWorkerTask({
    root: process.cwd(),
    componentName,
    platform,
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );

    process.exitCode = 2;
  }
}
