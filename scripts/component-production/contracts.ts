import type {
  ComponentAssetRequirement,
  ComponentCapability,
  ComponentDependencies,
  ComponentIconRequirement,
  ComponentPlatform,
  ComponentSemanticCapability,
  ComponentTokenContract,
} from '@vellira-ui/metadata';

import { componentSemanticCapabilities } from '../../packages/metadata/src/component';
import {
  parseGovernedGitHubWorkItem,
  type GovernedGitHubWorkItem,
} from '../generators/component/work-item';

import type { ComponentCompletenessResult } from '../checks/component-completeness/types';
import type { ComponentQualityRunResult } from '../checks/component-quality/types';
import {
  parseComponentGeneratorArgs,
  type ComponentCategoryArg,
  type ComponentGeneratorOptions,
  type ComponentLayerArg,
  type ComponentPlatformArg,
  type ComponentProfileArg,
  type FormControlKindArg,
} from '../generators/component/cli';

export const COMPONENT_PRODUCTION_SCHEMA_VERSION = '1' as const;

export type ComponentProductionInputV1 = {
  schemaVersion: typeof COMPONENT_PRODUCTION_SCHEMA_VERSION;
  componentName: string;
  platform: ComponentPlatformArg;
  layer: ComponentLayerArg;
  category: ComponentCategoryArg;
  profile: ComponentProfileArg;
  control?: FormControlKindArg;
  capabilities: readonly ComponentCapability[];
  semanticCapabilities?: readonly ComponentSemanticCapability[];
  platformSemanticCapabilities?: Partial<
    Record<ComponentPlatform, readonly ComponentSemanticCapability[]>
  >;
  dependencies?: ComponentDependencies;
  icons?: readonly ComponentIconRequirement[];
  tokens?: readonly string[];
  assets?: readonly ComponentAssetRequirement[];
  componentTokens: ComponentTokenContract | false;
  workItem?: GovernedGitHubWorkItem;
  parts: readonly string[];
};

export const COMPONENT_PRODUCTION_STAGE_IDS = [
  'preflight',
  'generation',
  'semantic-completion',
  'format',
  'lint',
  'tests',
  'typecheck',
  'build',
  'storybook',
  'docs',
  'website',
  'completeness',
  'quality',
  'public-api',
  'tooling',
  'visual',
  'smoke',
] as const;

export type ComponentProductionStageId =
  (typeof COMPONENT_PRODUCTION_STAGE_IDS)[number];

export type ComponentProductionStageStatus =
  'passed' | 'blocked' | 'failed' | 'skipped';

export type ComponentProductionFindingSeverity = 'blocking' | 'warning';

export type ComponentProductionFinding = {
  id: string;
  stage: ComponentProductionStageId;
  severity: ComponentProductionFindingSeverity;
  message: string;
  path?: string;
  platform?: ComponentPlatform;
  ruleId?: string;
};

export type ComponentProductionStageResult = {
  id: ComponentProductionStageId;
  status: ComponentProductionStageStatus;
  summary: string;
  findings: readonly ComponentProductionFinding[];
  artifacts: readonly string[];
};

export type ComponentProductionStatus = 'ready' | 'blocked' | 'failed';

export const COMPONENT_PRODUCTION_LIFECYCLE_PHASES = [
  'scaffolded',
  'semantic-completion-required',
  'candidate',
  'validated',
  'ready-for-review',
] as const;

export type ComponentProductionLifecyclePhase =
  (typeof COMPONENT_PRODUCTION_LIFECYCLE_PHASES)[number];

export type ComponentProductionLifecycleV1 = {
  current: ComponentProductionLifecyclePhase;
  completed: readonly ComponentProductionLifecyclePhase[];
  semanticCompletionRequired: boolean;
  readyForReview: boolean;
};

export type ComponentProductionArtifactGroupV1 = {
  generated: boolean;
  artifacts: readonly string[];
};

