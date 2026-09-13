import { describe, expect, it } from 'vitest';

import { parseComponentGeneratorArgs } from './cli';

describe('presentation capability CLI vocabulary', () => {
  it('accepts reusable multiple and collapsible behavior intent', () => {
    const result = parseComponentGeneratorArgs([
      'DisclosureProbe',
      'both',
      'components',
      'navigation',
      '--profile=compound',
      '--capabilities=compound-api,multiple,collapsible',
      '--parts=Root,Item,Trigger,Content',
    ]);

    expect(result.capabilities).toEqual([
      'compound-api',
      'multiple',
      'collapsible',
    ]);
  });
});
