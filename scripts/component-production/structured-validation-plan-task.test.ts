import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  mediaSpec,
  collectionSpec,
  temporalSpec,
} from '../component-program/fixtures/programs';
import { createComponentGenerationPlan } from '../generators/component/plan';
import { checkGeneratedPlanContract } from '../generators/component/plan-contract';
import {
  createComponentProductionGeneratorOptions,
  parseComponentProductionInput,
} from './contracts';
import { runComponentProductionPlanContractWorkerTask } from './structured-validation-worker';
import { runComponentCompletenessCheck } from '../checks/component-completeness/run';
import { runComponentQualityCheck } from '../checks/component-quality/engine';

vi.mock('../generators/component/plan-contract', () => ({
  checkGeneratedPlanContract: vi.fn(),
}));
vi.mock('../checks/component-completeness/run', () => ({
  runComponentCompletenessCheck: vi.fn(),
}));
vi.mock('../checks/component-quality/engine', () => ({
  runComponentQualityCheck: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe('plan-worker task uses the canonical complete input', () => {
  it('preserves resource, platform, compound and work-item decisions', async () => {
    const root = path.resolve('/tmp/full resource input');
    const input = parseComponentProductionInput({
      schemaVersion: '1',
      componentName: 'Accordion',
      platform: 'both',
      layer: 'components',
      category: 'navigation',
      profile: 'compound',
      capabilities: [
        'compound-api',
        'controlled',
        'uncontrolled',
        'disabled',
        'keyboard',
      ],
      componentTokens: 'disclosure',
      parts: ['Root', 'Item', 'Trigger', 'Content'],
      semanticCapabilities: ['accessible-name'],
      platformSemanticCapabilities: {
        react: ['size-variants'],
        'react-native': ['accessible-value'],
      },
      icons: [{ name: 'ChevronDown', purpose: 'disclosure indicator' }],
      tokens: ['semantic.text.primary'],
      assets: [
        { path: 'assets/example.svg', purpose: 'documented illustration' },
      ],
      dependencies: {
        packages: ['@vellira-ui/core'],
        platforms: { react: { packages: ['@vellira-ui/types'] } },
      },
      workItem: {
        provider: 'github',
        repository: 'vellira-dev/vellira',
        issue: '#1283',
      },
    });
    vi.mocked(checkGeneratedPlanContract).mockResolvedValue([]);
    await runComponentProductionPlanContractWorkerTask({ root, input });
    expect(checkGeneratedPlanContract).toHaveBeenCalledExactlyOnceWith(
      createComponentGenerationPlan({
        root,
        options: createComponentProductionGeneratorOptions(input),
      })
    );
    expect(runComponentCompletenessCheck).not.toHaveBeenCalled();
    expect(runComponentQualityCheck).not.toHaveBeenCalled();
  });

  it.each([mediaSpec(), collectionSpec(), temporalSpec()])(
    'reconstructs the unchanged plan for $componentName',
    async (input) => {
      const root = path.resolve('/tmp/full semantic input');
      const drift = [path.join(root, 'packages/react/API.md')];
      vi.mocked(checkGeneratedPlanContract).mockResolvedValue(drift);
      const parsed = parseComponentProductionInput(input);
      const expected = createComponentGenerationPlan({
        root,
        options: createComponentProductionGeneratorOptions(parsed),
      });
      const result = await runComponentProductionPlanContractWorkerTask({
        root,
        input,
      });
      expect(expected.componentProgram).toBeDefined();
      expect(checkGeneratedPlanContract).toHaveBeenCalledExactlyOnceWith(
        expected
      );
      expect(result).toEqual({
        schemaVersion: 'component-production-plan-contract-v1',
        componentName: input.componentName,
        driftedFiles: drift,
      });
      expect(runComponentCompletenessCheck).not.toHaveBeenCalled();
      expect(runComponentQualityCheck).not.toHaveBeenCalled();
    }
  );

  it.each([
    null,
    {},
    { ...mediaSpec(), schemaVersion: 'unrecognized' },
    { ...mediaSpec(), componentProgram: { schemaVersion: '1' } },
  ])('rejects invalid input before running any checker %#', async (input) => {
    await expect(
      runComponentProductionPlanContractWorkerTask({
        root: '/tmp/invalid plan',
        input,
      })
    ).rejects.toThrow();
    expect(checkGeneratedPlanContract).not.toHaveBeenCalled();
    expect(runComponentCompletenessCheck).not.toHaveBeenCalled();
    expect(runComponentQualityCheck).not.toHaveBeenCalled();
  });
});
