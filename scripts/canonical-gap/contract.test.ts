import { describe, expect, it } from 'vitest';

import {
  resolveMissingComponentRequest,
  type MissingComponentAuthorities,
} from '../component-production/missing-component-request';
import {
  canonicalGapRequestFromComponentResolution,
  canonicalGapRequestsFromUiUsageReport,
  canonicalGapIssueForRequest,
} from './orchestrator';
import {
  canonicalGapIssueMarker,
  extractCanonicalGapRequestId,
  parseCanonicalGapBatch,
  parseCanonicalGapRequest,
} from './types';

const authorities: MissingComponentAuthorities = {
  components: [
    {
      name: 'Button',
      layer: 'primitives',
      category: 'action',
      platforms: ['react', 'react-native'],
      profile: 'base',
      status: 'stable',
      capabilities: ['disabled'],
      requirements: {
        tests: true,
        storybook: true,
        docs: true,
        accessibility: true,
      },
    },
  ],
  targets: [
    {
      name: 'Textarea',
      layer: 'primitives',
      category: 'form',
      platforms: ['react', 'react-native'],
      profile: 'form-control',
      componentTokens: 'standard',
      role: 'form-control',
      intent: {
        schemaVersion: '1',
        job: 'Enter and edit multiline text.',
        requiredCapabilities: ['multiline', 'accessible-name'],
      },
    },
  ],
};

function finding(overrides: Record<string, unknown> = {}) {
  return {
    ruleId: 'vellira-ui.missing-token-resource',
    path: 'apps/website/src/example.css',
    line: 7,
    column: 12,
    detected: '--font-family-mono',
    severity: 'error',
    blocking: true,
    nextAction: 'request-missing-resource',
    message: 'missing resource',
    ...overrides,
  };
}

function report(findings: unknown[]) {
  return {
    schemaVersion: '1',
    mode: 'blocking',
    findings,
    exceptions: [],
    summary: {
      filesScanned: 1,
      findings: findings.length,
      blockingFindings: findings.length,
      exceptionsApplied: 0,
    },
  };
}

describe('canonical gap contract', () => {
  it.each([
    ['plain-token', 'plain-token'],
    ['token\\path', 'token\\\\path'],
    ['token`part', 'token\\`part'],
    ['token\\`part', 'token\\\\\\`part'],
    ['<token&part>', '&lt;token&amp;part&gt;'],
  ])('escapes inline issue evidence completely: %s', (detected, escaped) => {
    const request = canonicalGapRequestsFromUiUsageReport(
      report([finding({ detected })])
    ).requests[0];
    const issue = canonicalGapIssueForRequest(request);
    expect(issue.body).toContain(`- **Canonical target:** \`${escaped}\``);
    expect(issue.body).toContain(`- Detected: \`${escaped}\``);
    expect(extractCanonicalGapRequestId(issue.body)).toBe(request.requestId);
  });

  it('keeps a stable hidden marker across surrounding prose edits', () => {
    const marker = canonicalGapIssueMarker('canonical-gap-test-1');
    expect(
      extractCanonicalGapRequestId(`edited\n${marker}\nedited again`)
    ).toBe('canonical-gap-test-1');
  });

  it('fails closed on unknown fields and duplicate request ids', () => {
    const request = {
      schemaVersion: '1',
      requestId: 'canonical-gap-test-1',
      kind: 'token',
      canonicalTarget: '--font-family-mono',
      requestedIntent: 'mono font',
      consumer: 'apps/website/src/example.css',
      launchCritical: false,
    };
    expect(() =>
      parseCanonicalGapRequest({ ...request, surprise: true })
    ).toThrow(/Unknown canonical gap request field/);
    expect(() =>
      parseCanonicalGapBatch({
        schemaVersion: '1',
        requests: [request, request],
      })
    ).toThrow(/duplicate request id/);
    for (const field of [
      'labels',
      'title',
      'body',
      'assignees',
      'repository',
      'milestone',
      'state',
    ]) {
      expect(() =>
        parseCanonicalGapRequest({ ...request, [field]: 'injected' })
      ).toThrow(/Unknown/);
      expect(() =>
        parseCanonicalGapBatch({
          schemaVersion: '1',
          requests: [request],
          [field]: 'injected',
        })
      ).toThrow(/Unknown/);
    }
  });
});

