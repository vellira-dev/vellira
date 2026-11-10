import type { ComponentCompletenessResult } from '../checks/component-completeness/types';
import type { ComponentQualityRunResult } from '../checks/component-quality/types';

export const COMPONENT_PRODUCTION_VALIDATION_WORKER_SCHEMA_VERSION =
  '1' as const;

export const COMPONENT_PRODUCTION_PLAN_WORKER_SCHEMA_VERSION =
  'component-production-plan-contract-v1' as const;

export type ComponentProductionValidationWorkerPlatform =
  'web' | 'native' | 'all';

export type ComponentProductionValidationWorkerResult =
  | {
      schemaVersion: typeof COMPONENT_PRODUCTION_VALIDATION_WORKER_SCHEMA_VERSION;
      status: 'ok';
      componentName: string;
      completeness: readonly ComponentCompletenessResult[];
      quality: ComponentQualityRunResult | null;
    }
  | {
      schemaVersion: typeof COMPONENT_PRODUCTION_VALIDATION_WORKER_SCHEMA_VERSION;
      status: 'blocked';
      componentName: string;
      code: 'component-not-registered';
      message: string;
    };
