import * as childProcess from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import type { ComponentCompletenessResult } from '../checks/component-completeness/types';
import type { ComponentQualityRunResult } from '../checks/component-quality/types';

import type { ComponentProductionInputV1 } from './contracts';
import {
  runComponentProductionStructuredValidation,
  runComponentProductionStructuredValidationWorker,
  type ComponentProductionStructuredValidationWorkerExecution,
} from './structured-validation';
import type { ComponentProductionValidationWorkerResult } from './structured-validation-protocol';

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  spawnSync: vi.fn(),
}));

const INPUT: ComponentProductionInputV1 = {
  schemaVersion: '1',
  componentName: 'Avatar',
  platform: 'both',
  layer: 'primitives',
  category: 'data-display',
  profile: 'base',
  capabilities: [],
  componentTokens: 'standard',
  parts: [],
};

const PASSING_PLAN_CONTRACT = async () => [] as string[];

describe('structured validation worker launcher', () => {
  it('uses the current Node import hook and preserves the child process contract', () => {
    const spawn = vi.mocked(childProcess.spawnSync).mockReturnValue({
      pid: 123,
      output: [null, '{"status":"ok"}', 'worker diagnostic'],
      stdout: '{"status":"ok"}',
      stderr: 'worker diagnostic',
      status: 0,
      signal: null,
    });

    try {
      const result = runComponentProductionStructuredValidationWorker({
        root: '/tmp/controlled candidate',
        componentName: 'LauncherFixture',
        platform: 'all',
      });

      expect(spawn).toHaveBeenCalledExactlyOnceWith(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/component-production/structured-validation-worker.ts',
          'LauncherFixture',
          'all',
        ],
        {
          cwd: '/tmp/controlled candidate',
          encoding: 'utf8',
          timeout: 120_000,
          shell: false,
        }
      );
      expect(result).toEqual({
        exitCode: 0,
        stdout: '{"status":"ok"}',
        stderr: 'worker diagnostic',
        timedOut: false,
      });
    } finally {
      spawn.mockReset();
    }
  });
});

