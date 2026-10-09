import path from 'node:path';
import { fileURLToPath } from 'node:url';
import toolingBuildDependencies from '../ci/tooling-build-dependencies.json';

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
import { componentProductionVisualCommand } from './visual-environment';

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
  const commands: ComponentProductionFinalCommand[] = [
    {
      id: 'public-api',
      stage: 'public-api',
      command: ['pnpm', 'check:public-api'],
      timeoutMs: 120_000,
    },
    {
      id: 'tooling-harness-contracts',
      stage: 'tooling',
      command: [
        'node',
        fileURLToPath(new URL('../ci/run-tooling-tests.mjs', import.meta.url)),
        '--harness-contracts',
      ],
      timeoutMs: 120_000,
    },
    {
      id: 'tooling-contracts',
      stage: 'tooling',
      command: [
        'node',
        fileURLToPath(new URL('../ci/run-tooling-tests.mjs', import.meta.url)),
        '--source-contracts',
      ],
      // Protected Factory validation intentionally serializes this suite with
      // one Vitest worker for memory safety. The old 7-minute process budget
      // was shorter than a healthy serialized run and produced false runtime blocks.
      timeoutMs: 900_000,
    },
    {
      id: 'tooling-token-cli',
      stage: 'tooling',
      command: [
        'node',
        'node_modules/vitest/vitest.mjs',
        'run',
        '--config',
        'vitest.tooling.config.ts',
        '--reporter=default',
        '--maxWorkers=1',
        'scripts/checks/token-semantic/cli.test.ts',
      ],
      timeoutMs: 120_000,
    },
    {
      id: 'tooling-production-fixtures',
      stage: 'tooling',
      command: [
        'node',
        'node_modules/vitest/vitest.mjs',
        'run',
        '--config',
        'vitest.tooling.config.ts',
        '--reporter=default',
        '--maxWorkers=1',
        'scripts/component-production/e2e-fixtures.test.ts',
      ],
      // This file contains multiple production-shaped fixtures with their own
      // bounded 240-second test budgets. Keep the exact coverage and one-worker
      // memory bound, but give the aggregate command enough bounded wall time.
      timeoutMs: 720_000,
    },
  ];
  for (const group of toolingBuildDependencies) {
    commands.push({
      id: group.id,
      stage: 'tooling',
      command: [
        'node',
        'node_modules/vitest/vitest.mjs',
        'run',
        '--config',
        'vitest.tooling.config.ts',
        '--reporter=default',
        '--maxWorkers=1',
        ...group.files,
      ],
      timeoutMs: 120_000,
      requires: group.requires,
    });
  }
  if (componentProductionRequiresTokenSemanticGate(input)) {
    commands.push({
      id: 'tooling-token-semantics',
      stage: 'tooling',
      command: ['pnpm', 'check:tokens-semantic:strict', '--json'],
      resultFormat: 'token-semantic',
      timeoutMs: 120_000,
    });
  }

  if (input.platform === 'web' || input.platform === 'both') {
    commands.push({
      id: 'canonical-web-visual',
      stage: 'visual',
      command: componentProductionVisualCommand(),
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
        : blockedDependencies.length > 0
          ? {
              ...stage,
              summary: `${stage.summary} Deferred build consumers: ${[...new Set(blockedDependencies)].join(', ')}.`,
            }
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
    ruleIdForFailure: componentProductionFinalFailureRuleId,
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

export function componentProductionFinalFailureRuleId(
  command: Pick<ComponentProductionFinalCommand, 'id'>,
  execution: ComponentProductionFinalCommandExecution
): string | undefined {
  const output = [execution.stdout, execution.stderr].join('\n');
  if (command.id === 'tooling-harness-contracts') return 'validation.harness';
  if (
    command.id === 'canonical-web-visual' &&
    /Canonical visual environment check failed|docker: (?:not found|command not found)|(?:Cannot connect|permission denied).*docker|Docker daemon/i.test(
      output
    )
  ) {
    return 'validation.environment';
  }
  if (!['tooling-contracts', 'tooling-token-semantics'].includes(command.id))
    return undefined;

  return output.includes('Token semantic audit:')
    ? 'tokens.semantic-architecture'
    : undefined;
}
