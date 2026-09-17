import { describe, expect, it } from 'vitest';

import type {
  ComponentExpansionTarget,
  ComponentMetadata,
} from '@vellira-ui/metadata';

import { checkComponentIntentCoverage } from './check-intent-coverage';

const avatarTarget = {
  name: 'Avatar',
  layer: 'primitives',
  category: 'data-display',
  platforms: ['react', 'react-native'],
  profile: 'base',
  componentTokens: 'standard',
  role: 'foundational',
  intent: {
    schemaVersion: '1',
    job: 'Represent identity with an image and deterministic fallback.',
    requiredCapabilities: [
      'image-source',
      'fallback',
      'size-variants',
      'accessible-name',
    ],
  },
} as const satisfies ComponentExpansionTarget;

function metadata(
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

describe('component completeness intent coverage', () => {
  it('blocks a structurally present component with missing semantic intent', () => {
    expect(
      checkComponentIntentCoverage({
        metadata: metadata(),
        targets: [avatarTarget],
      })
    ).toEqual([
      {
        name: 'intent-coverage',
        ok: true,
      },
      {
        name: 'intent-coverage',
        platform: 'react',
        ok: false,
        details:
          'Component intent coverage is missing on react.\nMissing semantic capabilities: image-source, fallback, size-variants, accessible-name.',
      },
      {
        name: 'intent-coverage',
        platform: 'react-native',
        ok: false,
        details:
          'Component intent coverage is missing on react-native.\nMissing semantic capabilities: image-source, fallback, size-variants, accessible-name.',
      },
    ]);
  });

  it('passes only when required target semantics are represented', () => {
    expect(
      checkComponentIntentCoverage({
        metadata: metadata([
          'image-source',
          'fallback',
          'size-variants',
          'accessible-name',
        ]),
        targets: [avatarTarget],
      })
    ).toEqual([
      { name: 'intent-coverage', ok: true },
      { name: 'intent-coverage', platform: 'react', ok: true },
      { name: 'intent-coverage', platform: 'react-native', ok: true },
    ]);
  });

  it('does not invent intent requirements for unrelated components', () => {
    expect(
      checkComponentIntentCoverage({
        metadata: {
          ...metadata(),
          name: 'UntrackedProbe',
        },
        targets: [avatarTarget],
      })
    ).toEqual([]);
  });
});