export type ComponentProductionOutputSummaryV1 = {
  generation: {
    status: ComponentProductionStageStatus;
    artifacts: readonly string[];
  };
  runtimeRenderers: ComponentProductionArtifactGroupV1;
  sharedContracts: ComponentProductionArtifactGroupV1;
  metadata: ComponentProductionArtifactGroupV1;
  designResources: ComponentProductionArtifactGroupV1;
  testGeneration: ComponentProductionArtifactGroupV1;
  storyGeneration: ComponentProductionArtifactGroupV1;
  docsGeneration: ComponentProductionArtifactGroupV1;
  websiteGeneration: ComponentProductionArtifactGroupV1;
};

export type ComponentProductionValidationSummaryV1 = {
  status: ComponentProductionStatus;
  passedStages: readonly ComponentProductionStageId[];
  blockedStages: readonly ComponentProductionStageId[];
  failedStages: readonly ComponentProductionStageId[];
  skippedStages: readonly ComponentProductionStageId[];
};

export type ComponentProductionValidationResultV1 = {
  schemaVersion: typeof COMPONENT_PRODUCTION_SCHEMA_VERSION;
  input: ComponentProductionInputV1;
  status: ComponentProductionStatus;
  readyForReview: boolean;
  lifecycle: ComponentProductionLifecycleV1;
  stages: readonly ComponentProductionStageResult[];
  blockingFindings: readonly ComponentProductionFinding[];
  validationSummary: ComponentProductionValidationSummaryV1;
  completeness: readonly ComponentCompletenessResult[] | null;
  quality: ComponentQualityRunResult | null;
};

export type ComponentProductionResultV1 = {
  schemaVersion: typeof COMPONENT_PRODUCTION_SCHEMA_VERSION;
  input: ComponentProductionInputV1;
  status: ComponentProductionStatus;
  readyForReview: boolean;
  lifecycle: ComponentProductionLifecycleV1;
  stages: readonly ComponentProductionStageResult[];
  blockingFindings: readonly ComponentProductionFinding[];
  artifacts: readonly string[];
  outputs: ComponentProductionOutputSummaryV1;
  validationSummary: ComponentProductionValidationSummaryV1;
  completeness: readonly ComponentCompletenessResult[] | null;
  quality: ComponentQualityRunResult | null;
};

const INPUT_KEYS = new Set([
  'schemaVersion',
  'componentName',
  'platform',
  'layer',
  'category',
  'profile',
  'control',
  'capabilities',
  'semanticCapabilities',
  'platformSemanticCapabilities',
  'dependencies',
  'icons',
  'tokens',
  'assets',
  'componentTokens',
  'workItem',
  'parts',
]);

const ICON_REQUIREMENT_KEYS = new Set(['name', 'purpose']);
const ASSET_REQUIREMENT_KEYS = new Set(['path', 'purpose']);
const DEPENDENCY_KEYS = new Set(['packages', 'components', 'platforms']);
const DEPENDENCY_SET_KEYS = new Set(['packages', 'components']);
const COMPONENT_TOKEN_CONTRACTS = new Set<ComponentTokenContract>([
  'standard',
  'boolean-control',
  'disclosure',
]);

