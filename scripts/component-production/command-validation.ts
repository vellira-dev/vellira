import path from 'node:path';

import type {
  ComponentProductionInputV1,
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

type ComponentProductionCommandStage =
  | 'format'
  | 'lint'
  | 'tests'
  | 'typecheck'
  | 'build'
  | 'storybook'
  | 'docs'
  | 'website';

export type ComponentProductionCommand =
  ValidationCommandDescriptor<ComponentProductionCommandStage> & {
    requires?: readonly string[];
  };

export type ComponentProductionCommandExecution = ValidationCommandExecution;

export type ComponentProductionCommandRunner =
  ValidationCommandRunner<ComponentProductionCommand>;

export type ComponentProductionCommandValidationResult = {
  stages: readonly ComponentProductionStageResult[];
  commandStatuses?: Readonly<Record<string, 'passed' | 'blocked' | 'failed'>>;
};

export function componentProductionValidationCommands(
  input: ComponentProductionInputV1
): readonly ComponentProductionCommand[] {
  return [
    {
      id: 'format-check',
      stage: 'format',
      command: ['pnpm', 'format:check'],
      timeoutMs: 120_000,
    },
    {
      id: 'lint',
      stage: 'lint',
      command: ['pnpm', 'lint'],
      timeoutMs: 120_000,
    },
    {
      id: 'core-tests',
      stage: 'tests',
      command: ['pnpm', 'test:core'],
      timeoutMs: 180_000,
    },
    {
      id: 'metadata-tests',
      stage: 'tests',
      command: ['pnpm', 'test:metadata'],
      timeoutMs: 180_000,
    },
    ...(input.componentTokens !== false
      ? [
          {
            id: 'token-tests',
            stage: 'tests' as const,
            command: ['pnpm', 'test:tokens'],
            timeoutMs: 180_000,
          },
        ]
      : []),
    ...platformCommands(input),
    // Repository-wide tooling consumes both published package surfaces, even
    // when the candidate itself targets only one platform. Build prerequisites
    // explicitly; do not rely on incidental dist output from an earlier run.
    ...platformCommands({ ...input, platform: 'both' }).filter(
      (command) =>
        command.stage === 'build' &&
        !platformCommands(input).some((selected) => selected.id === command.id)
    ),
    {
      id: 'component-docs',
      stage: 'docs',
      command: ['pnpm', 'component-docs:check'],
      timeoutMs: 120_000,
    },
    {
      id: 'component-page-check',
      stage: 'website',
      command: [
        'pnpm',
        'create:component-page',
        input.componentName,
        '--force',
        '--check',
      ],
      timeoutMs: 120_000,
    },
    {
      id: 'component-page-audit',
      stage: 'website',
      command: [
        'pnpm',
        'component-pages:audit',
        '--component',
        input.componentName,
      ],
      timeoutMs: 120_000,
    },
    {
      id: 'website-typecheck',
      stage: 'website',
      command: ['pnpm', '--filter', '@vellira-ui/website', 'typecheck'],
      timeoutMs: 180_000,
      requires: componentProductionCommandDependencies('website-typecheck'),
    },
  ];
}

export function runComponentProductionCommandValidation(params: {
  root: string;
  input: ComponentProductionInputV1;
  runner?: ComponentProductionCommandRunner;
}): ComponentProductionCommandValidationResult {
  const root = path.resolve(params.root);
  const runner = params.runner ?? runComponentProductionCommand;
  const commands = componentProductionValidationCommands(params.input);

  const stageIds = [
    'format',
    'lint',
    'tests',
    'typecheck',
    'build',
    'storybook',
    'docs',
    'website',
  ] as const;

  const stages: ComponentProductionStageResult[] = [];
  const commandStatuses: Record<string, 'passed' | 'blocked' | 'failed'> = {};

  for (const stageId of stageIds) {
    const stageCommands = commands.filter(
      (command) => command.stage === stageId
    );
    const blockedDependencies = stageCommands.flatMap((command) =>
      (command.requires ?? []).filter(
        (dependency) => commandStatuses[dependency] !== 'passed'
      )
    );

    const runnableCommands = stageCommands.filter((command) =>
      (command.requires ?? []).every(
        (dependency) => commandStatuses[dependency] === 'passed'
      )
    );
    if (blockedDependencies.length > 0 && runnableCommands.length === 0) {
      stages.push(
        skippedStage(
          stageId,
          `Validation was dependency-blocked by ${[
            ...new Set(blockedDependencies),
          ].join(', ')}.`
        )
      );
      continue;
    }

    const stage = runStage({
      root,
      stageId,
      commands: runnableCommands,
      runner: (command, directory) => {
        const execution = runner(command, directory);
        commandStatuses[command.id] = commandExecutionStatus(execution);
        return execution;
      },
    });

    stages.push(
      blockedDependencies.length === 0
        ? stage
        : stage.status === 'passed'
          ? skippedStage(
              stageId,
              `Validation partially ran and was dependency-blocked by ${[...new Set(blockedDependencies)].join(', ')}.`
            )
          : {
              ...stage,
              summary: `${stage.summary} Deferred build consumers: ${[...new Set(blockedDependencies)].join(', ')}.`,
            }
    );
  }

  return {
    stages,
    commandStatuses,
  };
}

function commandExecutionStatus(
  execution: ComponentProductionCommandExecution
): 'passed' | 'blocked' | 'failed' {
  if (
    execution.timedOut ||
    execution.error !== undefined ||
    execution.exitCode === null
  ) {
    return 'failed';
  }
  return execution.exitCode === 0 ? 'passed' : 'blocked';
}

export function runComponentProductionCommand(
  command: ComponentProductionCommand,
  root: string
): ComponentProductionCommandExecution {
  return runValidationCommandProcess(
    command,
    root,
    'Component production command is empty.'
  );
}

function skippedStage(
  stageId: ComponentProductionCommand['stage'],
  summary: string
): ComponentProductionStageResult {
  return {
    id: stageId,
    status: 'skipped',
    summary,
    findings: [],
    artifacts: [],
  };
}

function runStage(params: {
  root: string;
  stageId: ComponentProductionCommandStage;
  commands: readonly ComponentProductionCommand[];
  runner: ComponentProductionCommandRunner;
}): ComponentProductionStageResult {
  return runValidationStage(params);
}

function platformCommands(
  input: ComponentProductionInputV1
): ComponentProductionCommand[] {
  const commands: ComponentProductionCommand[] = [];

  if (input.platform === 'web' || input.platform === 'both') {
    commands.push(
      {
        id: 'react-tests',
        stage: 'tests',
        command: ['pnpm', '--filter', '@vellira-ui/react', 'test'],
        timeoutMs: 180_000,
        platform: 'react',
      },
      {
        id: 'react-typecheck',
        stage: 'typecheck',
        command: ['pnpm', '--filter', '@vellira-ui/react', 'typecheck'],
        timeoutMs: 180_000,
        platform: 'react',
      },
      {
        id: 'react-build',
        stage: 'build',
        command: ['pnpm', '--filter', '@vellira-ui/react...', 'build'],
        timeoutMs: 300_000,
        platform: 'react',
      },
      {
        id: 'react-storybook-build',
        stage: 'storybook',
        command: ['pnpm', 'build:storybook'],
        timeoutMs: 300_000,
        platform: 'react',
        requires: componentProductionCommandDependencies(
          'react-storybook-build'
        ),
      }
    );
  }

  if (input.platform === 'native' || input.platform === 'both') {
    commands.push(
      {
        id: 'react-native-tests',
        stage: 'tests',
        command: ['pnpm', '--filter', '@vellira-ui/react-native', 'test'],
        timeoutMs: 180_000,
        platform: 'react-native',
      },
      {
        id: 'react-native-typecheck',
        stage: 'typecheck',
        command: ['pnpm', '--filter', '@vellira-ui/react-native', 'typecheck'],
        timeoutMs: 180_000,
        platform: 'react-native',
      },
      {
        id: 'react-native-build',
        stage: 'build',
        command: ['pnpm', '--filter', '@vellira-ui/react-native...', 'build'],
        timeoutMs: 300_000,
        platform: 'react-native',
      }
    );
  }

  return commands;
}
