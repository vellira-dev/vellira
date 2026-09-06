import { describe, expect, it } from 'vitest';

import { resolveComponentTypeOwnership } from './type-ownership';

describe('component type ownership', () => {
  it('keeps neutral base components platform-owned', () => {
    expect(
      resolveComponentTypeOwnership({
        profile: 'base',
        capabilities: [],
      })
    ).toBe('platform');
  });

  it.each(['form-control', 'compound', 'overlay'] as const)(
    'uses shared ownership for %s semantic contracts',
    (profile) => {
      expect(
        resolveComponentTypeOwnership({
          profile,
          capabilities: [],
        })
      ).toBe('shared');
    }
  );

  it('uses semantic capabilities rather than a component name allowlist', () => {
    expect(
      resolveComponentTypeOwnership({
        profile: 'base',
        capabilities: ['controlled'],
      })
    ).toBe('shared');
  });
});