export function parseComponentProductionInput(
  value: unknown
): ComponentProductionInputV1 {
  if (!isRecord(value)) {
    throw new Error('Component production input must be an object.');
  }

  for (const key of Object.keys(value)) {
    if (!INPUT_KEYS.has(key)) {
      throw new Error(`Unknown component production input field "${key}".`);
    }
  }

  if (value.schemaVersion !== COMPONENT_PRODUCTION_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported component production schema version "${String(
        value.schemaVersion
      )}". Expected "${COMPONENT_PRODUCTION_SCHEMA_VERSION}".`
    );
  }

  const componentName = requiredString(value, 'componentName');
  const platform = requiredString(value, 'platform');
  const layer = requiredString(value, 'layer');
  const category = requiredString(value, 'category');
  const profile = requiredString(value, 'profile');
  const control = optionalString(value, 'control');
  const capabilities = optionalStringArray(value, 'capabilities');
  const semanticCapabilities = optionalSemanticCapabilityArray(
    value,
    'semanticCapabilities'
  );
  const platformSemanticCapabilities = optionalPlatformSemanticCapabilities(
    value,
    'platformSemanticCapabilities'
  );
  const dependencies = optionalDependencies(value, 'dependencies');
  const icons = optionalIconRequirements(value, 'icons');
  const tokens = optionalNonEmptyStringArray(value, 'tokens');
  const assets = optionalAssetRequirements(value, 'assets');
  const componentTokens = optionalComponentTokenContract(
    value,
    'componentTokens'
  );
  const workItem =
    value.workItem === undefined
      ? undefined
      : parseGovernedGitHubWorkItem(
          value.workItem,
          'Component production input field "workItem"'
        );
  const parts = optionalStringArray(value, 'parts');

  const args = [
    componentName,
    platform,
    layer,
    category,
    `--profile=${profile}`,
  ];

  if (control !== undefined) {
    args.push(`--control=${control}`);
  }

  if (capabilities.length > 0) {
    args.push(`--capabilities=${capabilities.join(',')}`);
  }

  if (parts.length > 0) {
    args.push(`--parts=${parts.join(',')}`);
  }

  for (const icon of icons) {
    args.push(`--icon=${icon.name}:${icon.purpose}`);
  }

  for (const token of tokens) {
    args.push(`--token=${token}`);
  }

  const generatorOptions = parseComponentGeneratorArgs(args);
  const selectedPlatforms = new Set<ComponentPlatform>(
    generatorOptions.platform === 'both'
      ? ['react', 'react-native']
      : [generatorOptions.platform === 'web' ? 'react' : 'react-native']
  );

  for (const platform of Object.keys(
    platformSemanticCapabilities
  ) as ComponentPlatform[]) {
    if (!selectedPlatforms.has(platform)) {
      throw new Error(
        `Component production input field "platformSemanticCapabilities.${platform}" targets an unselected platform.`
      );
    }
  }

  const resolvedComponentTokens =
    componentTokens ??
    (generatorOptions.profile === 'form-control' &&
    (generatorOptions.control ?? 'value') === 'boolean'
      ? 'boolean-control'
      : 'standard');

  return {
    schemaVersion: COMPONENT_PRODUCTION_SCHEMA_VERSION,
    componentName: generatorOptions.componentName,
    platform: generatorOptions.platform,
    layer: generatorOptions.layer,
    category: generatorOptions.category,
    profile: generatorOptions.profile,
    ...(generatorOptions.profile === 'form-control'
      ? {
          control: generatorOptions.control ?? 'value',
        }
      : {}),
    capabilities: generatorOptions.capabilities ?? [],
    ...(semanticCapabilities.length > 0 ? { semanticCapabilities } : {}),
    ...(Object.keys(platformSemanticCapabilities).length > 0
      ? { platformSemanticCapabilities }
      : {}),
    ...(dependencies ? { dependencies } : {}),
    ...((generatorOptions.icons ?? []).length > 0
      ? { icons: generatorOptions.icons }
      : {}),
    ...((generatorOptions.tokens ?? []).length > 0
      ? { tokens: generatorOptions.tokens }
      : {}),
    ...(assets.length > 0 ? { assets } : {}),
    componentTokens: resolvedComponentTokens,
    ...(workItem !== undefined ? { workItem } : {}),
    parts: generatorOptions.parts,
  };
}

export function createComponentProductionGeneratorOptions(
  input: ComponentProductionInputV1
): ComponentGeneratorOptions {
  return {
    componentName: input.componentName,
    platform: input.platform,
    layer: input.layer,
    category: input.category,
    profile: input.profile,
    ...(input.control !== undefined
      ? {
          control: input.control,
        }
      : {}),
    capabilities: input.capabilities,
    semanticCapabilities: input.semanticCapabilities ?? [],
    platformSemanticCapabilities: input.platformSemanticCapabilities,
    dependencies: input.dependencies,
    icons: input.icons ?? [],
    tokens: input.tokens ?? [],
    assets: input.assets ?? [],
    componentTokens: input.componentTokens,
    ...(input.workItem !== undefined ? { workItem: input.workItem } : {}),
    parts: input.parts,
    force: false,
    dryRun: false,
    check: false,
  };
}

