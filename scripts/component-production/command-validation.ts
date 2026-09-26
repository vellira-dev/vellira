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
  ValidationCommandDescriptor<ComponentProductionCommandStage>;

export type ComponentProductionCommandExecution = ValidationCommandExecution;

export type ComponentProductionCommandRunner =
  ValidationCommandRunner<ComponentProductionCommand>;

export type ComponentProductionCommandValidationResult = {
  stages: readonly ComponentProductionStageResult[];
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
  let blockingStage: ComponentProductionStageResult | null = null;

  for (const stageId of stageIds) {
    if (blockingStage) {
      stages.push(
        skippedStage(
          stageId,
          `Validation was skipped because ${blockingStage.id} validation did not pass.`
        )
      );

      continue;
    }

    const stage = runStage({
      root,
      stageId,
      commands: commands.filter((command) => command.stage === stageId),
      runner,
    });

    stages.push(stage);

    if (stage.status !== 'passed') {
      blockingStage = stage;
    }
  }

  return {
    stages,
  };
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