describe('canonical gap adapters', () => {
  it('derives mutations from bounded fields and ignores finding-supplied routing', () => {
    const batch = canonicalGapRequestsFromUiUsageReport(
      report([
        finding({
          labels: ['arbitrary', 'launch-blocker'],
          launchCritical: true,
          title: 'injected title',
          body: '<!-- injected marker -->',
          assignees: ['attacker'],
        }),
      ])
    );
    const desired = canonicalGapIssueForRequest(batch.requests[0]);
    expect(Object.keys(desired).sort()).toEqual(['body', 'labels', 'title']);
    expect(desired.labels).toEqual([
      'canonical-gap',
      'canonical-gap:ready',
      'design-resource-gap',
    ]);
    expect(desired.title).toBe(
      'feat(tokens): resolve canonical token --font-family-mono'
    );
    expect(desired.body).not.toContain('injected');
    expect(desired.body).toContain('consumer remains blocked');
  });

  it('deduplicates one missing token across consumers with a stable request identity', () => {
    const first = finding();
    const second = finding({ path: 'apps/docs/src/other.css', line: 400 });
    const combined = canonicalGapRequestsFromUiUsageReport(
      report([first, second])
    );
    expect(combined.requests).toHaveLength(1);
    expect(
      canonicalGapRequestsFromUiUsageReport(report([first])).requests[0]
        .requestId
    ).toBe(
      canonicalGapRequestsFromUiUsageReport(report([second])).requests[0]
        .requestId
    );
  });
  it('routes missing and enhancement component resolutions without fake semantics', () => {
    const missing = resolveMissingComponentRequest(
      {
        schemaVersion: '1',
        requestedComponent: 'Textarea',
        requestedIntent: 'multiline text entry',
        consumer: 'apps/website/src/example.tsx',
        platforms: ['react'],
        reusable: true,
      },
      authorities
    );
    const enhancement = resolveMissingComponentRequest(
      {
        schemaVersion: '1',
        requestedComponent: 'Button',
        requestedIntent: 'loading action',
        consumer: 'apps/website/src/example.tsx',
        platforms: ['react'],
        reusable: true,
        requiredCapabilities: ['loading'],
      },
      authorities
    );

    expect(canonicalGapRequestFromComponentResolution(missing)).toMatchObject({
      kind: 'component',
      canonicalTarget: 'Textarea',
      productionSeed: { componentName: 'Textarea', platform: 'both' },
    });
    expect(
      canonicalGapRequestFromComponentResolution(enhancement)
    ).toMatchObject({
      kind: 'component-enhancement',
      canonicalTarget: 'Button',
    });
  });

  it('returns no work for reuse-existing and non-reusable layout', () => {
    const reused = resolveMissingComponentRequest(
      {
        schemaVersion: '1',
        requestedComponent: 'Button',
        requestedIntent: 'button',
        consumer: 'apps/website/src/example.tsx',
        platforms: ['react'],
        reusable: true,
      },
      authorities
    );
    const layout = resolveMissingComponentRequest(
      {
        schemaVersion: '1',
        requestedIntent: 'page layout',
        consumer: 'apps/website/src/example.tsx',
        platforms: ['react'],
        reusable: false,
      },
      authorities
    );

    expect(canonicalGapRequestFromComponentResolution(reused)).toBeNull();
    expect(canonicalGapRequestFromComponentResolution(layout)).toBeNull();
  });

  it('adapts missing token, raw token value, icon, and #850 component findings', () => {
    const batch = canonicalGapRequestsFromUiUsageReport(
      report([
        finding(),
        finding({
          ruleId: 'vellira-ui.noncanonical-token-value',
          detected: '#123456',
          line: 9,
        }),
        finding({
          ruleId: 'vellira-ui.noncanonical-icon',
          detected: 'svg',
          path: 'apps/website/src/IconThing.tsx',
          line: 11,
        }),
        finding({
          ruleId: 'vellira-ui.missing-component',
          detected: 'textarea',
          path: 'apps/docs/src/example.tsx',
          line: 3,
          nextAction: 'request-missing-component',
        }),
      ])
    );

    expect(batch.requests.map(({ kind }) => kind).sort()).toEqual([
      'icon',
      'token',
      'token',
    ]);
    expect(
      batch.requests.some(
        ({ canonicalTarget }) => canonicalTarget === 'Textarea'
      )
    ).toBe(false);
  });
});
