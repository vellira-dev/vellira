import { spawnSync } from 'node:child_process';

import type {
  ComponentProductionFinding,
  ComponentProductionStageId,
  ComponentProductionStageResult,
} from './contracts';
import { summarizeValidationCommandOutput } from './validation-output';

export type ValidationCommandDescriptor<
  TStage extends ComponentProductionStageId = ComponentProductionStageId,
> = {
  id: string;
  stage: TStage;
  command: readonly string[];
  timeoutMs: number;
  platform?: 'react' | 'react-native';
};

export type ValidationCommandExecution = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: string;
};

export type ValidationCommandRunner<
  TCommand extends ValidationCommandDescriptor = ValidationCommandDescriptor,
> = (
  command: TCommand,
  root: string
) => ValidationCommandExecution;

export type ValidationCommandInvocation<TExecution> =
  | { status: 'completed'; execution: TExecution }
  | { status: 'threw'; message: string };

export function invokeValidationCommand<TCommand, TExecution>(
  runner: (command: TCommand, root: string) => TExecution,
  command: TCommand,
  root: string
): ValidationCommandInvocation<TExecution> {
  try {
    return {
      status: 'completed',
      execution: runner(command, root),
    };
  } catch (error) {
    return {
      status: 'threw',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function runValidationCommandProcess(
  command: Pick<ValidationCommandDescriptor, 'command' | 'timeoutMs'>,
  root: string,
  *,
  emptyCommandError: string
): ValidationCommandExecution {
  const [executable, ...args] = command.command;

  if (!executable) {
    return {
      exitCode: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      error: emptyCommandError,
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
    ...(result.error ? { error: result.error.message } : {}),
  };
}

export function runValidationStage<
  TCommand extends ValidationCommandDescriptor,
>(params: {
  root: string;
  stageId: ComponentProductionStageId;
  commands: readonly TCommand[];
  runner: ValidationCommandRunner<TCommand>;
  requireCommand?: boolean;
  ruleIdForFailure?: (
    command: TCommand,
    execution: ValidationCommandExecution
  ) => string | undefined;
}): ComponentProductionStageResult {
  if (params.requireCommand && params.commands.length === 0) {
    return {
      id: params.stageId,
      status: 'failed',
      summary: `${params.stageId} validation could not resolve a required command.`,
      findings: [
        {
          id: `${params.stageId}:missing-command`,
          stage: params.stageId,
          severity: 'blocking',
          message: `No canonical command was resolved for required ${params.stageId} validation.`,
        },
      ],
      artifacts: [],
    };
  }

  const findings: ComponentProductionFinding[] = [];
  let runtimeFailed = false;

  for (const command of params.commands) {
    const invocation = invokeValidationCommand(
      params.runner,
      command,
      params.root
    );

    if (invocation.status === 'threw') {
      runtimeFailed = true;
      findings.push(
        validationFinding({
          stageId: params.stageId,
          command,
          message: invocation.message,
          runtime: true,
        })
      );
      continue;
    }

    const execution = invocation.execution;

    if (
      execution.timedOut ||
      execution.error !== undefined ||
      execution.exitCode === null
    ) {
      runtimeFailed = true;
      findings.push(
        validationFinding({
          stageId: params.stageId,
          command,
          message: runtimeFailureMessage(command, execution),
          runtime: true,
        })
      );
      continue;
    }

    if (execution.exitCode !== 0) {
      findings.push(
        validationFinding({
          stageId: params.stageId,
          command,
          message: validationFailureMessage(command, execution),
          ruleId: params.ruleIdForFailure?.(command, execution),
        })
      );
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

function validationFinding<TCommand extends ValidationCommandDescriptor>(params: {
  stageId: ComponentProductionStageId;
  command: TCommand;
  message: string;
  runtime?: boolean;
  ruleId?: string;
}): ComponentProductionFinding {
  return {
    id: `${params.stageId}:${params.command.id}${params.runtime ? ':runtime' : ''}`,
    stage: params.stageId,
    severity: 'blocking',
    message: params.message,
    ...(params.command.platform
      ? { platform: params.command.platform }
      : {}),
    ...(params.ruleId ? { ruleId: params.ruleId } : {}),
  };
}

function validationFailureMessage(
  command: ValidationCommandDescriptor,
  execution: ValidationCommandExecution
): string {
  const detail = summarizeValidationCommandOutput(execution);

  return detail
    ? `${command.id} exited with code ${execution.exitCode}: ${detail}`
    : `${command.id} exited with code ${execution.exitCode}.`;
}

function runtimeFailureMessage(
  command: ValidationCommandDescriptor,
  execution: ValidationCommandExecution
): string {
  if (execution.timedOut) {
    return `${command.id} timed out after ${command.timeoutMs}ms.`;
  }

  if (execution.error) {
    return `${command.id} could not run: ${execution.error}`;
  }

  return `${command.id} did not produce a deterministic exit code.`;
}
