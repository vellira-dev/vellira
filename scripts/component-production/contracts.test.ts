import { describe, expect, it } from 'vitest';

import {
  COMPONENT_PRODUCTION_STAGE_IDS,
  createComponentProductionGeneratorOptions,
  createComponentProductionResult,
  parseComponentProductionInput,
  type ComponentProductionFinding,
  type ComponentProductionInputV1,
  type ComponentProductionStageId,
  type ComponentProductionStageResult,
  type ComponentProductionStageStatus,
} from './contracts';

const BASE_INPUT: ComponentProductionInputV1 = {
  schemaVersion: '1',
  componentName: 'Avatar',
  platform: 'both',
  layer: 'primitives',
  category: 'data-display',
  profile: 'base',
  capabilities: ['keyboard'],
  componentTokens: 'standard',
  parts: [],
};

describe('parseComponentProductionInput', () => {
  it('parses a canonical base component specification', () => {
    expect(
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'both',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        capabilities: ['keyboard'],
        parts: [],
      })
    ).toEqual(BASE_INPUT);
  });

  it('uses the canonical generator validation and defaults', () => {
    expect(
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Textarea',
        platform: 'web',
        layer: 'primitives',
        category: 'form',
        profile: 'form-control',
      })
    ).toEqual({
      schemaVersion: '1',
      componentName: 'Textarea',
      platform: 'web',
      layer: 'primitives',
      category: 'form',
      profile: 'form-control',
      control: 'value',
      capabilities: [],
      componentTokens: 'standard',
      parts: [],
    });
  });

  it('omits empty resource arrays from normalized resource-free input', () => {
    expect(
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'both',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        icons: [],
        tokens: [],
      })
    ).toEqual({
      schemaVersion: '1',
      componentName: 'Avatar',
      platform: 'both',
      layer: 'primitives',
      category: 'data-display',
      profile: 'base',
      capabilities: [],
      componentTokens: 'standard',
      parts: [],
    });
  });

  it('parses one icon requirement', () => {
    expect(
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Accordion',
        platform: 'both',
        layer: 'components',
        category: 'navigation',
        profile: 'compound',
        icons: [
          {
            name: 'ChevronDown',
            purpose: 'disclosure indicator',
          },
        ],
      })
    ).toMatchObject({
      icons: [
        {
          name: 'ChevronDown',
          purpose: 'disclosure indicator',
        },
      ],
    });
  });

  it('parses icon purposes containing spaces', () => {
    expect(
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Dialog',
        platform: 'web',
        layer: 'components',
        category: 'overlay',
        profile: 'overlay',
        icons: [
          {
            name: 'Close',
            purpose: 'dismiss overlay action',
          },
        ],
      }).icons
    ).toEqual([
      {
        name: 'Close',
        purpose: 'dismiss overlay action',
      },
    ]);
  });

  it('parses icon purposes containing colons', () => {
    expect(
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Dialog',
        platform: 'web',
        layer: 'components',
        category: 'overlay',
        profile: 'overlay',
        icons: [
          {
            name: 'Close',
            purpose: 'dismiss: overlay action',
          },
        ],
      }).icons
    ).toEqual([
      {
        name: 'Close',
        purpose: 'dismiss: overlay action',
      },
    ]);
  });

  it('parses multiple icons', () => {
    expect(
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Dialog',
        platform: 'web',
        layer: 'components',
        category: 'overlay',
        profile: 'overlay',
        icons: [
          {
            name: 'Close',
            purpose: 'dismiss action',
          },
          {
            name: 'ChevronDown',
            purpose: 'disclosure indicator',
          },
        ],
      }).icons
    ).toEqual([
      {
        name: 'Close',
        purpose: 'dismiss action',
      },
      {
        name: 'ChevronDown',
        purpose: 'disclosure indicator',
      },
    ]);
  });

  it('parses token requirements', () => {
    expect(
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        tokens: ['semantic.text.primary'],
      }).tokens
    ).toEqual(['semantic.text.primary']);
  });

  it('parses icon and token requirements together', () => {
    expect(
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Accordion',
        platform: 'both',
        layer: 'components',
        category: 'navigation',
        profile: 'compound',
        icons: [
          {
            name: 'ChevronDown',
            purpose: 'disclosure indicator',
          },
        ],
        tokens: ['semantic.text.primary'],
      })
    ).toMatchObject({
      icons: [
        {
          name: 'ChevronDown',
          purpose: 'disclosure indicator',
        },
      ],
      tokens: ['semantic.text.primary'],
    });
  });

  it('rejects unknown production fields', () => {
    expect(() =>
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        force: true,
      })
    ).toThrow('Unknown component production input field "force".');
  });

  it('rejects invalid specifications through the generator contract', () => {
    expect(() =>
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
      })
    ).toThrow('Component name must be PascalCase');
  });

  it('rejects malformed icons fields', () => {
    expect(() =>
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        icons: 'ChevronDown',
      })
    ).toThrow('Component production input field "icons" must be an array.');
  });

  it('rejects non-object icon entries', () => {
    expect(() =>
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        icons: ['ChevronDown'],
      })
    ).toThrow('Component production input field "icons[0]" must be an object.');
  });

  it('rejects missing icon names', () => {
    expect(() =>
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        icons: [
          {
            purpose: 'disclosure indicator',
          },
        ],
      })
    ).toThrow(
      'Component production input field "icons[0].name" must be a non-empty string.'
    );
  });

  it('rejects missing icon purposes', () => {
    expect(() =>
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        icons: [
          {
            name: 'ChevronDown',
          },
        ],
      })
    ).toThrow(
      'Component production input field "icons[0].purpose" must be a non-empty string.'
    );
  });

  it('rejects extra icon object keys', () => {
    expect(() =>
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        icons: [
          {
            name: 'ChevronDown',
            purpose: 'disclosure indicator',
            platform: 'web',
          },
        ],
      })
    ).toThrow(
      'Unknown component production icon requirement field "platform" at icons[0].'
    );
  });

  it('rejects duplicate icon requirements through canonical Generator V2 validation', () => {
    expect(() =>
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Accordion',
        platform: 'both',
        layer: 'components',
        category: 'navigation',
        profile: 'compound',
        icons: [
          {
            name: 'ChevronDown',
            purpose: 'disclosure indicator',
          },
          {
            name: 'ChevronDown',
            purpose: 'disclosure indicator',
          },
        ],
      })
    ).toThrow(
      'Icon requirements must not contain duplicate name/purpose pairs.'
    );
  });

  it('rejects duplicate tokens through canonical Generator V2 validation', () => {
    expect(() =>
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        tokens: ['semantic.text.primary', 'semantic.text.primary'],
      })
    ).toThrow('Token requirements must not contain duplicates.');
  });

  it('rejects tokens with surrounding whitespace through canonical Generator V2 validation', () => {
    expect(() =>
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        tokens: [' semantic.text.primary'],
      })
    ).toThrow(
      '--token canonical token path must not include surrounding whitespace.'
    );
  });
});

