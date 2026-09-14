import type {
  ComponentMetadata,
  ComponentQualityFinding,
  ComponentStabilityApprovalRecordV1,
} from '@vellira-ui/metadata';
import { describe, expect, it } from 'vitest';

import type { ComponentCompletenessResult } from '../component-completeness/types';
import type { ComponentReviewBundleSurface } from '../../component-production/review-bundle';
import {
  evaluateComponentStability,
  STABLE_APPROVAL_QUESTION,
  validateComponentLifecycleTransition,
  type StabilityEvidence,
} from './engine';

const metadata: ComponentMetadata = {
  name: 'Fixture',
  layer: 'components',
  category: 'utility',
  platforms: ['react'],
  profile: 'base',
  status: 'beta',
  capabilities: ['controlled'],
  requirements: {
    tests: true,
    storybook: true,
    docs: true,
    accessibility: true,
  },
};

const approval: ComponentStabilityApprovalRecordV1 = {
  schemaVersion: '1',
  component: 'Fixture',
  decision: 'approved',
  question: STABLE_APPROVAL_QUESTION,
  answer: 'yes',
  approvedBy: 'reviewer',
  approvedAt: '2026-09-14',
  source: {
    kind: 'github-pull-request',
    url: 'https://github.com/vellira-dev/vellira/pull/1',
    number: 1,
    revision: '1234567890abcdef1234567890abcdef12345678',
  },
  scope: ['complete component review'],
};

function finding(
  ruleId: string,
  dimension: ComponentQualityFinding['dimension'],
  status: ComponentQualityFinding['status'] = 'pass',
  message?: string
): ComponentQualityFinding {
  return {
    ruleId,
    dimension,
    severity:
      ruleId === 'coverage.storybook' ||
      ruleId === 'conformity.hardcoded-geometry'
        ? 'recommended'
        : 'required',
    evaluation: 'automated',
    status,
    platform: 'react',
    ...(message ? { message } : {}),
    evidence: [`evidence:${ruleId}`],
  };
}

const passingFindings: ComponentQualityFinding[] = [
  finding('api.public-surface', 'public-api'),
  finding('api.controlled-contract', 'behavior'),
  finding('coverage.tests', 'tests'),
  finding('platform.accessibility-semantics', 'accessibility'),
  finding(
    'platform.interaction',
    'interaction',
    'not-applicable',
    'Keyboard capability is not declared.'
  ),
  finding('coverage.storybook', 'storybook'),
  finding('coverage.documentation', 'documentation'),
  finding(
    'conformity.token-integration',
    'tokens-theming',
    'not-applicable',
    'No implementation styling surface exists for this platform.'
  ),
  finding('conformity.icon-resources', 'design-system'),
  finding('conformity.hardcoded-geometry', 'design-system'),
];

function completeness(
  overrides: Partial<ComponentCompletenessResult['checks'][number]> = {}
): ComponentCompletenessResult {
  const shared = [
    'metadata',
    'production-authorities',
    'type-ownership',
    'website',
    'api-docs',
    'component-docs',
  ] as const;
  const platform = [
    'implementation',
    'types',
    'exports',
    'tests',
    'storybook',
    'accessibility',
  ] as const;
  const checks: ComponentCompletenessResult['checks'][number][] = [
    ...shared.map((name) => ({ name, ok: true })),
    ...platform.map((name) => ({
      name,
      platform: 'react' as const,
      ok: true,
    })),
  ];

  return {
    componentName: 'Fixture',
    ready: true,
    checks: checks.map((check) =>
      check.name === overrides.name &&
      (!overrides.platform || check.platform === overrides.platform)
        ? { ...check, ...overrides }
        : check
    ),
  };
}

function surface(id: string): ComponentReviewBundleSurface {
  return {
    id,
    label: id,
    required: true,
    status: 'ready',
    artifacts: [`artifact:${id}`],
    missingArtifacts: [],
    evidence: [],
  };
}

function evidence(
  overrides: Partial<StabilityEvidence> = {}
): StabilityEvidence {
  return {
    metadata,
    completeness: completeness(),
    quality: {
      componentName: 'Fixture',
      status: 'pass',
      platforms: [],
      findings: passingFindings,
    },
    reviewSurfaces: [
      surface('website-component-page'),
      surface('catalog-registration'),
      surface('catalog-signature-preview'),
      surface('storybook-react'),
      surface('docs-react'),
    ],
    approval,
    ...overrides,
  };
}

