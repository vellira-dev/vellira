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
import { componentProductionCommandDependencies } from './validation-dependencies';

const FINAL_STAGE_IDS = [
  'public-api',
  'tooling',
  'visual',
  'smoke',
] as const satisfies readonly ComponentProductionStageId[];

type FinalStageId = (typeof FINAL_STAGE_IDS)[number];

export type ComponentProductionFinalCommand =
  ValidationCommandDescriptor<FinalStageId> & {
    requires?: readonly string[];
  };

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
      requires: componentProductionCommandDependencies('canonical-web-visual'),
    });
  }

  if (input.platform === 'web' || input.platform === 'both') {
    commands.push({
      id: 'web-smoke',
      stage: 'smoke',
      command: ['pnpm', 'smoke:web'],
      timeoutMs: 180_000,
      platform: 'react',
      requires: componentProductionCommandDependencies('web-smoke'),
    });
  }

  if (input.platform === 'native' || input.platform === 'both') {
    commands.push({
      id: 'native-smoke',
      stage: 'smoke',
      command: ['pnpm', 'smoke:native'],
      timeoutMs: 180_000,
      platform: 'react-native',
      requires: componentProductionCommandDependencies('native-smoke'),
    });
  }

  return commands;
}

export function runComponentProductionFinalValidation(params: {
  root: string;
  input: ComponentProductionInputV1;
  runner?: ComponentProductionFinalCommandRunner;
  commandStatuses?: Readonly<Record<string, 'passed' | 'blocked' | 'failed'>>;
}): ComponentProductionFinalValidationResult {
  const root = path.resolve(params.root);
  const runner = params.runner ?? runComponentProductionFinalCommand;
  const commands = componentProductionFinalValidationCommands(params.input);
  const stages: ComponentProductionStageResult[] = [];

  for (const stageId of FINAL_STAGE_IDS) {
    const stageCommands = commands.filter(
      (command) => command.stage === stageId
    );
    const runnableCommands = params.commandStatuses
      ? stageCommands.filter((command) =>
          (command.requires ?? []).every(
            (dependency) => params.commandStatuses?.[dependency] === 'passed'
          )
        )
      : stageCommands;
    const blockedDependencies = stageCommands.flatMap((command) =>
      runnableCommands.includes(command)
        ? []
        : (command.requires ?? []).filter(
            (dependency) => params.commandStatuses?.[dependency] !== 'passed'
          )
    );
    if (
      params.commandStatuses &&
      blockedDependencies.length > 0 &&
      runnableCommands.length === 0
    ) {
      stages.push(
        skippedStage(
          stageId,
          `Final validation was dependency-blocked by ${[
            ...new Set(blockedDependencies),
          ].join(', ')}.`
        )
      );
      continue;
    }

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
      commands: runnableCommands,
      runner,
    });

    stages.push(
      blockedDependencies.length > 0 && stage.status === 'passed'
        ? skippedStage(
            stageId,
            `Final validation partially ran and was dependency-blocked by ${[
              ...new Set(blockedDependencies),
            ].join(', ')}.`
          )
        : stage
    );
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
