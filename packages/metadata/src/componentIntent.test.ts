import { describe, expect, it } from 'vitest';

import type { ComponentMetadata } from './component';
import {
  evaluateComponentIntentCoverage,
  type ComponentIntentTargetV1,
} from './componentIntent';
import { accordionMetadata } from './components';
import { componentExpansionCatalog } from './expansionCatalog';

function target(name: string) {
  const result = componentExpansionCatalog.find((item) => item.name === name);
  if (!result) throw new Error(`Missing expansion target ${name}.`);
  return result;
}

function avatarMetadata(
  semanticCapabilities: ComponentMetadata['semanticCapabilities'] = []
): ComponentMetadata {
  return {
    name: 'Avatar',
    layer: 'primitives',
    category: 'data-display',
    platforms: ['react', 'react-native'],
    profile: 'base',
    status: 'experimental',
    semanticCapabilities,
    requirements: {
      tests: true,
      storybook: true,
      docs: true,
      accessibility: true,
      componentTokens: 'standard',
    },
  };
}

describe('Component Intent / Capability Coverage V1', () => {
  it('does not treat a generic Avatar scaffold as semantic coverage', () => {
    const coverage = evaluateComponentIntentCoverage(
      target('Avatar'),
      avatarMetadata()
    );

    expect(coverage.status).toBe('partial');
    expect(coverage.platforms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: 'react',
          status: 'missing',
          missingCapabilities: expect.arrayContaining([
            'image-source',
            'fallback',
            'size-variants',
            'accessible-name',
          ]),
        }),
        expect.objectContaining({
          platform: 'react-native',
          status: 'missing',
        }),
      ])
    );
  });

  it('accepts fully represented Avatar semantic evidence', () => {
    const avatarTarget = target('Avatar');
    const coverage = evaluateComponentIntentCoverage(
      avatarTarget,
      avatarMetadata([
        'image-source',
        'fallback',
        'size-variants',
        'accessible-name',
      ])
    );

    expect(coverage).toMatchObject({
      status: 'satisfied',
      structuralMismatches: [],
      errors: [],
    });
    expect(
      coverage.platforms.every((platform) => platform.status === 'satisfied')
    ).toBe(true);
  });

  it('proves a mature canonical component against the same public authority', () => {
    expect(
      evaluateComponentIntentCoverage(target('Accordion'), accordionMetadata)
    ).toMatchObject({
      status: 'satisfied',
      component: 'Accordion',
      structuralMismatches: [],
      errors: [],
    });
  });

  it('keeps platform-specific coverage visible instead of claiming false parity', () => {
    const platformTarget: ComponentIntentTargetV1 = {
      name: 'PlatformProbe',
      layer: 'components',
      category: 'utility',
      platforms: ['react', 'react-native'],
      profile: 'base',
      componentTokens: false,
      intent: {
        schemaVersion: '1',
        job: 'Exercise platform-scoped capability evidence.',
        requiredCapabilities: ['disabled'],
        platformRequirements: {
          react: ['keyboard'],
          'react-native': ['accessible-name'],
        },
      },
    };
    const metadata: ComponentMetadata = {
      name: 'PlatformProbe',
      layer: 'components',
      category: 'utility',
      platforms: ['react', 'react-native'],
      profile: 'base',
      status: 'experimental',
      capabilities: ['disabled'],
      platformCapabilities: {
        react: ['keyboard'],
      },
      requirements: {
        tests: true,
        storybook: true,
        docs: true,
        accessibility: true,
        componentTokens: false,
      },
    };

    const coverage = evaluateComponentIntentCoverage(platformTarget, metadata);

    expect(coverage.status).toBe('partial');
    expect(coverage.platforms).toEqual([
      expect.objectContaining({ platform: 'react', status: 'satisfied' }),
      expect.objectContaining({
        platform: 'react-native',
        status: 'partial',
        missingCapabilities: ['accessible-name'],
      }),
    ]);
  });

  it('fails closed when an intent contains an unknown capability', () => {
    const invalidTarget = {
      ...target('Avatar'),
      intent: {
        ...target('Avatar').intent,
        requiredCapabilities: ['image-source', 'not-a-real-capability'],
      },
    } as unknown as ComponentIntentTargetV1;

    expect(
      evaluateComponentIntentCoverage(
        invalidTarget,
        avatarMetadata(['image-source'])
      )
    ).toMatchObject({
      status: 'unknown',
      errors: [expect.stringContaining('unknown capability')],
    });
  });

  it('is deterministic for identical target and metadata evidence', () => {
    const avatarTarget = target('Avatar');
    const metadata = avatarMetadata([
      'image-source',
      'fallback',
      'size-variants',
      'accessible-name',
    ]);

    expect(evaluateComponentIntentCoverage(avatarTarget, metadata)).toEqual(
      evaluateComponentIntentCoverage(avatarTarget, metadata)
    );
  });
});
