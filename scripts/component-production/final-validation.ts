import { spawnSync } from 'node:child_process';
import path from 'node:path';

import type {
  ComponentProductionFinding,
  ComponentProductionInputV1,
  ComponentProductionStageId,
  ComponentProductionStageResult,
} from './contracts';

const OUTPUT_SUMMARY_LIMIT = 4_000;

const FINAL_STAGE_IDS = [
  'public-api',
  'tooling',
  'visual',
  'smoke',
] as const satisfies readonly ComponentProductionStageId[];

type FinalStageId = (typeof FINAL_STAGE_IDS)[number];

export type ComponentProductionFinalCommand = {
  id: string;
  stage: FinalStageId;
  command: readonly string[];
  timeoutMs: number;
  platform?: 'react' | 'react-native';
};

export type ComponentProductionFinalCommandExecution = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: string;
};

export type ComponentProductionFinalCommandRunner = (
  command: ComponentProductionFinalCommand,
  root: string
) => ComponentProductionFinalCommandExecution;

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
  const [executable, ...args] = command.command;

  if (!executable) {
    return {
      exitCode: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      error: 'Component production final validation command is empty.',
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

function runStage(params: {
  root: string;
  stageId: FinalStageId;
  commands: readonly ComponentProductionFinalCommand[];
  runner: ComponentProductionFinalCommandRunner;
}): ComponentProductionStageResult {
  const findings: ComponentProductionFinding[] = [];
  let runtimeFailed = false;

  if (params.commands.length === 0) {
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

  for (const command of params.commands) {
    let execution: ComponentProductionFinalCommandExecution;

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
      const ruleId = semanticRuleIdForFailure(command, execution);
      findings.push({
        id: `${params.stageId}:${command.id}`,
        stage: params.stageId,
        severity: 'blocking',
        message: validationFailureMessage(command, execution),
        ...(command.platform ? { platform: command.platform } : {}),
        ...(ruleId ? { ruleId } : {}),
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

function validationFailureMessage(
  command: ComponentProductionFinalCommand,
  execution: ComponentProductionFinalCommandExecution
): string {
  const detail = summarizeExecutionOutput(execution);
  return detail
    ? `${command.id} exited with code ${execution.exitCode}: ${detail}`
    : `${command.id} exited with code ${execution.exitCode}.`;
}

function runtimeFailureMessage(
  command: ComponentProductionFinalCommand,
  execution: ComponentProductionFinalCommandExecution
): string {
  if (execution.timedOut) {
    return `${command.id} timed out after ${command.timeoutMs}ms.`;
  }
  if (execution.error) {
    return `${command.id} could not run: ${execution.error}`;
  }
  return `${command.id} did not produce a deterministic exit code.`;
}

function summarizeExecutionOutput(
  execution: ComponentProductionFinalCommandExecution
): string {
  return summarizeOutput(
    [execution.stdout, execution.stderr]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .join('\n')
  );
}

function summarizeOutput(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= OUTPUT_SUMMARY_LIMIT) {
    return normalized;
  }
  return `${normalized.slice(0, OUTPUT_SUMMARY_LIMIT)}\n… output truncated`;
}