export function createComponentProductionResult(params: {
  input: ComponentProductionInputV1;
  stages: readonly ComponentProductionStageResult[];
  completeness: readonly ComponentCompletenessResult[] | null;
  quality: ComponentQualityRunResult | null;
}): ComponentProductionResultV1 {
  assertCanonicalStageSequence(params.stages);

  for (const stage of params.stages) {
    for (const finding of stage.findings) {
      if (finding.stage !== stage.id) {
        throw new Error(
          `Component production finding "${finding.id}" belongs to stage "${finding.stage}" but was emitted by "${stage.id}".`
        );
      }
    }
  }

  const validationSummary = createComponentProductionValidationSummary(
    params.stages
  );
  const status = validationSummary.status;

  const blockingFindings = params.stages.flatMap((stage) =>
    stage.findings.filter((finding) => finding.severity === 'blocking')
  );

  if (status !== 'ready' && blockingFindings.length === 0) {
    throw new Error(
      'Blocked or failed component production results require at least one blocking finding.'
    );
  }

  const artifacts = [
    ...new Set(params.stages.flatMap((stage) => stage.artifacts)),
  ].sort();

  const outputs = createComponentProductionOutputSummary(params.stages);

  return {
    schemaVersion: COMPONENT_PRODUCTION_SCHEMA_VERSION,
    input: params.input,
    status,
    readyForReview: status === 'ready',
    lifecycle: createComponentProductionLifecycle(params.stages),
    stages: params.stages,
    blockingFindings,
    artifacts,
    outputs,
    validationSummary,
    completeness: params.completeness,
    quality: params.quality,
  };
}

export function createComponentProductionLifecycle(
  stages: readonly ComponentProductionStageResult[]
): ComponentProductionLifecycleV1 {
  const generation = stages.find((stage) => stage.id === 'generation');
  const semanticCompletion = stages.find(
    (stage) => stage.id === 'semantic-completion'
  );

  if (generation?.status !== 'passed') {
    return {
      current: 'scaffolded',
      completed: [],
      semanticCompletionRequired: false,
      readyForReview: false,
    };
  }

  if (semanticCompletion?.status !== 'passed') {
    return {
      current: 'semantic-completion-required',
      completed: ['scaffolded'],
      semanticCompletionRequired: true,
      readyForReview: false,
    };
  }

  const validationStages = stages.filter(
    (stage) =>
      stage.id !== 'preflight' &&
      stage.id !== 'generation' &&
      stage.id !== 'semantic-completion'
  );

  return lifecycleFromValidationStages(validationStages);
}

export function createComponentProductionValidationLifecycle(
  stages: readonly ComponentProductionStageResult[]
): ComponentProductionLifecycleV1 {
  return lifecycleFromValidationStages(stages);
}

function lifecycleFromValidationStages(
  stages: readonly ComponentProductionStageResult[]
): ComponentProductionLifecycleV1 {
  const hasSkipped = stages.some((stage) => stage.status === 'skipped');
  const hasFailed = stages.some((stage) => stage.status === 'failed');
  const hasBlocked = stages.some((stage) => stage.status === 'blocked');

  if (!hasSkipped && !hasFailed && !hasBlocked) {
    return {
      current: 'ready-for-review',
      completed: [
        'scaffolded',
        'semantic-completion-required',
        'candidate',
        'validated',
      ],
      semanticCompletionRequired: false,
      readyForReview: true,
    };
  }

  if (!hasSkipped && !hasFailed) {
    return {
      current: 'validated',
      completed: ['scaffolded', 'semantic-completion-required', 'candidate'],
      semanticCompletionRequired: false,
      readyForReview: false,
    };
  }

  return {
    current: 'candidate',
    completed: ['scaffolded', 'semantic-completion-required'],
    semanticCompletionRequired: false,
    readyForReview: false,
  };
}

