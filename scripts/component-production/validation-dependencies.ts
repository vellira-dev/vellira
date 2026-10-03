import type { ComponentProductionStageId } from './contracts';

export type ComponentProductionStagePolicy = {
  id: ComponentProductionStageId;
  dependsOn: readonly ComponentProductionStageId[];
  ownership: 'candidate' | 'mixed' | 'harness';
  providerRepairBudget: 'eligible-when-path-bound' | 'never';
};

/**
 * Canonical scheduling and repair-ownership audit for validation-mode stages.
 * Command-level dependencies below are narrower than stage dependencies when a
 * stage contains both Web and Native commands.
 */
export const COMPONENT_PRODUCTION_VALIDATION_STAGE_POLICY = [
  {
    id: 'format',
    dependsOn: [],
    ownership: 'candidate',
    providerRepairBudget: 'eligible-when-path-bound',
  },
  {
    id: 'lint',
    dependsOn: [],
    ownership: 'candidate',
    providerRepairBudget: 'eligible-when-path-bound',
  },
  {
    id: 'tests',
    dependsOn: [],
    ownership: 'mixed',
    providerRepairBudget: 'eligible-when-path-bound',
  },
  {
    id: 'typecheck',
    dependsOn: [],
    ownership: 'candidate',
    providerRepairBudget: 'eligible-when-path-bound',
  },
  {
    id: 'build',
    dependsOn: [],
    ownership: 'mixed',
    providerRepairBudget: 'eligible-when-path-bound',
  },
  {
    id: 'storybook',
    dependsOn: ['build'],
    ownership: 'mixed',
    providerRepairBudget: 'eligible-when-path-bound',
  },
  {
    id: 'docs',
    dependsOn: [],
    ownership: 'candidate',
    providerRepairBudget: 'eligible-when-path-bound',
  },
  {
    id: 'website',
    dependsOn: [],
    ownership: 'candidate',
    providerRepairBudget: 'eligible-when-path-bound',
  },
  {
    id: 'completeness',
    dependsOn: [],
    ownership: 'candidate',
    providerRepairBudget: 'eligible-when-path-bound',
  },
  {
    id: 'quality',
    dependsOn: [],
    ownership: 'candidate',
    providerRepairBudget: 'eligible-when-path-bound',
  },
  {
    id: 'public-api',
    dependsOn: [],
    ownership: 'mixed',
    providerRepairBudget: 'never',
  },
  {
    id: 'tooling',
    dependsOn: [],
    ownership: 'mixed',
    providerRepairBudget: 'eligible-when-path-bound',
  },
  {
    id: 'visual',
    dependsOn: ['storybook'],
    ownership: 'mixed',
    providerRepairBudget: 'never',
  },
  {
    id: 'smoke',
    dependsOn: ['build'],
    ownership: 'mixed',
    providerRepairBudget: 'never',
  },
] as const satisfies readonly ComponentProductionStagePolicy[];

const COMMAND_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  'react-storybook-build': ['react-build'],
  'canonical-web-visual': ['react-storybook-build'],
  'web-smoke': ['react-build'],
  'native-smoke': ['react-native-build'],
};

export function componentProductionCommandDependencies(
  commandId: string
): readonly string[] {
  return COMMAND_DEPENDENCIES[commandId] ?? [];
}
