import { describe, expect, it } from 'vitest';

import { MIN_PUBLIC_META_DESCRIPTION_LENGTH } from '../../../apps/website/src/component-catalog/registry/componentSeo';
import { renderComponentDocPage } from './render';

describe('component docs renderer', () => {
  it('deterministically expands short generated search descriptions', () => {
    const rendered = renderComponentDocPage({
      componentName: 'FixtureProbe',
      platform: 'react',
      docs: {
        title: 'FixtureProbe - React',
        description: 'FixtureProbe for React.',
        summary: 'Fixture summary.',
      },
      apiSections: [],
      authoredContent: '',
    });
    const description = rendered.match(/description: "([^"]+)"/)?.[1];

    expect(description?.length).toBeGreaterThanOrEqual(
      MIN_PUBLIC_META_DESCRIPTION_LENGTH
    );
    expect(description).toContain('FixtureProbe for React.');
  });
});
