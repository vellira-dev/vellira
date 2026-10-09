import type { ComponentMetadata } from '@vellira-ui/metadata';
import { describe, expect, it } from 'vitest';

import { runComponentProductionStructuredValidationWorkerTask } from './structured-validation-worker';

const AVATAR_METADATA = {
  name: 'Avatar',
} as ComponentMetadata;

describe('runComponentProductionStructuredValidationWorkerTask', () => {
  it('runs independent quality after completeness blocks', async () => {
    let qualityCalled = false;

    const result = await runComponentProductionStructuredValidationWorkerTask({
      root: '/tmp/vellira-production',
      componentName: 'Avatar',
      platform: 'all',
      dependencies: {
        metadata: [AVATAR_METADATA],
        runCompleteness: async () => [
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
        runQuality: async () => {
          qualityCalled = true;

          return passingQuality();
        },
      },
    });

    expect(qualityCalled).toBe(true);

    expect(result).toMatchObject({
      schemaVersion: '1',
      status: 'ok',
      componentName: 'Avatar',
      quality: { status: 'pass' },
    });
  });

  it('scopes generated docs completeness to the target component', async () => {
    let observedScope: string | undefined;
    let observedMetadata: readonly ComponentMetadata[] | undefined;

    await runComponentProductionStructuredValidationWorkerTask({
      root: '/tmp/vellira-production',
      componentName: 'Avatar',
      platform: 'all',
      dependencies: {
        metadata: [AVATAR_METADATA],
        runCompleteness: async (params) => {
          observedScope = params.generatedDocsScope;
          observedMetadata = params.metadata;

          return [
            {
              componentName: 'Avatar',
              ready: false,
              checks: [],
            },
          ];
        },
        runQuality: async () => passingQuality(),
      },
    });

    expect(observedScope).toBe('targeted');
    expect(observedMetadata).toEqual([AVATAR_METADATA]);
  });

  it('runs quality when completeness passes', async () => {
    let qualityCalled = false;

    const result = await runComponentProductionStructuredValidationWorkerTask({
      root: '/tmp/vellira-production',
      componentName: 'Avatar',
      platform: 'all',
      dependencies: {
        metadata: [AVATAR_METADATA],
        runCompleteness: async () => [
          {
            componentName: 'Avatar',
            ready: true,
            checks: [],
          },
        ],
        runQuality: async () => {
          qualityCalled = true;

          return passingQuality();
        },
      },
    });

    expect(qualityCalled).toBe(true);

    expect(result).toMatchObject({
      status: 'ok',
      componentName: 'Avatar',
      quality: {
        status: 'pass',
      },
    });
  });

  it('blocks before validators when canonical metadata is missing', async () => {
    let completenessCalled = false;
    let qualityCalled = false;

    const result = await runComponentProductionStructuredValidationWorkerTask({
      root: '/tmp/vellira-production',
      componentName: 'Avatar',
      platform: 'all',
      dependencies: {
        metadata: [],
        runCompleteness: async () => {
          completenessCalled = true;

          return [];
        },
        runQuality: async () => {
          qualityCalled = true;

          return passingQuality();
        },
      },
    });

    expect(completenessCalled).toBe(false);
    expect(qualityCalled).toBe(false);

    expect(result).toMatchObject({
      status: 'blocked',
      code: 'component-not-registered',
    });
  });
});

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
