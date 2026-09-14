import type { ComponentCompletenessResult } from '../checks/component-completeness/types';
import type { ComponentQualityRunResult } from '../checks/component-quality/types';

import {
  parseCandidateSnapshot,
  verifyCandidateSnapshot,
  type CandidateSnapshotV1,
} from './candidate-snapshot';

import {
  runComponentProductionCommandValidation,
  type ComponentProductionCommandValidationResult,
} from './command-validation';
import {
  createComponentProductionResult,
  createComponentProductionValidationLifecycle,
  createComponentProductionValidationSummary,
  parseComponentProductionInput,
  type ComponentProductionInputV1,
  type ComponentProductionResultV1,
  type ComponentProductionStageId,
  type ComponentProductionStageResult,
  type ComponentProductionValidationResultV1,
} from './contracts';
import {
  runComponentProductionFinalValidation,
  type ComponentProductionFinalValidationResult,
} from './final-validation';
import {
  runComponentProductionGeneration,
  type ComponentProductionGenerationResult,
} from './generation';
import {
  runComponentReviewBundle,
  type ComponentReviewBundleReport,
} from './review-bundle';
import {
  runComponentProductionStructuredValidation,
  type ComponentProductionStructuredValidationResult,
} from './structured-validation';

const FINAL_VALIDATION_STAGE_IDS = [
  'public-api',
  'tooling',
  'visual',
  'smoke',
] as const satisfies readonly ComponentProductionStageId[];

const VALIDATION_STAGE_IDS = [
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
  ...FINAL_VALIDATION_STAGE_IDS,
] as const satisfies readonly ComponentProductionStageId[];

export type ComponentProductionValidationResult = {
  stages: readonly ComponentProductionStageResult[];
  completeness: readonly ComponentCompletenessResult[] | null;
  quality: ComponentQualityRunResult | null;
  reviewBundle: ComponentReviewBundleReport | null;
};

export type ComponentProductionValidationResultWithReviewBundle =
  ComponentProductionValidationResultV1 & {
    reviewBundle: ComponentReviewBundleReport | null;
  };

export type ComponentProductionRunDependencies = {
  runGeneration?: (params: {
    root: string;
    input: ComponentProductionInputV1;
  }) => Promise<ComponentProductionGenerationResult>;
  runCommandValidation?: (params: {
    root: string;
    input: ComponentProductionInputV1;
  }) => ComponentProductionCommandValidationResult;
  runStructuredValidation?: (params: {
    root: string;
    input: ComponentProductionInputV1;
  }) => Promise<ComponentProductionStructuredValidationResult>;
  runFinalValidation?: (params: {
    root: string;
    input: ComponentProductionInputV1;
  }) => ComponentProductionFinalValidationResult;
  runReviewBundle?: typeof runComponentReviewBundle;
};

export async function runComponentProduction(params: {
  root: string;
  input: unknown;
  dependencies?: ComponentProductionRunDependencies;
}): Promise<ComponentProductionResultV1> {
  const input = parseComponentProductionInput(params.input);

  const runGeneration =
    params.dependencies?.runGeneration ?? runComponentProductionGeneration;

  const generation = await runGeneration({
    root: params.root,
    input,
  });

  if (
    generation.preflight.status !== 'passed' ||
    generation.generation.status !== 'passed'
  ) {
    const reason =
      'Semantic completion and validation were skipped because component generation did not pass.';

    return createComponentProductionResult({
      input,
      stages: [
        generation.preflight,
        generation.generation,
        skippedStage('semantic-completion', reason),
        ...skippedValidationStages(reason),
      ],
      completeness: null,
      quality: null,
    });
  }

  const semanticCompletion: ComponentProductionStageResult = {
    id: 'semantic-completion',
    status: 'blocked',
    summary:
      'Canonical scaffolding completed. Component-specific API, behavior, accessibility and design decisions must be completed before validation.',
    findings: [
      {
        id: 'semantic-completion:required',
        stage: 'semantic-completion',
        severity: 'blocking',
        message:
          'Generation success does not imply semantic completion. Complete the component candidate, then run component-production:validate:json with the same specification.',
      },
    ],
    artifacts: [],
  };

  return createComponentProductionResult({
    input,
    stages: [
      generation.preflight,
      generation.generation,
      semanticCompletion,
      ...skippedValidationStages(
        'Validation is pending semantic completion of the generated scaffold.'
      ),
    ],
    completeness: null,
    quality: null,
  });
}

export async function runComponentProductionValidation(params: {
  root: string;
  input: unknown;
  candidateSnapshot?: CandidateSnapshotV1;
  dependencies?: Pick<
    ComponentProductionRunDependencies,
    | 'runCommandValidation'
    | 'runStructuredValidation'
    | 'runFinalValidation'
    | 'runReviewBundle'
  >;
}): Promise<ComponentProductionValidationResultWithReviewBundle> {
  const input = parseComponentProductionInput(params.input);

  const validation = await validateComponentProductionCandidate({
    root: params.root,
    input,
    candidateSnapshot: params.candidateSnapshot,
    dependencies: params.dependencies,
  });

  assertValidationStageSequence(validation.stages);

  const validationSummary = createComponentProductionValidationSummary(
    validation.stages
  );

  const blockingFindings = validation.stages.flatMap((stage) =>
    stage.findings.filter((finding) => finding.severity === 'blocking')
  );

  if (validationSummary.status !== 'ready' && blockingFindings.length === 0) {
    throw new Error(
      'Blocked or failed component production validation requires at least one blocking finding.'
    );
  }

  return {
    schemaVersion: input.schemaVersion,
    input,
    status: validationSummary.status,
    readyForReview: validationSummary.status === 'ready',
    lifecycle: createComponentProductionValidationLifecycle(validation.stages),
    stages: validation.stages,
    blockingFindings,
    validationSummary,
    completeness: validation.completeness,
    quality: validation.quality,
    reviewBundle: validation.reviewBundle,
  };
}

