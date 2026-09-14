import type {
  ComponentMetadata,
  ComponentStabilityReportV1,
} from '@vellira-ui/metadata';
import { describe, expect, it, vi } from 'vitest';

import { validateCanonicalLifecycleTransitions } from './lifecycle';

function metadata(status: ComponentMetadata['status']): ComponentMetadata {
  return {
    name: 'Fixture',
    layer: 'components',
    category: 'utility',
    platforms: ['react'],
    profile: 'base',
    status,
    requirements: {
      tests: true,
      storybook: true,
      docs: true,
      accessibility: true,
    },
  };
}

function stability(
  status: ComponentStabilityReportV1['status']
): ComponentStabilityReportV1 {
  return {
    schemaVersion: '1',
    component: 'Fixture',
    lifecycle: 'stable',
    status,
    gates: [],
    capabilities: [],
    blockers: [],
    warnings: [],
    approval: null,
  };
}

describe('canonical lifecycle transition validation', () => {
  it('allows generated experimental components and beta graduation', async () => {
    const generated = await validateCanonicalLifecycleTransitions({
      metadataRegistry: [metadata('experimental')],
      previousStatuses: new Map(),
    });
    const beta = await validateCanonicalLifecycleTransitions({
      metadataRegistry: [metadata('beta')],
      previousStatuses: new Map([['Fixture', 'experimental']]),
    });

    expect(generated[0]).toMatchObject({ valid: true });
    expect(beta[0]).toMatchObject({ valid: true });
  });

  it('runs Stable eligibility only for a new Stable transition', async () => {
    const runStability = vi.fn(async () => stability('NOT_STABLE_ELIGIBLE'));
    const invalid = await validateCanonicalLifecycleTransitions({
      metadataRegistry: [metadata('stable')],
      previousStatuses: new Map([['Fixture', 'beta']]),
      runStability,
    });

    expect(runStability).toHaveBeenCalledWith('Fixture');
    expect(invalid[0]).toMatchObject({ valid: false });

    runStability.mockResolvedValue(stability('STABLE_ELIGIBLE'));
    const valid = await validateCanonicalLifecycleTransitions({
      metadataRegistry: [metadata('stable')],
      previousStatuses: new Map([['Fixture', 'beta']]),
      runStability,
    });
    expect(valid[0]).toMatchObject({ valid: true });
  });

  it('grandfathers existing Stable components without automatic approval', async () => {
    const runStability = vi.fn(async () => stability('STABLE_ELIGIBLE'));
    const result = await validateCanonicalLifecycleTransitions({
      metadataRegistry: [metadata('stable')],
      previousStatuses: new Map([['Fixture', 'stable']]),
      runStability,
    });

    expect(result[0]).toMatchObject({ valid: true });
    expect(runStability).not.toHaveBeenCalled();
  });
});
