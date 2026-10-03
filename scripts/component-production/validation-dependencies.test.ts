import { describe, expect, it } from 'vitest';

import {
  COMPONENT_PRODUCTION_VALIDATION_STAGE_POLICY,
  componentProductionCommandDependencies,
} from './validation-dependencies';

describe('component production validation dependency policy', () => {
  it('covers every validation stage in canonical order', () => {
    expect(
      COMPONENT_PRODUCTION_VALIDATION_STAGE_POLICY.map((stage) => stage.id)
    ).toEqual([
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

  it('keeps only real build/runtime dependencies', () => {
    expect(
      componentProductionCommandDependencies('react-storybook-build')
    ).toEqual(['react-build']);
    expect(
      componentProductionCommandDependencies('canonical-web-visual')
    ).toEqual(['react-storybook-build']);
    expect(componentProductionCommandDependencies('web-smoke')).toEqual([
      'react-build',
    ]);
    expect(componentProductionCommandDependencies('native-smoke')).toEqual([
      'react-native-build',
    ]);
    expect(componentProductionCommandDependencies('tooling-contracts')).toEqual(
      []
    );
    expect(
      componentProductionCommandDependencies('diagnostic-quality')
    ).toEqual([]);
  });

  it('requires path binding before mixed tooling can consume repair budget', () => {
    expect(
      COMPONENT_PRODUCTION_VALIDATION_STAGE_POLICY.find(
        (stage) => stage.id === 'tooling'
      )
    ).toMatchObject({
      ownership: 'mixed',
      providerRepairBudget: 'eligible-when-path-bound',
    });
  });
});
