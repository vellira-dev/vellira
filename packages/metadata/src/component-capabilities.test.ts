import { describe, expect, it } from 'vitest';

import { componentCapabilities, validateComponentMetadata } from './index';

describe('component capability authority', () => {
  it('keeps runtime validation aligned with the exported capability vocabulary', () => {
    expect(componentCapabilities).toContain('indeterminate');
    expect(componentCapabilities).toContain('multiple');
    expect(componentCapabilities).toContain('collapsible');

    expect(
      validateComponentMetadata({
        name: 'DisclosureProbe',
        layer: 'components',
        category: 'navigation',
        platforms: ['react', 'react-native'],
        profile: 'compound',
        status: 'experimental',
        capabilities: ['compound-api', 'multiple', 'collapsible'],
        requirements: {
          tests: true,
          storybook: true,
          docs: true,
          accessibility: true,
        },
      })
    ).toMatchObject({
      valid: true,
    });
  });
});
