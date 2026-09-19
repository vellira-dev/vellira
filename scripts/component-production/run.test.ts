import { describe, expect, it } from 'vitest';

import type {
  ComponentProductionFinding,
  ComponentProductionInputV1,
  ComponentProductionStageId,
  ComponentProductionStageResult,
} from './contracts';
import {
  runComponentProductionCommandValidation,
  type ComponentProductionCommandExecution,
} from './command-validation';
import {
  runComponentProductionFinalValidation,
  type ComponentProductionFinalCommandExecution,
} from './final-validation';
import { runComponentProductionStructuredValidation } from './structured-validation';
import {
  runComponentProduction,
  runComponentProductionValidation,
  validateComponentProductionCandidate,
} from './run';

const RAW_INPUT: ComponentProductionInputV1 = {
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

const INPUT = RAW_INPUT;

describe('runComponentProduction', () => {
  it('stops at the semantic-completion boundary after deterministic generation', async () => {
    const calls: string[] = [];
    const artifacts = [
      'apps/docs/src/react/avatar.md',
      'apps/website/src/component-catalog/components/Avatar/index.ts',
      'packages/metadata/src/components/Avatar.metadata.ts',
      'packages/react/src/primitives/Avatar/Avatar.stories.tsx',
      'packages/react/src/primitives/Avatar/Avatar.test.tsx',
      'packages/react/src/primitives/Avatar/Avatar.tsx',
      'packages/tokens/src/factories/avatar.ts',
      'packages/types/src/avatar.ts',
    ];

    const result = await runComponentProduction({
      root: '/tmp/vellira-production',
      input: RAW_INPUT,
      dependencies: {
        runGeneration: async () => {
          calls.push('generation');
          return {
            preflight: passedStage('preflight'),
            generation: { ...passedStage('generation'), artifacts },
            generatedArtifacts: artifacts,
          };
        },
        runCommandValidation: () => {
          calls.push('command-validation');
          return { stages: commandStages() };
        },
        runStructuredValidation: async () => {
          calls.push('structured-validation');
          return {
            stages: [passedStage('completeness'), passedStage('quality')],
            completeness: [],
            quality: passingQuality(),
          };
        },
      },
    });

    expect(calls).toEqual(['generation']);
    expect(result.status).toBe('blocked');
    expect(result.readyForReview).toBe(false);
    expect(result.lifecycle).toEqual({
      current: 'semantic-completion-required',
      completed: ['scaffolded'],
      semanticCompletionRequired: true,
      readyForReview: false,
    });
    expect(result.blockingFindings).toEqual([
      expect.objectContaining({
        id: 'semantic-completion:required',
        stage: 'semantic-completion',
      }),
    ]);
    expect(
      result.stages.find((stage) => stage.id === 'semantic-completion')
    ).toMatchObject({
      status: 'blocked',
    });
    expect(
      result.stages.slice(3).every((stage) => stage.status === 'skipped')
    ).toBe(true);
    expect(result.outputs.runtimeRenderers.artifacts).toEqual([
      'packages/react/src/primitives/Avatar/Avatar.tsx',
    ]);
    expect(result.outputs.sharedContracts.artifacts).toEqual([
      'packages/types/src/avatar.ts',
    ]);
    expect(result.outputs.designResources.artifacts).toEqual([
      'packages/tokens/src/factories/avatar.ts',
    ]);
    expect(result.outputs.storyGeneration.artifacts).toEqual([
      'packages/react/src/primitives/Avatar/Avatar.stories.tsx',
    ]);
  });

  it('stops before semantic completion when deterministic preflight blocks', async () => {
    let validationCalled = false;

    const result = await runComponentProduction({
      root: '/tmp/vellira-production',
      input: RAW_INPUT,
      dependencies: {
        runGeneration: async () => ({
          preflight: {
            id: 'preflight',
            status: 'blocked',
            summary: 'Preflight blocked.',
            findings: [
              {
                id: 'preflight:1',
                stage: 'preflight',
                severity: 'blocking',
                message: 'Component already exists.',
              },
            ],
            artifacts: [],
          },
          generation: {
            id: 'generation',
            status: 'skipped',
            summary: 'Generation skipped.',
            findings: [],
            artifacts: [],
          },
          generatedArtifacts: [],
        }),
        runCommandValidation: () => {
          validationCalled = true;
          return { stages: commandStages() };
        },
        runStructuredValidation: async () => {
          validationCalled = true;
          return {
            stages: [passedStage('completeness'), passedStage('quality')],
            completeness: [],
            quality: passingQuality(),
          };
        },
      },
    });

    expect(validationCalled).toBe(false);
    expect(result.status).toBe('blocked');
    expect(result.readyForReview).toBe(false);
    expect(result.lifecycle.current).toBe('scaffolded');
    expect(
      result.stages.find((stage) => stage.id === 'semantic-completion')?.status
    ).toBe('skipped');
    expect(
      result.stages.slice(3).every((stage) => stage.status === 'skipped')
    ).toBe(true);
  });
});

describe('runComponentProductionValidation', () => {
  it('returns a versioned review-ready validation-only result', async () => {
    const result = await runComponentProductionValidation({
      root: '/tmp/vellira-production',
      input: RAW_INPUT,
      dependencies: {
        runCommandValidation: () => ({
          stages: commandStages(),
        }),
        runStructuredValidation: async () => ({
          stages: [passedStage('completeness'), passedStage('quality')],
          completeness: [
            {
              componentName: 'Avatar',
              ready: true,
              checks: [],
            },
          ],
          quality: passingQuality(),
        }),
        runFinalValidation: () => ({ stages: finalStages() }),
      },
    });

    expect(result).toMatchObject({
      schemaVersion: '1',
      status: 'ready',
      readyForReview: true,
      lifecycle: {
        current: 'ready-for-review',
        semanticCompletionRequired: false,
        readyForReview: true,
      },
      blockingFindings: [],
      validationSummary: {
        status: 'ready',
        blockedStages: [],
        failedStages: [],
        skippedStages: [],
      },
    });

    expect(result.validationSummary.passedStages).toEqual([
      'format',
      'lint',
      'tests',
      'typecheck',
      'build',
      'storybook',
      'docs',
      'website',
      'completeness',
      'quality',
      'public-api',
      'tooling',
      'visual',
      'smoke',
    ]);
  });

  it('returns machine-readable blocking findings without generation', async () => {
    const finding: ComponentProductionFinding = {
      id: 'tests:react-tests',
      stage: 'tests',
      severity: 'blocking',
      message: 'Avatar tests failed.',
    };

    const result = await runComponentProductionValidation({
      root: '/tmp/vellira-production',
      input: RAW_INPUT,
      dependencies: {
        runCommandValidation: () => ({
          stages: commandStages({
            tests: blockedStage('tests', finding),
          }),
        }),
        runStructuredValidation: async () => ({
          stages: [passedStage('completeness'), passedStage('quality')],
          completeness: [],
          quality: passingQuality(),
        }),
      },
    });

    expect(result.status).toBe('blocked');
    expect(result.readyForReview).toBe(false);
    expect(result.blockingFindings).toEqual([finding]);
    expect(result.validationSummary.blockedStages).toEqual(['tests']);
    expect(result.lifecycle.current).toBe('candidate');
  });
});

const REPRESENTATIVE_READY_CANDIDATES = [
  {
    name: 'Web',
    platform: 'web',
    structuredPlatform: 'web',
    commandIds: [
      'format-check',
      'lint',
      'core-tests',
      'metadata-tests',
      'react-tests',
      'react-typecheck',
      'react-build',
      'react-storybook-build',
      'component-docs',
      'component-page-check',
      'component-page-audit',
    ],
    finalIds: [
      'public-api',
      'tooling-contracts',
      'canonical-web-visual',
      'web-smoke',
    ],
  },
  {
    name: 'React Native',
    platform: 'native',
    structuredPlatform: 'native',
    commandIds: [
      'format-check',
      'lint',
      'core-tests',
      'metadata-tests',
      'react-native-tests',
      'react-native-typecheck',
      'react-native-build',
      'component-docs',
      'component-page-check',
      'component-page-audit',
    ],
    finalIds: ['public-api', 'tooling-contracts', 'native-smoke'],
  },
  {
    name: 'cross-platform',
    platform: 'both',
    structuredPlatform: 'all',
    commandIds: [
      'format-check',
      'lint',
      'core-tests',
      'metadata-tests',
      'react-tests',
      'react-native-tests',
      'react-typecheck',
      'react-native-typecheck',
      'react-build',
      'react-native-build',
      'react-storybook-build',
      'component-docs',
      'component-page-check',
      'component-page-audit',
    ],
    finalIds: [
      'public-api',
      'tooling-contracts',
      'canonical-web-visual',
      'web-smoke',
      'native-smoke',
    ],
  },
] as const;

describe('representative component production readiness', () => {
  it.each(REPRESENTATIVE_READY_CANDIDATES)(
    'returns readyForReview for a clean $name candidate',
    async (fixture) => {
      const commandCalls: string[] = [];
      const structuredPlatforms: string[] = [];
      const finalCalls: string[] = [];
      const input: ComponentProductionInputV1 = {
        ...RAW_INPUT,
        platform: fixture.platform,
      };

      const result = await runComponentProductionValidation({
        root: '/tmp/vellira-production',
        input,
        dependencies: {
          runCommandValidation: ({ root, input: candidate }) =>
            runComponentProductionCommandValidation({
              root,
              input: candidate,
              runner: (command) => {
                commandCalls.push(command.id);
                return commandSuccess();
              },
            }),
          runStructuredValidation: ({ root, input: candidate }) =>
            runComponentProductionStructuredValidation({
              root,
              input: candidate,
              checkPlanContract: async () => [],
              runner: ({ platform }) => {
                structuredPlatforms.push(platform);

                return {
                  exitCode: 0,
                  stdout: JSON.stringify({
                    schemaVersion: '1',
                    status: 'ok',
                    componentName: candidate.componentName,
                    completeness: [
                      {
                        componentName: candidate.componentName,
                        ready: true,
                        checks: [],
                      },
                    ],
                    quality: passingQualityFor(
                      candidate.componentName,
                      platform
                    ),
                  }),
                  stderr: '',
                  timedOut: false,
                };
              },
            }),
          runFinalValidation: ({ root, input: candidate }) =>
            runComponentProductionFinalValidation({
              root,
              input: candidate,
              runner: (command) => {
                finalCalls.push(command.id);
                return finalSuccess();
              },
            }),
        },
      });

      expect(commandCalls).toEqual(fixture.commandIds);
      expect(structuredPlatforms).toEqual([fixture.structuredPlatform]);
      expect(finalCalls).toEqual(fixture.finalIds);
      expect(result.status).toBe('ready');
      expect(result.readyForReview).toBe(true);
      expect(result.validationSummary).toMatchObject({
        status: 'ready',
        blockedStages: [],
        failedStages: [],
        skippedStages: [],
      });
      expect(result.stages.every((stage) => stage.status === 'passed')).toBe(
        true
      );

      if (fixture.platform === 'native') {
        expect(
          result.stages.find((stage) => stage.id === 'visual')
        ).toMatchObject({
          status: 'passed',
          summary: expect.stringContaining('not applicable'),
        });
      }
    }
  );
});

describe('validateComponentProductionCandidate', () => {
  it('reruns deterministic validation without invoking generation', async () => {
    const calls: string[] = [];

    const result = await validateComponentProductionCandidate({
      root: '/tmp/vellira-production',
      input: INPUT,
      dependencies: {
        runCommandValidation: () => {
          calls.push('command-validation');

          return {
            stages: commandStages(),
          };
        },
        runStructuredValidation: async () => {
          calls.push('structured-validation');

          return {
            stages: [passedStage('completeness'), passedStage('quality')],
            completeness: [],
            quality: passingQuality(),
          };
        },
        runFinalValidation: () => {
          calls.push('final-validation');
          return { stages: finalStages() };
        },
      },
    });

    expect(calls).toEqual([
      'command-validation',
      'structured-validation',
      'final-validation',
    ]);

    expect(result.stages.map((stage) => stage.id)).toEqual([
      'format',
      'lint',
      'tests',
      'typecheck',
      'build',
      'storybook',
      'docs',
      'website',
      'completeness',
      'quality',
      'public-api',
      'tooling',
      'visual',
      'smoke',
    ]);
  });
});

function commandStages(
  overrides: Partial<
    Record<ComponentProductionStageId, ComponentProductionStageResult>
  > = {}
): ComponentProductionStageResult[] {
  return [
    'format',
    'lint',
    'tests',
    'typecheck',
    'build',
    'storybook',
    'docs',
    'website',
  ].map((id) => {
    const stageId = id as ComponentProductionStageId;

    return overrides[stageId] ?? passedStage(stageId);
  });
}

function finalStages(): ComponentProductionStageResult[] {
  return ['public-api', 'tooling', 'visual', 'smoke'].map((id) =>
    passedStage(id as ComponentProductionStageId)
  );
}

function passedStage(
  id: ComponentProductionStageId
): ComponentProductionStageResult {
  return {
    id,
    status: 'passed',
    summary: `${id} passed.`,
    findings: [],
    artifacts: [],
  };
}

function blockedStage(
  id: ComponentProductionStageId,
  finding: ComponentProductionFinding
): ComponentProductionStageResult {
  return {
    id,
    status: 'blocked',
    summary: `${id} blocked.`,
    findings: [finding],
    artifacts: [],
  };
}

function commandSuccess(): ComponentProductionCommandExecution {
  return {
    exitCode: 0,
    stdout: '',
    stderr: '',
    timedOut: false,
  };
}

function finalSuccess(): ComponentProductionFinalCommandExecution {
  return {
    exitCode: 0,
    stdout: '',
    stderr: '',
    timedOut: false,
  };
}

function passingQualityFor(
  componentName: string,
  platform: 'web' | 'native' | 'all'
) {
  const platforms =
    platform === 'all'
      ? (['react', 'react-native'] as const)
      : ([platform === 'web' ? 'react' : 'react-native'] as const);

  return {
    status: 'pass' as const,
    report: {
      schemaVersion: '1' as const,
      components: [
        {
          componentName,
          status: 'pass' as const,
          platforms: platforms.map((candidatePlatform) => ({
            platform: candidatePlatform,
            status: 'pass' as const,
            findings: [],
          })),
          findings: [],
        },
      ],
    },
  };
}

function passingQuality() {
  return {
    status: 'pass' as const,
    report: {
      schemaVersion: '1' as const,
      components: [],
    },
  };
}
