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
    ).toMatchObject({
      name: 'intent-coverage',
      ok: false,
      details: expect.stringContaining('image-source'),
    });
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
    ).toEqual({
      name: 'intent-coverage',
      ok: true,
    });
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
    ).toBeNull();
  });
});