describe('runComponentProductionStructuredValidation', () => {
  it('runs validation against a fresh canonical candidate context', async () => {
    let observedPlatform: string | undefined;

    const result = await runComponentProductionStructuredValidation({
      root: '/tmp/vellira-production',
      input: INPUT,
      checkPlanContract: PASSING_PLAN_CONTRACT,
      runner: (params) => {
        observedPlatform = params.platform;

        return workerSuccess({
          completeness: [
            {
              componentName: 'Avatar',
              ready: true,
              checks: [],
            },
          ],
          quality: passingQuality(),
        });
      },
    });

    expect(observedPlatform).toBe('all');

    expect(result.stages.map((stage) => [stage.id, stage.status])).toEqual([
      ['completeness', 'passed'],
      ['quality', 'passed'],
    ]);
  });

  it('blocks before validators when production input drifts from the canonical generated plan', async () => {
    let workerCalled = false;
    let observedProfile: string | undefined;

    const result = await runComponentProductionStructuredValidation({
      root: '/tmp/vellira-production',
      input: INPUT,
      checkPlanContract: async (plan) => {
        observedProfile = plan.profile;
        return [plan.metadataFile, plan.metadataFile];
      },
      runner: () => {
        workerCalled = true;

        return workerSuccess({
          completeness: [
            {
              componentName: 'Avatar',
              ready: true,
              checks: [],
            },
          ],
          quality: passingQuality(),
        });
      },
    });

    expect(observedProfile).toBe('base');
    expect(workerCalled).toBe(false);
    expect(result.completeness).toBeNull();
    expect(result.quality).toBeNull();
    expect(result.stages[0]).toMatchObject({
      id: 'completeness',
      status: 'blocked',
      findings: [
        {
          severity: 'blocking',
          path: 'packages/metadata/src/components/Avatar.metadata.ts',
        },
      ],
    });
    expect(result.stages[1]).toMatchObject({
      id: 'quality',
      status: 'skipped',
    });
  });

  it('blocks when the generated component is not registered in canonical metadata', async () => {
    const result = await runComponentProductionStructuredValidation({
      root: '/tmp/vellira-production',
      input: INPUT,
      checkPlanContract: PASSING_PLAN_CONTRACT,
      runner: () =>
        workerResult({
          schemaVersion: '1',
          status: 'blocked',
          componentName: 'Avatar',
          code: 'component-not-registered',
          message: 'Avatar is not registered in canonical component metadata.',
        }),
    });

    expect(result.stages[0]).toMatchObject({
      id: 'completeness',
      status: 'blocked',
      findings: [
        {
          id: 'completeness:avatar:metadata-registration',
          severity: 'blocking',
        },
      ],
    });

    expect(result.stages[1].status).toBe('skipped');
  });

  it('converts completeness failures into blocking findings', async () => {
    const result = await runComponentProductionStructuredValidation({
      root: '/tmp/vellira-production',
      input: INPUT,
      checkPlanContract: PASSING_PLAN_CONTRACT,
      runner: () =>
        workerSuccess({
          completeness: [
            {
              componentName: 'Avatar',
              ready: false,
              checks: [
                {
                  name: 'implementation',
                  platform: 'react',
                  ok: false,
                  details: 'Missing Avatar implementation.',
                },
              ],
            },
          ],
          quality: passingQuality(),
        }),
    });

    expect(result.stages[0]).toMatchObject({
      status: 'blocked',
      findings: [
        {
          id: 'completeness:avatar:react:implementation',
          platform: 'react',
          severity: 'blocking',
        },
      ],
    });

    expect(result.stages[1].status).toBe('skipped');
    expect(result.quality).toBeNull();
  });

  it('preserves blocking and advisory quality findings', async () => {
    const result = await runComponentProductionStructuredValidation({
      root: '/tmp/vellira-production',
      input: INPUT,
      checkPlanContract: PASSING_PLAN_CONTRACT,
      runner: () =>
        workerSuccess({
          completeness: [
            {
              componentName: 'Avatar',
              ready: true,
              checks: [],
            },
          ],
          quality: {
            status: 'fail',
            report: {
              schemaVersion: '1',
              components: [
                {
                  componentName: 'Avatar',
                  status: 'fail',
                  platforms: [],
                  findings: [
                    {
                      ruleId: 'platform.accessibility-semantics',
                      dimension: 'accessibility',
                      severity: 'required',
                      evaluation: 'automated',
                      status: 'fail',
                      platform: 'react',
                      message: 'Avatar lacks accessibility semantics.',
                      evidence: [
                        'packages\\react\\src\\primitives\\Avatar\\Avatar.tsx',
                      ],
                    },
                    {
                      ruleId: 'conformity.hardcoded-geometry',
                      dimension: 'design-system',
                      severity: 'recommended',
                      evaluation: 'automated',
                      status: 'warn',
                      platform: 'react',
                      message: 'Avatar uses hardcoded geometry.',
                      evidence: [
                        'packages/react/src/primitives/Avatar/Avatar.module.scss:3 — padding: 20px',
                      ],
                    },
                  ],
                },
              ],
            },
          },
        }),
    });

    expect(result.stages[1].status).toBe('blocked');

    expect(
      result.stages[1].findings.map((finding) => ({
        severity: finding.severity,
        path: finding.path,
      }))
    ).toEqual([
      {
        severity: 'blocking',
        path: 'packages/react/src/primitives/Avatar/Avatar.tsx',
      },
      {
        severity: 'warning',
        path: 'packages/react/src/primitives/Avatar/Avatar.module.scss',
      },
    ]);
  });

  it('does not treat descriptive evidence containing a repo path as repair authority', async () => {
    const result = await runComponentProductionStructuredValidation({
      root: '/tmp/vellira-production',
      input: INPUT,
      checkPlanContract: PASSING_PLAN_CONTRACT,
      runner: () =>
        workerSuccess({
          completeness: [
            {
              componentName: 'Avatar',
              ready: true,
              checks: [],
            },
          ],
          quality: {
            status: 'fail',
            report: {
              schemaVersion: '1',
              components: [
                {
                  componentName: 'Avatar',
                  status: 'fail',
                  platforms: [],
                  findings: [
                    {
                      ruleId: 'conformity.component-token-contract',
                      dimension: 'design-system',
                      severity: 'required',
                      evaluation: 'automated',
                      status: 'fail',
                      platform: 'react',
                      message: 'Component token contract is incomplete.',
                      evidence: [
                        'missing component token factory: packages/tokens/src/factories/createAvatarTokens.ts',
                      ],
                    },
                  ],
                },
              ],
            },
          },
        }),
    });

    expect(result.stages[1].status).toBe('blocked');
    expect(result.stages[1].findings).toHaveLength(1);
    expect(result.stages[1].findings[0]).toMatchObject({
      ruleId: 'conformity.component-token-contract',
      severity: 'blocking',
    });
    expect(result.stages[1].findings[0]?.path).toBeUndefined();
  });

  it('keeps warning-only quality results non-blocking', async () => {
    const result = await runComponentProductionStructuredValidation({
      root: '/tmp/vellira-production',
      input: INPUT,
      checkPlanContract: PASSING_PLAN_CONTRACT,
      runner: () =>
        workerSuccess({
          completeness: [
            {
              componentName: 'Avatar',
              ready: true,
              checks: [],
            },
          ],
          quality: {
            status: 'warn',
            report: {
              schemaVersion: '1',
              components: [
                {
                  componentName: 'Avatar',
                  status: 'warn',
                  platforms: [],
                  findings: [
                    {
                      ruleId: 'conformity.hardcoded-geometry',
                      dimension: 'design-system',
                      severity: 'recommended',
                      evaluation: 'automated',
                      status: 'warn',
                      platform: 'react',
                      message: 'Hardcoded geometry.',
                    },
                  ],
                },
              ],
            },
          },
        }),
    });

    expect(result.stages[1].status).toBe('passed');

    expect(result.stages[1].findings[0]?.severity).toBe('warning');
  });

  it('fails closed on worker runtime failure', async () => {
    const result = await runComponentProductionStructuredValidation({
      root: '/tmp/vellira-production',
      input: INPUT,
      checkPlanContract: PASSING_PLAN_CONTRACT,
      runner: () => ({
        exitCode: 2,
        stdout: '',
        stderr: 'Unable to load generated metadata.',
        timedOut: false,
      }),
    });

    expect(result.stages.map((stage) => stage.status)).toEqual([
      'failed',
      'skipped',
    ]);

    expect(result.completeness).toBeNull();
    expect(result.quality).toBeNull();
  });
});

function workerSuccess(params: {
  completeness: readonly ComponentCompletenessResult[];
  quality: ComponentQualityRunResult;
}): ComponentProductionStructuredValidationWorkerExecution {
  return workerResult({
    schemaVersion: '1',
    status: 'ok',
    componentName: 'Avatar',
    completeness: params.completeness,
    quality: params.quality,
  });
}

function workerResult(
  result: ComponentProductionValidationWorkerResult
): ComponentProductionStructuredValidationWorkerExecution {
  return {
    exitCode: 0,
    stdout: JSON.stringify(result),
    stderr: '',
    timedOut: false,
  };
}

function passingQuality() {
  return {
    status: 'pass' as const,
    report: {
      schemaVersion: '1' as const,
      components: [
        {
          componentName: 'Avatar',
          status: 'pass' as const,
          platforms: [],
          findings: [],
        },
      ],
    },
  };
}
