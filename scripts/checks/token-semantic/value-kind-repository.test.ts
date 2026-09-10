import { describe, expect, it } from 'vitest';

import { checkTokenValueKinds } from './value-kind-repository';

/** Exercise real themes and controlSizes, never a fixture-only baseline. */
describe('maintained value-kind inventory', () => {
  it('checks all theme layers and shared control sizes without findings', () => {
    const result = checkTokenValueKinds();
    expect(result.checked).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
    expect(result.coverage).toBe('partial');
  });

  // cli.test.ts proves registration using its existing full repository report.
});
