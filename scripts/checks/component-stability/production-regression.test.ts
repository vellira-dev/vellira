import { describe, expect, it } from 'vitest';

import { runComponentStabilityCheck } from './engine';

describe('Stable gate production regressions', () => {
  it('keeps Accordion as the approved cross-platform graduation fixture', async () => {
    const report = await runComponentStabilityCheck({
      componentName: 'Accordion',
    });

    expect(report.lifecycle).toBe('beta');
    expect(report.approval?.source.number).toBe(779);
    expect(report.capabilities.map(({ capability }) => capability)).toEqual(
      expect.arrayContaining([
        'controlled',
        'uncontrolled',
        'disabled',
        'keyboard',
        'compound-api',
        'multiple',
        'collapsible',
      ])
    );
    expect(report.status).toBe('STABLE_ELIGIBLE');
  });

  it('keeps Switch blocked without explicit human approval', async () => {
    const report = await runComponentStabilityCheck({
      componentName: 'Switch',
    });

    expect(report.lifecycle).toBe('beta');
    expect(report.status).toBe('NOT_STABLE_ELIGIBLE');
    expect(report.blockers).toContainEqual(
      expect.objectContaining({ code: 'human-approval.missing' })
    );
  });
});
