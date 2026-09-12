import { describe, expect, it } from 'vitest';

import type { ComponentProductionInputV1 } from './contracts';
import {
  componentProductionFinalValidationCommands,
  componentProductionRequiresTokenSemanticGate,
  runComponentProductionFinalValidation,
  type ComponentProductionFinalCommandExecution,
} from './final-validation';

const WEB_INPUT: ComponentProductionInputV1 = {
  schemaVersion: '1',
  componentName: 'Avatar',
  platform: 'web',
  layer: 'primitives',
  category: 'data-display',
  profile: 'base',
  capabilities: [],
  componentTokens: 'standard',
  parts: [],
};

describe('componentProductionFinalValidationCommands', () => {
  it('selects canonical Web final gates including token semantic architecture', () => {
    expect(componentProductionRequiresTokenSemanticGate(WEB_INPUT)).toBe(true);
    expect(
      componentProductionFinalValidationCommands(WEB_INPUT).map(
        (command) => command.id
      )
    ).toEqual([
      'public-api',
      'tooling-contracts',
      'token-semantic-architecture',
      'canonical-web-visual',
      'web-smoke',
    ]);
  });

  it('does not run Web visual validation for native-only candidates', () => {
    expect(
      componentProductionFinalValidationCommands({
        ...WEB_INPUT,
        platform: 'native',
      }).map((command) => command.id)
    ).toEqual([
      'public-api',
      'tooling-contracts',
      'token-semantic-architecture',
      'native-smoke',
    ]);
  });

  it('runs one canonical visual gate and both smoke paths for cross-platform candidates', () => {
    expect(
      componentProductionFinalValidationCommands({
        ...WEB_INPUT,
        platform: 'both',
      }).map((command) => command.id)
    ).toEqual([
      'public-api',
      'tooling-contracts',
      'token-semantic-architecture',
      'canonical-web-visual',
      'web-smoke',
      'native-smoke',
    ]);
  });

  it('does not add the semantic gate when a candidate owns no token contract or token resource', () => {
    const input: ComponentProductionInputV1 = {
      ...WEB_INPUT,
      componentTokens: false,
    };

    expect(componentProductionRequiresTokenSemanticGate(input)).toBe(false);
    expect(
      componentProductionFinalValidationCommands(input).map(
        (command) => command.id
      )
    ).toEqual([
      'public-api',
      'tooling-contracts',
      'canonical-web-visual',
      'web-smoke',
    ]);
  });

  it('adds the semantic gate for an explicit token dependency even without component tokens', () => {
    const input: ComponentProductionInputV1 = {
      ...WEB_INPUT,
      componentTokens: false,
      tokens: ['semantic.surface.canvas'],
    };

    expect(componentProductionRequiresTokenSemanticGate(input)).toBe(true);
    expect(
      componentProductionFinalValidationCommands(input).map(
        (command) => command.id
      )
    ).toContain('token-semantic-architecture');
  });
});

