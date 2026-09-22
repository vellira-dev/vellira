import { describe, expect, it } from 'vitest';

import { createComponentGenerationPlan } from './plan';
import {
  createComponentMetadataFromPlan,
  createMetadataTemplateParamsFromPlan,
} from './metadata';
import { renderMetadataTemplate } from './templates';

function plan(
  overrides: Partial<
    Parameters<typeof createComponentGenerationPlan>[0]['options']
  > = {}
) {
  return createComponentGenerationPlan({
    root: '/repo',
    options: {
      componentName: 'SemanticProbe',
      platform: 'both',
      layer: 'components',
      category: 'feedback',
      profile: 'base',
      componentTokens: false,
      capabilities: [],
      parts: [],
      force: false,
      ...overrides,
    },
  });
}

describe('component metadata plan projection', () => {
  it('projects shared semantic capabilities into rendered and documentation metadata', () => {
    const generationPlan = plan({
      semanticCapabilities: ['dismissible', 'reduced-motion'],
    });
    const projection = createMetadataTemplateParamsFromPlan(generationPlan);
    const rendered = renderMetadataTemplate(projection);
    const documentationMetadata =
      createComponentMetadataFromPlan(generationPlan);

    expect(projection.semanticCapabilities).toEqual([
      'dismissible',
      'reduced-motion',
    ]);
    expect(rendered).toContain(`  semanticCapabilities: [
    'dismissible',
    'reduced-motion',
  ],`);
    expect(documentationMetadata.semanticCapabilities).toEqual(
      projection.semanticCapabilities
    );
    expect(projection).not.toHaveProperty('platformSemanticCapabilities');
  });

  it('normalizes platform semantic capabilities into deterministic platform order', () => {
    const generationPlan = plan({
      platformSemanticCapabilities: {
        'react-native': ['announcement'],
        react: ['auto-dismiss'],
      },
    });
    const projection = createMetadataTemplateParamsFromPlan(generationPlan);
    const rendered = renderMetadataTemplate(projection);
    const documentationMetadata =
      createComponentMetadataFromPlan(generationPlan);

    expect(projection.platformSemanticCapabilities).toEqual({
      react: ['auto-dismiss'],
      'react-native': ['announcement'],
    });
    expect(rendered.indexOf("react: ['auto-dismiss']")).toBeLessThan(
      rendered.indexOf("'react-native': ['announcement']")
    );
    expect(documentationMetadata.platformSemanticCapabilities).toEqual(
      projection.platformSemanticCapabilities
    );
    expect(projection).not.toHaveProperty('semanticCapabilities');
  });

  it('is the shared authority for rendered and documentation metadata', () => {
    const generationPlan = plan({
      semanticCapabilities: ['dismissible', 'reduced-motion'],
      platformSemanticCapabilities: {
        'react-native': ['announcement'],
        react: ['auto-dismiss'],
      },
    });
    const projection = createMetadataTemplateParamsFromPlan(generationPlan);
    const rendered = renderMetadataTemplate(projection);
    const documentationMetadata =
      createComponentMetadataFromPlan(generationPlan);

    expect(projection.semanticCapabilities).toEqual([
      'dismissible',
      'reduced-motion',
    ]);
    expect(projection.platformSemanticCapabilities).toEqual({
      react: ['auto-dismiss'],
      'react-native': ['announcement'],
    });
    expect(rendered).toContain(`  semanticCapabilities: [
    'dismissible',
    'reduced-motion',
  ],`);
    expect(rendered).toContain(`  platformSemanticCapabilities: {
    'react': ['auto-dismiss'],
    'react-native': ['announcement'],
  },`);
    expect(documentationMetadata.semanticCapabilities).toEqual(
      projection.semanticCapabilities
    );
    expect(documentationMetadata.platformSemanticCapabilities).toEqual(
      projection.platformSemanticCapabilities
    );
  });

  it.each([
    ['web', ['react']],
    ['native', ['react-native']],
    ['both', ['react', 'react-native']],
  ] as const)(
    'preserves deterministic %s platform projection',
    (platform, expected) => {
      expect(
        createMetadataTemplateParamsFromPlan(plan({ platform })).platforms
      ).toEqual(expected);
    }
  );

  it('preserves empty-intent omission and tokenless metadata', () => {
    const generationPlan = plan({
      platformSemanticCapabilities: { react: [] },
    });
    const rendered = renderMetadataTemplate(
      createMetadataTemplateParamsFromPlan(generationPlan)
    );
    const documentationMetadata =
      createComponentMetadataFromPlan(generationPlan);

    expect(rendered).not.toContain('semanticCapabilities:');
    expect(rendered).not.toContain('platformSemanticCapabilities:');
    expect(rendered).toContain('componentTokens: false');
    expect(documentationMetadata).not.toHaveProperty('semanticCapabilities');
    expect(documentationMetadata).not.toHaveProperty(
      'platformSemanticCapabilities'
    );
    expect(documentationMetadata.requirements.componentTokens).toBe(false);
    expect(
      createMetadataTemplateParamsFromPlan(generationPlan)
    ).not.toHaveProperty('platformSemanticCapabilities');
  });
});