export function createComponentProductionValidationSummary(
  stages: readonly ComponentProductionStageResult[]
): ComponentProductionValidationSummaryV1 {
  const passedStages = stages
    .filter((stage) => stage.status === 'passed')
    .map((stage) => stage.id);

  const blockedStages = stages
    .filter((stage) => stage.status === 'blocked')
    .map((stage) => stage.id);

  const failedStages = stages
    .filter((stage) => stage.status === 'failed')
    .map((stage) => stage.id);

  const skippedStages = stages
    .filter((stage) => stage.status === 'skipped')
    .map((stage) => stage.id);

  const status: ComponentProductionStatus =
    failedStages.length > 0
      ? 'failed'
      : blockedStages.length > 0 || skippedStages.length > 0
        ? 'blocked'
        : 'ready';

  return {
    status,
    passedStages,
    blockedStages,
    failedStages,
    skippedStages,
  };
}

export function createComponentProductionOutputSummary(
  stages: readonly ComponentProductionStageResult[]
): ComponentProductionOutputSummaryV1 {
  const generation = stages.find((stage) => stage.id === 'generation');

  if (!generation) {
    throw new Error(
      'Component production output summary requires the generation stage.'
    );
  }

  const artifacts = [...new Set(generation.artifacts)].sort();

  return {
    generation: {
      status: generation.status,
      artifacts,
    },
    runtimeRenderers: artifactGroup(
      artifacts,
      (artifact) =>
        (artifact.startsWith('packages/react/src/') ||
          artifact.startsWith('packages/react-native/src/')) &&
        !artifact.includes('.test.') &&
        !artifact.includes('.stories.') &&
        !artifact.includes('test-contract') &&
        !artifact.endsWith('/public-api.test.ts')
    ),
    sharedContracts: artifactGroup(artifacts, (artifact) =>
      artifact.startsWith('packages/types/')
    ),
    metadata: artifactGroup(
      artifacts,
      (artifact) =>
        artifact.startsWith('packages/metadata/') ||
        artifact.endsWith('.metadata.ts')
    ),
    designResources: artifactGroup(artifacts, (artifact) =>
      artifact.startsWith('packages/tokens/')
    ),
    testGeneration: artifactGroup(
      artifacts,
      (artifact) =>
        artifact.includes('.test.') ||
        artifact.includes('test-contract') ||
        artifact.endsWith('/public-api.test.ts')
    ),
    storyGeneration: artifactGroup(artifacts, (artifact) =>
      artifact.includes('.stories.')
    ),
    docsGeneration: artifactGroup(
      artifacts,
      (artifact) =>
        artifact.startsWith('apps/docs/') ||
        artifact.endsWith('/API.md') ||
        artifact.includes('/component-docs/')
    ),
    websiteGeneration: artifactGroup(artifacts, (artifact) =>
      artifact.startsWith('apps/website/')
    ),
  };
}

function artifactGroup(
  artifacts: readonly string[],
  matches: (artifact: string) => boolean
): ComponentProductionArtifactGroupV1 {
  const selected = artifacts.filter(matches);

  return {
    generated: selected.length > 0,
    artifacts: selected,
  };
}

