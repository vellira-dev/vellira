import { describe, expect, it } from 'vitest';

import { resolveSelectListViewportHeight } from './selectListViewport';

describe('Select list viewport height', () => {
  it('grows a short list when rendered content exceeds its row estimate', () => {
    expect(
      resolveSelectListViewportHeight(108, 121.33333587646484, 420)
    ).toBeCloseTo(121.33333587646484, 5);
  });

  it('keeps the estimated height when measurement is smaller or invalid', () => {
    expect(resolveSelectListViewportHeight(108, 100, 420)).toBe(108);
    expect(resolveSelectListViewportHeight(108, Number.NaN, 420)).toBe(108);
  });

  it('caps long lists and unexpectedly large measurements', () => {
    expect(resolveSelectListViewportHeight(864, 0, 420)).toBe(420);
    expect(resolveSelectListViewportHeight(108, 800, 420)).toBe(420);
  });
});