export async function validateComponentProductionCandidate(params: {
  root: string;
  input: ComponentProductionInputV1;
  candidateSnapshot?: CandidateSnapshotV1;
  dependencies?: Pick<
    ComponentProductionRunDependencies,
    | 'runCommandValidation'
    | 'runStructuredValidation'
    | 'runFinalValidation'
    | 'runReviewBundle'
  >;
}): Promise<ComponentProductionValidationResult> {
  // Copy/canonicalize before awaiting validators; a caller cannot mutate authority
  // mid-run. Earlier validation failures still return no review bundle.
  const candidateSnapshot =
    params.candidateSnapshot === undefined
      ? undefined
      : parseCandidateSnapshot(params.candidateSnapshot);
  const before =
    candidateSnapshot === undefined
      ? undefined
      : verifyCandidateSnapshot(params.root, candidateSnapshot);
  const runCommandValidation =
    params.dependencies?.runCommandValidation ??
    runComponentProductionCommandValidation;

  const runStructuredValidation =
    params.dependencies?.runStructuredValidation ??
    runComponentProductionStructuredValidation;

  const runFinalValidation =
    params.dependencies?.runFinalValidation ??
    runComponentProductionFinalValidation;

  const runReviewBundle =
    params.dependencies?.runReviewBundle ??
    (params.dependencies === undefined || candidateSnapshot !== undefined
      ? runComponentReviewBundle
      : null);

  const commandValidation = runCommandValidation({
    root: params.root,
    input: params.input,
  });

  const blockingCommandStage = commandValidation.stages.find(
    (stage) => stage.status !== 'passed'
  );

  if (blockingCommandStage) {
    const reason = `Structured and final validation were skipped because ${blockingCommandStage.id} validation did not pass.`;

    return {
      stages: [
        ...commandValidation.stages,
        skippedStage('completeness', reason),
        skippedStage('quality', reason),
        ...skippedFinalValidationStages(reason),
      ],
      completeness: null,
      quality: null,
      reviewBundle: null,
    };
  }

  const structuredValidation = await runStructuredValidation({
    root: params.root,
    input: params.input,
  });

  const blockingStructuredStage = structuredValidation.stages.find(
    (stage) => stage.status !== 'passed'
  );

  if (blockingStructuredStage) {
    const reason = `Final validation was skipped because ${blockingStructuredStage.id} validation did not pass.`;

    return {
      stages: [
        ...commandValidation.stages,
        ...structuredValidation.stages,
        ...skippedFinalValidationStages(reason),
      ],
      completeness: structuredValidation.completeness,
      quality: structuredValidation.quality,
      reviewBundle: null,
    };
  }

  const finalValidation = runFinalValidation({
    root: params.root,
    input: params.input,
  });
  const blockingFinalStage = finalValidation.stages.find(
    (stage) => stage.status !== 'passed'
  );

  if (blockingFinalStage || !runReviewBundle) {
    return {
      stages: [
        ...commandValidation.stages,
        ...structuredValidation.stages,
        ...finalValidation.stages,
      ],
      completeness: structuredValidation.completeness,
      quality: structuredValidation.quality,
      reviewBundle: null,
    };
  }

  const reviewBundle = runReviewBundle({
    root: params.root,
    input: params.input,
    completenessStage: structuredValidation.stages[0],
    candidateSnapshot,
    snapshotIssuesBeforeValidation:
      before && !before.valid ? before.issues : [],
  });

  return {
    stages: [
      ...commandValidation.stages,
      reviewBundle.completenessStage,
      structuredValidation.stages[1],
      ...finalValidation.stages,
    ],
    completeness: structuredValidation.completeness,
    quality: structuredValidation.quality,
    reviewBundle: reviewBundle.report,
  };
}

function assertValidationStageSequence(
  stages: readonly ComponentProductionStageResult[]
): void {
  if (stages.length !== VALIDATION_STAGE_IDS.length) {
    throw new Error(
      'Component production validation result must contain every canonical validation stage exactly once.'
    );
  }

  for (let index = 0; index < VALIDATION_STAGE_IDS.length; index += 1) {
    const expected = VALIDATION_STAGE_IDS[index];
    const actual = stages[index]?.id;

    if (actual !== expected) {
      throw new Error(
        `Component production validation stage order mismatch at index ${index}: expected "${expected}", got "${String(actual)}".`
      );
    }
  }
}

function skippedStage(
  id: ComponentProductionStageId,
  reason: string
): ComponentProductionStageResult {
  return {
    id,
    status: 'skipped',
    summary: reason,
    findings: [],
    artifacts: [],
  };
}

function skippedFinalValidationStages(
  reason: string
): ComponentProductionStageResult[] {
  return FINAL_VALIDATION_STAGE_IDS.map((id) => skippedStage(id, reason));
}

function skippedValidationStages(
  reason: string
): ComponentProductionStageResult[] {
  return VALIDATION_STAGE_IDS.map((id) => skippedStage(id, reason));
}