describe('createComponentProductionGeneratorOptions', () => {
  it('forwards parsed icons and tokens into Generator V2 options', () => {
    const input = parseComponentProductionInput({
      schemaVersion: '1',
      componentName: 'Accordion',
      platform: 'both',
      layer: 'components',
      category: 'navigation',
      profile: 'compound',
      icons: [
        {
          name: 'ChevronDown',
          purpose: 'disclosure indicator',
        },
      ],
      tokens: ['semantic.text.primary'],
    });

    expect(createComponentProductionGeneratorOptions(input)).toMatchObject({
      icons: [
        {
          name: 'ChevronDown',
          purpose: 'disclosure indicator',
        },
      ],
      tokens: ['semantic.text.primary'],
    });
  });
});

describe('createComponentProductionResult', () => {
  it('marks a fully passed canonical pipeline ready for review', () => {
    const result = createComponentProductionResult({
      input: BASE_INPUT,
      stages: stages(),
      completeness: [],
      quality: {
        status: 'pass',
        report: {
          schemaVersion: '1',
          components: [],
        },
      },
    });

    expect(result.status).toBe('ready');
    expect(result.readyForReview).toBe(true);
    expect(result.lifecycle).toEqual({
      current: 'ready-for-review',
      completed: [
        'scaffolded',
        'semantic-completion-required',
        'candidate',
        'validated',
      ],
      semanticCompletionRequired: false,
      readyForReview: true,
    });
    expect(result.blockingFindings).toEqual([]);
  });

  it('produces a blocked result with deterministic findings', () => {
    const finding: ComponentProductionFinding = {
      id: 'quality:avatar:react:token-integration',
      stage: 'quality',
      severity: 'blocking',
      message: 'Avatar does not satisfy token integration.',
      platform: 'react',
      ruleId: 'conformity.token-integration',
    };

    const result = createComponentProductionResult({
      input: BASE_INPUT,
      stages: stages({
        quality: {
          status: 'blocked',
          findings: [finding],
        },
      }),
      completeness: [],
      quality: {
        status: 'fail',
        report: {
          schemaVersion: '1',
          components: [],
        },
      },
    });

    expect(result.status).toBe('blocked');
    expect(result.readyForReview).toBe(false);
    expect(result.blockingFindings).toEqual([finding]);
  });

  it('gives runtime failure precedence over deterministic blocking', () => {
    const result = createComponentProductionResult({
      input: BASE_INPUT,
      stages: stages({
        lint: {
          status: 'failed',
          findings: [
            {
              id: 'lint:runtime',
              stage: 'lint',
              severity: 'blocking',
              message: 'Lint command could not complete.',
            },
          ],
        },
        quality: {
          status: 'blocked',
          findings: [
            {
              id: 'quality:blocked',
              stage: 'quality',
              severity: 'blocking',
              message: 'Quality validation failed.',
            },
          ],
        },
      }),
      completeness: null,
      quality: null,
    });

    expect(result.status).toBe('failed');
    expect(result.readyForReview).toBe(false);
  });

  it('reports website generation from canonical generation artifacts', () => {
    const websiteArtifacts = [
      'apps/website/src/component-catalog/components/Avatar/index.ts',
      'apps/website/src/component-catalog/registry/componentPresentation.ts',
    ];

    const result = createComponentProductionResult({
      input: BASE_INPUT,
      stages: stages({
        generation: {
          artifacts: websiteArtifacts,
        },
      }),
      completeness: [],
      quality: {
        status: 'pass',
        report: {
          schemaVersion: '1',
          components: [],
        },
      },
    });

    expect(result.outputs.websiteGeneration).toEqual({
      generated: true,
      artifacts: [...websiteArtifacts].sort(),
    });
  });

  it('groups generated artifacts by production responsibility', () => {
    const result = createComponentProductionResult({
      input: BASE_INPUT,
      stages: stages({
        generation: {
          artifacts: [
            'packages/react/src/primitives/Avatar/Avatar.tsx',
            'packages/react/src/primitives/Avatar/Avatar.stories.tsx',
            'packages/react/src/primitives/Avatar/Avatar.test.tsx',
            'packages/types/src/avatar.ts',
            'packages/tokens/src/factories/avatar.ts',
          ],
        },
      }),
      completeness: [],
      quality: {
        status: 'pass',
        report: { schemaVersion: '1', components: [] },
      },
    });

    expect(result.outputs.runtimeRenderers.artifacts).toEqual([
      'packages/react/src/primitives/Avatar/Avatar.tsx',
    ]);
    expect(result.outputs.sharedContracts.artifacts).toEqual([
      'packages/types/src/avatar.ts',
    ]);
    expect(result.outputs.designResources.artifacts).toEqual([
      'packages/tokens/src/factories/avatar.ts',
    ]);
    expect(result.outputs.testGeneration.artifacts).toEqual([
      'packages/react/src/primitives/Avatar/Avatar.test.tsx',
    ]);
    expect(result.outputs.storyGeneration.artifacts).toEqual([
      'packages/react/src/primitives/Avatar/Avatar.stories.tsx',
    ]);
  });

  it('requires the complete canonical stage sequence', () => {
    expect(() =>
      createComponentProductionResult({
        input: BASE_INPUT,
        stages: stages().slice(0, -1),
        completeness: null,
        quality: null,
      })
    ).toThrow('must contain every canonical pipeline stage exactly once');
  });
});

function stages(
  overrides: Partial<
    Record<
      ComponentProductionStageId,
      {
        status?: ComponentProductionStageStatus;
        findings?: readonly ComponentProductionFinding[];
        artifacts?: readonly string[];
      }
    >
  > = {}
): ComponentProductionStageResult[] {
  return COMPONENT_PRODUCTION_STAGE_IDS.map((id) => ({
    id,
    status: overrides[id]?.status ?? 'passed',
    summary: `${id} passed.`,
    findings: overrides[id]?.findings ?? [],
    artifacts: overrides[id]?.artifacts ?? [],
  }));
}
