import path from 'node:path';

import type {
  ComponentProductionInputV1,
  ComponentProductionStageId,
  ComponentProductionStageResult,
} from './contracts';
import {
  runValidationCommandProcess,
  runValidationStage,
  type ValidationCommandDescriptor,
  type ValidationCommandExecution,
  type ValidationCommandRunner,
} from './validation-command';

const FINAL_STAGE_IDS = [
  'public-api',
  'tooling',
  'visual',
  'smoke',
] as const satisfies readonly ComponentProductionStageId[];

type FinalStageId = (typeof FINAL_STAGE_IDS)[number];

export type ComponentProductionFinalCommand =
  ValidationCommandDescriptor<FinalStageId>;

export type ComponentProductionFinalCommandExecution =
  ValidationCommandExecution;

export type ComponentProductionFinalCommandRunner =
  ValidationCommandRunner<ComponentProductionFinalCommand>;

export type ComponentProductionFinalValidationResult = {
  stages: readonly ComponentProductionStageResult[];
};

export function componentProductionRequiresTokenSemanticGate(
  input: ComponentProductionInputV1
): boolean {
  return input.componentTokens !== false || (input.tokens?.length ?? 0) > 0;
}

export function componentProductionFinalValidationCommands(
  input: ComponentProductionInputV1
): readonly ComponentProductionFinalCommand[] {
  const toolingCommand = componentProductionRequiresTokenSemanticGate(input)
    ? 'test:tooling:readiness'
    : 'test:tooling';
  const commands: ComponentProductionFinalCommand[] = [
    {
      id: 'public-api',
      stage: 'public-api',
      command: ['pnpm', 'check:public-api'],
      timeoutMs: 120_000,
    },
    {
      id: 'tooling-contracts',
      stage: 'tooling',
      command: ['pnpm', toolingCommand],
      timeoutMs: 420_000,
    },
  ];

  if (input.platform === 'web' || input.platform === 'both') {
    commands.push({
      id: 'canonical-web-visual',
      stage: 'visual',
      command: ['pnpm', 'test:e2e:web:visual:docker'],
      timeoutMs: 600_000,
      platform: 'react',
    });
  }

  if (input.platform === 'web' || input.platform === 'both') {
    commands.push({
      id: 'web-smoke',
      stage: 'smoke',
      command: ['pnpm', 'smoke:web'],
      timeoutMs: 180_000,
      platform: 'react',
    });
  }

  if (input.platform === 'native' || input.platform === 'both') {
    commands.push({
      id: 'native-smoke',
      stage: 'smoke',
      command: ['pnpm', 'smoke:native'],
      timeoutMs: 180_000,
      platform: 'react-native',
    });
  }

  return commands;
}

export function runComponentProductionFinalValidation(params: {
  root: string;
  input: ComponentProductionInputV1;
  runner?: ComponentProductionFinalCommandRunner;
}): ComponentProductionFinalValidationResult {
  const root = path.resolve(params.root);
  const runner = params.runner ?? runComponentProductionFinalCommand;
  const commands = componentProductionFinalValidationCommands(params.input);
  const stages: ComponentProductionStageResult[] = [];
  let blockingStage: ComponentProductionStageResult | null = null;

  for (const stageId of FINAL_STAGE_IDS) {
    if (blockingStage) {
      stages.push(
        skippedStage(
          stageId,
          `Final validation was skipped because ${blockingStage.id} validation did not pass.`
        )
      );
      continue;
    }

    const stageCommands = commands.filter(
      (command) => command.stage === stageId
    );

    if (stageId === 'visual' && stageCommands.length === 0) {
      stages.push({
        id: 'visual',
        status: 'passed',
        summary:
          'Canonical Web visual regression is not applicable to a native-only component candidate.',
        findings: [],
        artifacts: [],
      });
      continue;
    }

    const stage = runStage({
      root,
      stageId,
      commands: stageCommands,
      runner,
    });

    stages.push(stage);

    if (stage.status !== 'passed') {
      blockingStage = stage;
    }
  }

  return { stages };
}

export function runComponentProductionFinalCommand(
  command: ComponentProductionFinalCommand,
  root: string
): ComponentProductionFinalCommandExecution {
  return runValidationCommandProcess(
    command,
    root,
    'Component production final validation command is empty.'
  );
}

function runStage(params: {
  root: string;
  stageId: FinalStageId;
  commands: readonly ComponentProductionFinalCommand[];
  runner: ComponentProductionFinalCommandRunner;
}): ComponentProductionStageResult {
  return runValidationStage({
    ...params,
    requireCommand: true,
    ruleIdForFailure: semanticRuleIdForFailure,
  });
}

function skippedStage(
  id: FinalStageId,
  summary: string
): ComponentProductionStageResult {
  return {
    id,
    status: 'skipped',
    summary,
    findings: [],
    artifacts: [],
  };
}

function semanticRuleIdForFailure(
  command: ComponentProductionFinalCommand,
  execution: ComponentProductionFinalCommandExecution
): string | undefined {
  if (command.id !== 'tooling-contracts') return undefined;

  const output = [execution.stdout, execution.stderr].join('\n');
  return output.includes('Token semantic audit:')
    ? 'tokens.semantic-architecture'
    : undefined;
}