describe('Component Stable graduation gate', () => {
  it('passes only when every required gate passes', () => {
    const report = evaluateComponentStability(evidence());

    expect(report.status).toBe('STABLE_ELIGIBLE');
    expect(report.gates).toHaveLength(15);
    expect(report.blockers).toEqual([]);
  });

  it('blocks on one required failure with no weighted compensation', () => {
    const findings = passingFindings.map((item) =>
      item.ruleId === 'api.public-surface'
        ? { ...item, status: 'fail' as const, message: 'Missing API.' }
        : item
    );
    const report = evaluateComponentStability(
      evidence({ quality: { ...evidence().quality, findings } })
    );

    expect(report.status).toBe('NOT_STABLE_ELIGIBLE');
    expect(report.blockers).toContainEqual(
      expect.objectContaining({
        gateId: 'public-api',
        code: 'api.public-surface',
      })
    );
  });

  it('blocks unresolved production warnings but keeps classified recommendations non-blocking', () => {
    const productionWarning = passingFindings.map((item) =>
      item.ruleId === 'coverage.storybook'
        ? { ...item, status: 'warn' as const, message: 'Missing state.' }
        : item
    );
    const recommendedWarning = passingFindings.map((item) =>
      item.ruleId === 'conformity.hardcoded-geometry'
        ? { ...item, status: 'warn' as const, message: 'Prefer tokens.' }
        : item
    );

    expect(
      evaluateComponentStability(
        evidence({
          quality: { ...evidence().quality, findings: productionWarning },
        })
      ).status
    ).toBe('NOT_STABLE_ELIGIBLE');

    const recommended = evaluateComponentStability(
      evidence({
        quality: { ...evidence().quality, findings: recommendedWarning },
      })
    );
    expect(recommended.status).toBe('STABLE_ELIGIBLE');
    expect(recommended.warnings).toContainEqual(
      expect.objectContaining({
        ruleId: 'conformity.hardcoded-geometry',
        policy: 'non-blocking-recommendation',
      })
    );
  });

  it('accepts deterministic N/A and blocks unexplained N/A', () => {
    const valid = evaluateComponentStability(evidence());
    expect(valid.gates.find(({ id }) => id === 'tokens-theming')).toMatchObject(
      {
        status: 'not-applicable',
        reason: expect.stringContaining('No implementation styling surface'),
      }
    );

    const invalidFindings = passingFindings.map((item) =>
      item.ruleId === 'conformity.token-integration'
        ? { ...item, message: undefined }
        : item
    );
    const invalid = evaluateComponentStability(
      evidence({
        quality: { ...evidence().quality, findings: invalidFindings },
      })
    );
    expect(invalid.status).toBe('NOT_STABLE_ELIGIBLE');
    expect(invalid.blockers).toContainEqual(
      expect.objectContaining({
        code: 'conformity.token-integration.unexplained-not-applicable',
      })
    );
  });

  it('blocks missing human approval', () => {
    const report = evaluateComponentStability(evidence({ approval: null }));
    expect(report.status).toBe('NOT_STABLE_ELIGIBLE');
    expect(report.blockers).toContainEqual(
      expect.objectContaining({ code: 'human-approval.missing' })
    );
  });

  it('blocks a platform-specific completeness failure', () => {
    const report = evaluateComponentStability(
      evidence({
        completeness: completeness({
          name: 'implementation',
          platform: 'react',
          ok: false,
          details: 'React implementation is missing.',
        }),
      })
    );
    expect(report.status).toBe('NOT_STABLE_ELIGIBLE');
    expect(report.blockers).toContainEqual(
      expect.objectContaining({
        gateId: 'declared-platforms',
        platform: 'react',
      })
    );
  });

  it('blocks a declared capability without its quality evidence', () => {
    const findings = passingFindings.filter(
      ({ ruleId }) => ruleId !== 'api.controlled-contract'
    );
    const report = evaluateComponentStability(
      evidence({ quality: { ...evidence().quality, findings } })
    );
    expect(report.status).toBe('NOT_STABLE_ELIGIBLE');
    expect(report.capabilities[0]).toMatchObject({
      capability: 'controlled',
      status: 'fail',
      reason: expect.stringContaining('api.controlled-contract'),
    });
  });

  it('rejects direct invalid Stable promotion and never derives deprecation', () => {
    expect(
      validateComponentLifecycleTransition({
        component: 'Fixture',
        previous: 'beta',
        next: 'stable',
      })
    ).toMatchObject({ valid: false });

    expect(
      validateComponentLifecycleTransition({
        component: 'Fixture',
        previous: 'beta',
        next: 'deprecated',
      })
    ).toEqual({ valid: true });
  });
});
