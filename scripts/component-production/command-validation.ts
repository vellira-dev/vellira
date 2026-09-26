import { spawnSync } from 'node:child_process';
import path from 'node:path';

import type {
  ComponentProductionFinding,
  ComponentProductionInputV1,
  ComponentProductionStageResult,
} from './contracts';
import { summarizeValidationCommandOutput } from './validation-output';

export type ComponentProductionCommand = {
  id: string;
  stage:
    | 'format'
    | 'lint'
    | 'tests'
    | 'typecheck'
    | 'build'
    | 'storybook'
    | 'docs'
    | 'website';
  command: readonly string[];
  timeoutMs: number;
  platform?: 'react' | 'react-native';
};

export type ComponentProductionCommandExecution = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: string;
};

export type ComponentProductionCommandRunner = (
  command: ComponentProductionCommand,
  root: string
) => ComponentProductionCommandExecution;

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
  const [executable, ...args] = command.command;

  if (!executable) {
    return {
      exitCode: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      error: 'Component production command is empty.',
    };
  }

  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: command.timeoutMs,
    shell: false,
  });

  const errorCode =
    result.error &&
    'code' in result.error &&
    typeof result.error.code === 'string'
      ? result.error.code
      : undefined;

  return {
    exitCode: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    timedOut: errorCode === 'ETIMEDOUT',
    ...(result.error
      ? {
          error: result.error.message,
        }
      : {}),
  };
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
  stageId:
    | 'format'
    | 'lint'
    | 'tests'
    | 'typecheck'
    | 'build'
    | 'storybook'
    | 'docs'
    | 'website';
  commands: readonly ComponentProductionCommand[];
  runner: ComponentProductionCommandRunner;
}): ComponentProductionStageResult {
  const findings: ComponentProductionFinding[] = [];
  let runtimeFailed = false;

  for (const command of params.commands) {
    let execution: ComponentProductionCommandExecution;

    try {
      execution = params.runner(command, params.root);
    } catch (error) {
      runtimeFailed = true;

      findings.push({
        id: `${params.stageId}:${command.id}:runtime`,
        stage: params.stageId,
        severity: 'blocking',
        message: error instanceof Error ? error.message : String(error),
        ...(command.platform ? { platform: command.platform } : {}),
      });

      continue;
    }

    if (
      execution.timedOut ||
      execution.error !== undefined ||
      execution.exitCode === null
    ) {
      runtimeFailed = true;

      findings.push({
        id: `${params.stageId}:${command.id}:runtime`,
        stage: params.stageId,
        severity: 'blocking',
        message: runtimeFailureMessage(command, execution),
        ...(command.platform ? { platform: command.platform } : {}),
      });

      continue;
    }

    if (execution.exitCode !== 0) {
      findings.push({
        id: `${params.stageId}:${command.id}`,
        stage: params.stageId,
        severity: 'blocking',
        message: validationFailureMessage(command, execution),
        ...(command.platform ? { platform: command.platform } : {}),
      });
    }
  }

  if (runtimeFailed) {
    return {
      id: params.stageId,
      status: 'failed',
      summary: `${params.stageId} validation could not complete reliably.`,
      findings,
      artifacts: [],
    };
  }

  if (findings.length > 0) {
    return {
      id: params.stageId,
      status: 'blocked',
      summary: `${params.stageId} validation detected blocking findings.`,
      findings,
      artifacts: [],
    };
  }

  return {
    id: params.stageId,
    status: 'passed',
    summary: `${params.stageId} validation passed.`,
    findings: [],
    artifacts: [],
  };
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

function validationFailureMessage(
  command: ComponentProductionCommand,
  execution: ComponentProductionCommandExecution
): string {
  const detail = summarizeValidationCommandOutput(execution);

  return detail
    ? `${command.id} exited with code ${execution.exitCode}: ${detail}`
    : `${command.id} exited with code ${execution.exitCode}.`;
}

function runtimeFailureMessage(
  command: ComponentProductionCommand,
  execution: ComponentProductionCommandExecution
): string {
  if (execution.timedOut) {
    return `${command.id} timed out after ${command.timeoutMs}ms.`;
  }

  if (execution.error) {
    return `${command.id} could not run: ${execution.error}`;
  }

  return `${command.id} did not produce a deterministic exit code.`;
}

