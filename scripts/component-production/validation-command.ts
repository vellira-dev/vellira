import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  ComponentProductionFinding,
  ComponentProductionStageId,
  ComponentProductionStageResult,
} from './contracts';
import { summarizeValidationCommandOutput } from './validation-output';
import { structuredCommandFindings } from './structured-command-findings';

export type ValidationCommandDescriptor<
  TStage extends ComponentProductionStageId = ComponentProductionStageId,
> = {
  id: string;
  stage: TStage;
  command: readonly string[];
  timeoutMs: number;
  platform?: 'react' | 'react-native';
  resultFormat?: 'token-semantic' | 'component-quality';
  componentName?: string;
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
> = (command: TCommand, root: string) => ValidationCommandExecution;

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
  emptyCommandError: string
): ValidationCommandExecution {
  const [executable, ...args] = canonicalProjectionCheckCommand(
    command.command,
    root
  );

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
    // Setup owns the frozen dependency installation. Validation and nested
    // fixture commands may use it, but must not reinstall/purge it implicitly.
    env: {
      ...process.env,
      PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: 'false',
      pnpm_config_verify_deps_before_run: 'false',
    },
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

// A pinned validator may inspect an older candidate checkout. Its projection
// checks must use the generator from that validator, without overlaying tooling
// into the candidate or switching package builds away from candidate source.
function canonicalProjectionCheckCommand(
  command: readonly string[],
  root: string
) {
  const toolsRoot = fileURLToPath(new URL('../../', import.meta.url));
  if (path.resolve(root) === path.resolve(toolsRoot)) return command;
  let script: string;
  let args: readonly string[];
  if (
    command.length === 5 &&
    command[0] === 'pnpm' &&
    command[1] === 'create:component-page' &&
    /^[A-Z][A-Za-z0-9]*$/.test(command[2]) &&
    command[3] === '--force' &&
    command[4] === '--check'
  ) {
    script = 'create-component-page.ts';
    args = command.slice(2);
  } else if (
    command.length === 4 &&
    command[0] === 'pnpm' &&
    command[1] === 'component-pages:audit' &&
    command[2] === '--component' &&
    /^[A-Z][A-Za-z0-9]*$/.test(command[3])
  ) {
    script = 'audit-component-pages.ts';
    args = command.slice(2);
  } else {
    return command;
  }
  return [
    process.execPath,
    '--import',
    path.join(toolsRoot, 'node_modules/tsx/dist/loader.mjs'),
    path.join(toolsRoot, 'scripts/generators/component-page', script),
    ...args,
  ];
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
      try {
        const structured = structuredCommandFindings(command, execution);
        if (structured !== null) {
          findings.push(...structured);
          continue;
        }
      } catch (error) {
        runtimeFailed = true;
        findings.push(
          validationFinding({
            stageId: params.stageId,
            command,
            message: `Structured diagnostic failed: ${String(error)}\n${validationFailureMessage(command, execution)}`,
            runtime: true,
          })
        );
        continue;
      }
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

function validationFinding<
  TCommand extends ValidationCommandDescriptor,
>(params: {
  stageId: ComponentProductionStageId;
  command: TCommand;
  message: string;
  runtime?: boolean;
  ruleId?: string;
}): ComponentProductionFinding {
  return {
    id: `${params.stageId}:${params.command.id}${
      params.runtime ? ':runtime' : ''
    }`,
    stage: params.stageId,
    severity: 'blocking',
    message: params.message,
    ...(params.command.platform ? { platform: params.command.platform } : {}),
    ...(params.runtime
      ? { ruleId: 'validation.runtime' }
      : params.ruleId
        ? { ruleId: params.ruleId }
        : {}),
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
  const detail = summarizeValidationCommandOutput(execution);
  const suffix = detail
    ? `\nPartial command evidence (not a completed validation):\n${detail}`
    : '';
  if (execution.timedOut) {
    return `${command.id} timed out after ${command.timeoutMs}ms.${suffix}`;
  }

  if (execution.error) {
    return `${command.id} could not run: ${execution.error}${suffix}`;
  }

  return `${command.id} did not produce a deterministic exit code.${suffix}`;
}