describe('runComponentProductionFinalValidation', () => {
  it('returns all final stages passed for a clean Web candidate', () => {
    const result = runComponentProductionFinalValidation({
      root: '/tmp/vellira-production',
      input: WEB_INPUT,
      runner: () => success(),
    });

    expect(result.stages.map((stage) => [stage.id, stage.status])).toEqual([
      ['public-api', 'passed'],
      ['tooling', 'passed'],
      ['visual', 'passed'],
      ['smoke', 'passed'],
    ]);
  });

  it('represents native-only visual validation as explicit non-applicability, not a skip', () => {
    const calls: string[] = [];
    const result = runComponentProductionFinalValidation({
      root: '/tmp/vellira-production',
      input: { ...WEB_INPUT, platform: 'native' },
      runner: (command) => {
        calls.push(command.id);
        return success();
      },
    });

    expect(calls).not.toContain('canonical-web-visual');
    expect(result.stages.find((stage) => stage.id === 'visual')).toMatchObject({
      status: 'passed',
      summary: expect.stringContaining('not applicable'),
    });
  });

  it('blocks readiness when public API integrity fails', () => {
    const result = runComponentProductionFinalValidation({
      root: '/tmp/vellira-production',
      input: WEB_INPUT,
      runner: (command) =>
        command.id === 'public-api'
          ? {
              exitCode: 1,
              stdout: '',
              stderr: 'Public API drift detected.',
              timedOut: false,
            }
          : success(),
    });

    expect(result.stages.map((stage) => [stage.id, stage.status])).toEqual([
      ['public-api', 'blocked'],
      ['tooling', 'skipped'],
      ['visual', 'skipped'],
      ['smoke', 'skipped'],
    ]);
    expect(result.stages[0]?.findings[0]?.message).toContain(
      'Public API drift detected.'
    );
  });

  it('blocks readiness when token semantic architecture fails for a token-bearing candidate', () => {
    const result = runComponentProductionFinalValidation({
      root: '/tmp/vellira-production',
      input: WEB_INPUT,
      runner: (command) =>
        command.id === 'token-semantic-architecture'
          ? {
              exitCode: 1,
              stdout: 'Token semantic audit: FAIL',
              stderr: '',
              timedOut: false,
            }
          : success(),
    });

    expect(result.stages.map((stage) => [stage.id, stage.status])).toEqual([
      ['public-api', 'passed'],
      ['tooling', 'blocked'],
      ['visual', 'skipped'],
      ['smoke', 'skipped'],
    ]);
    expect(result.stages[1]?.findings[0]).toMatchObject({
      id: 'tooling:token-semantic-architecture',
      stage: 'tooling',
      severity: 'blocking',
    });
  });

  it('blocks smoke after a canonical Web visual failure', () => {
    const result = runComponentProductionFinalValidation({
      root: '/tmp/vellira-production',
      input: WEB_INPUT,
      runner: (command) =>
        command.id === 'canonical-web-visual'
          ? {
              exitCode: 1,
              stdout: 'screenshot mismatch',
              stderr: '',
              timedOut: false,
            }
          : success(),
    });

    expect(result.stages.map((stage) => [stage.id, stage.status])).toEqual([
      ['public-api', 'passed'],
      ['tooling', 'passed'],
      ['visual', 'blocked'],
      ['smoke', 'skipped'],
    ]);
    expect(result.stages[2]?.findings[0]).toMatchObject({
      platform: 'react',
    });
  });

  it('fails closed on tooling timeout and skips later final gates', () => {
    const result = runComponentProductionFinalValidation({
      root: '/tmp/vellira-production',
      input: WEB_INPUT,
      runner: (command) =>
        command.id === 'tooling-contracts'
          ? {
              exitCode: null,
              stdout: '',
              stderr: '',
              timedOut: true,
            }
          : success(),
    });

    expect(result.stages.map((stage) => [stage.id, stage.status])).toEqual([
      ['public-api', 'passed'],
      ['tooling', 'failed'],
      ['visual', 'skipped'],
      ['smoke', 'skipped'],
    ]);
    expect(result.stages[1]?.findings[0]?.message).toContain('timed out');
  });

  it('blocks when an applicable smoke path fails', () => {
    const result = runComponentProductionFinalValidation({
      root: '/tmp/vellira-production',
      input: { ...WEB_INPUT, platform: 'both' },
      runner: (command) =>
        command.id === 'native-smoke'
          ? {
              exitCode: 1,
              stdout: '',
              stderr: 'native smoke failed',
              timedOut: false,
            }
          : success(),
    });

    expect(result.stages.at(-1)?.status).toBe('blocked');
    expect(result.stages.at(-1)?.findings[0]).toMatchObject({
      platform: 'react-native',
    });
  });
});

function success(): ComponentProductionFinalCommandExecution {
  return {
    exitCode: 0,
    stdout: '',
    stderr: '',
    timedOut: false,
  };
}