function assertCanonicalStageSequence(
  stages: readonly ComponentProductionStageResult[]
): void {
  if (stages.length !== COMPONENT_PRODUCTION_STAGE_IDS.length) {
    throw new Error(
      'Component production result must contain every canonical pipeline stage exactly once.'
    );
  }

  for (
    let index = 0;
    index < COMPONENT_PRODUCTION_STAGE_IDS.length;
    index += 1
  ) {
    const expected = COMPONENT_PRODUCTION_STAGE_IDS[index];
    const actual = stages[index]?.id;

    if (actual !== expected) {
      throw new Error(
        `Component production stage order mismatch at index ${index}: expected "${expected}", got "${String(actual)}".`
      );
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const field = value[key];

  if (typeof field !== 'string' || field.length === 0) {
    throw new Error(
      `Component production input field "${key}" must be a non-empty string.`
    );
  }

  return field;
}

function optionalString(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const field = value[key];

  if (field === undefined) {
    return undefined;
  }

  if (typeof field !== 'string' || field.length === 0) {
    throw new Error(
      `Component production input field "${key}" must be a non-empty string when provided.`
    );
  }

  return field;
}

function optionalStringArray(
  value: Record<string, unknown>,
  key: string
): string[] {
  const field = value[key];

  if (field === undefined) {
    return [];
  }

  if (
    !Array.isArray(field) ||
    field.some(
      (item) =>
        typeof item !== 'string' || item.length === 0 || item.includes(',')
    )
  ) {
    throw new Error(
      `Component production input field "${key}" must be an array of non-empty strings without commas.`
    );
  }

  return [...field];
}

function optionalSemanticCapabilityArray(
  value: Record<string, unknown>,
  key: string
): ComponentSemanticCapability[] {
  const field = value[key];

  if (field === undefined) {
    return [];
  }

  if (
    !Array.isArray(field) ||
    field.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    throw new Error(
      `Component production input field "${key}" must be an array of semantic capability strings.`
    );
  }

  const invalid = field.filter(
    (item) =>
      !componentSemanticCapabilities.includes(
        item as ComponentSemanticCapability
      )
  );

  if (invalid.length > 0) {
    throw new Error(
      `Component production input field "${key}" contains unsupported semantic capabilities: ${invalid.join(', ')}.`
    );
  }

  if (new Set(field).size !== field.length) {
    throw new Error(
      `Component production input field "${key}" must not contain duplicates.`
    );
  }

  return field as ComponentSemanticCapability[];
}

function optionalPlatformSemanticCapabilities(
  value: Record<string, unknown>,
  key: string
): Partial<Record<ComponentPlatform, readonly ComponentSemanticCapability[]>> {
  const field = value[key];

  if (field === undefined) {
    return {};
  }

  if (!isRecord(field)) {
    throw new Error(
      `Component production input field "${key}" must be an object.`
    );
  }

  const result: Partial<
    Record<ComponentPlatform, readonly ComponentSemanticCapability[]>
  > = {};

  for (const [platform, rawCapabilities] of Object.entries(field)) {
    if (platform !== 'react' && platform !== 'react-native') {
      throw new Error(
        `Component production input field "${key}" contains unsupported platform "${platform}".`
      );
    }

    const parsed = optionalSemanticCapabilityArray(
      { capabilities: rawCapabilities },
      'capabilities'
    );

    if (parsed.length === 0) {
      throw new Error(
        `Component production input field "${key}.${platform}" must contain at least one semantic capability.`
      );
    }

    result[platform] = parsed;
  }

  return result;
}

function optionalNonEmptyStringArray(
  value: Record<string, unknown>,
  key: string
): string[] {
  const field = value[key];

  if (field === undefined) {
    return [];
  }

  if (
    !Array.isArray(field) ||
    field.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    throw new Error(
      `Component production input field "${key}" must be an array of non-empty strings.`
    );
  }

  return [...field];
}

function optionalComponentTokenContract(
  value: Record<string, unknown>,
  key: string
): ComponentTokenContract | false | undefined {
  const field = value[key];

  if (field === undefined || field === false) {
    return field;
  }

  if (
    typeof field !== 'string' ||
    !COMPONENT_TOKEN_CONTRACTS.has(field as ComponentTokenContract)
  ) {
    throw new Error(
      `Component production input field "${key}" must be false, standard, boolean-control, or disclosure.`
    );
  }

  return field as ComponentTokenContract;
}

function optionalDependencySet(
  value: unknown,
  label: string
): { packages?: string[]; components?: string[] } {
  if (!isRecord(value)) {
    throw new Error(
      `Component production input field "${label}" must be an object.`
    );
  }

  for (const key of Object.keys(value)) {
    if (!DEPENDENCY_SET_KEYS.has(key)) {
      throw new Error(
        `Unknown component production dependency field "${key}" at ${label}.`
      );
    }
  }

  const packages = optionalNonEmptyStringArray(value, 'packages');
  const components = optionalStringArray(value, 'components');

  if (new Set(packages).size !== packages.length) {
    throw new Error(
      `Component production input field "${label}.packages" must not contain duplicates.`
    );
  }

  if (new Set(components).size !== components.length) {
    throw new Error(
      `Component production input field "${label}.components" must not contain duplicates.`
    );
  }

  return {
    ...(packages.length > 0 ? { packages } : {}),
    ...(components.length > 0 ? { components } : {}),
  };
}

function optionalDependencies(
  value: Record<string, unknown>,
  key: string
): ComponentDependencies | undefined {
  const field = value[key];

  if (field === undefined) {
    return undefined;
  }

  if (!isRecord(field)) {
    throw new Error(
      `Component production input field "${key}" must be an object.`
    );
  }

  for (const itemKey of Object.keys(field)) {
    if (!DEPENDENCY_KEYS.has(itemKey)) {
      throw new Error(
        `Unknown component production dependency field "${itemKey}" at ${key}.`
      );
    }
  }

  const rootSet = optionalDependencySet(
    { packages: field.packages, components: field.components },
    key
  );
  let platforms: ComponentDependencies['platforms'];

  if (field.platforms !== undefined) {
    if (!isRecord(field.platforms)) {
      throw new Error(
        `Component production input field "${key}.platforms" must be an object.`
      );
    }

    platforms = {};

    for (const [platform, dependencySet] of Object.entries(field.platforms)) {
      if (platform !== 'react' && platform !== 'react-native') {
        throw new Error(
          `Component production input field "${key}.platforms" contains unsupported platform "${platform}".`
        );
      }

      const normalized = optionalDependencySet(
        dependencySet,
        `${key}.platforms.${platform}`
      );

      if (Object.keys(normalized).length > 0) {
        platforms[platform] = normalized;
      }
    }
  }

  const result: ComponentDependencies = {
    ...rootSet,
    ...(platforms && Object.keys(platforms).length > 0 ? { platforms } : {}),
  };

  return Object.keys(result).length > 0 ? result : undefined;
}

function optionalAssetRequirements(
  value: Record<string, unknown>,
  key: string
): ComponentAssetRequirement[] {
  const field = value[key];

  if (field === undefined) {
    return [];
  }

  if (!Array.isArray(field)) {
    throw new Error(
      `Component production input field "${key}" must be an array.`
    );
  }

  const result = field.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(
        `Component production input field "${key}[${index}]" must be an object.`
      );
    }

    for (const itemKey of Object.keys(item)) {
      if (!ASSET_REQUIREMENT_KEYS.has(itemKey)) {
        throw new Error(
          `Unknown component production asset requirement field "${itemKey}" at ${key}[${index}].`
        );
      }
    }

    return {
      path: requiredObjectString(item, 'path', `${key}[${index}].path`),
      purpose: requiredObjectString(
        item,
        'purpose',
        `${key}[${index}].purpose`
      ),
    };
  });
  const keys = result.map((asset) => `${asset.path}\u0000${asset.purpose}`);

  if (new Set(keys).size !== keys.length) {
    throw new Error(
      'Component production asset requirements must not contain duplicate path/purpose pairs.'
    );
  }

  return result;
}

function optionalIconRequirements(
  value: Record<string, unknown>,
  key: string
): ComponentIconRequirement[] {
  const field = value[key];

  if (field === undefined) {
    return [];
  }

  if (!Array.isArray(field)) {
    throw new Error(
      `Component production input field "${key}" must be an array.`
    );
  }

  return field.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(
        `Component production input field "${key}[${index}]" must be an object.`
      );
    }

    for (const itemKey of Object.keys(item)) {
      if (!ICON_REQUIREMENT_KEYS.has(itemKey)) {
        throw new Error(
          `Unknown component production icon requirement field "${itemKey}" at ${key}[${index}].`
        );
      }
    }

    return {
      name: requiredObjectString(item, 'name', `${key}[${index}].name`),
      purpose: requiredObjectString(
        item,
        'purpose',
        `${key}[${index}].purpose`
      ),
    };
  });
}

function requiredObjectString(
  value: Record<string, unknown>,
  key: string,
  label: string
): string {
  const field = value[key];

  if (typeof field !== 'string' || field.length === 0) {
    throw new Error(
      `Component production input field "${label}" must be a non-empty string.`
    );
  }

  return field;
}
