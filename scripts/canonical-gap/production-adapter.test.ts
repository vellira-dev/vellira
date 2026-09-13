import { expect, it } from 'vitest';

import {
  COMPONENT_PRODUCTION_STAGE_IDS,
  createComponentProductionResult,
  parseComponentProductionInput,
  type ComponentProductionStageId,
} from '../component-production/contracts';
import { canonicalGapRequestsFromComponentProductionReport } from './production-adapter';

function report(
  messages: string[],
  stage: ComponentProductionStageId = 'preflight'
) {
  return createComponentProductionResult({
    input: parseComponentProductionInput({
      schemaVersion: '1',
      componentName: 'Accordion',
      platform: 'both',
      layer: 'components',
      category: 'navigation',
      profile: 'compound',
    }),
    stages: COMPONENT_PRODUCTION_STAGE_IDS.map((id) => ({
      id,
      status:
        messages.length === 0 ? 'passed' : id === stage ? 'blocked' : 'skipped',
      summary: 'production contract evidence',
      findings:
        id === stage
          ? messages.map((message, index) => ({
              id: `${stage}:${index + 1}`,
              stage,
              severity: 'blocking',
              message,
            }))
          : [],
      artifacts: [],
    })),
    completeness: null,
    quality: null,
  });
}

it('routes Generator V2 missing icon, token, asset and registry gaps', () => {
  const batch = canonicalGapRequestsFromComponentProductionReport(
    report([
      'missing-icon-resource: name="ChevronMagic" purpose="disclosure indicator" platform="react" — expected canonical export from @vellira-ui/icons',
      'missing-design-token: path="semantic.motion.disclosure" component="Accordion" part="component" platform="react-native" — expected canonical token path in @vellira-ui/tokens',
      'missing-design-asset: path="brand/accordion.svg" purpose="brand mark" expected="/repo/packages/assets/brand/accordion.svg"',
      'missing-icon-resource-registry: component="Accordion" platform="react" registry="/repo/packages/icons/src/web.source.ts"',
      'missing-design-token-registry: component="Accordion" registry="/repo/packages/tokens/src/generated/token-types.ts"',
    ])
  );

  expect(batch.requests.map(({ kind }) => kind).sort()).toEqual([
    'design-resource',
    'design-resource',
    'design-resource',
    'icon',
    'token',
  ]);
  expect(batch.requests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'icon',
        canonicalTarget: 'ChevronMagic',
        consumer: 'component-production:Accordion',
      }),
      expect.objectContaining({
        kind: 'token',
        canonicalTarget: 'semantic.motion.disclosure',
      }),
      expect.objectContaining({
        kind: 'design-resource',
        canonicalTarget: 'brand/accordion.svg',
      }),
    ])
  );
});

it('deduplicates the same missing token across platform findings', () => {
  const batch = canonicalGapRequestsFromComponentProductionReport(
    report([
      'missing-design-token: path="semantic.motion.disclosure" component="Accordion" part="component" platform="react" — expected canonical token path in @vellira-ui/tokens',
      'missing-design-token: path="semantic.motion.disclosure" component="Accordion" part="component" platform="react-native" — expected canonical token path in @vellira-ui/tokens',
    ])
  );

  expect(batch.requests).toHaveLength(1);
  expect(batch.requests[0]).toMatchObject({
    kind: 'token',
    canonicalTarget: 'semantic.motion.disclosure',
  });
});

it.each([
  ['schemaVersion', '2'],
  ['input', { componentName: 'Accordion' }],
  ['stages', []],
  ['stages', [null]],
  ['blockingFindings', []],
  ['status', 'ready'],
  ['readyForReview', true],
  ['lifecycle', {}],
  ['artifacts', undefined],
  ['outputs', {}],
  ['validationSummary', {}],
  ['completeness', 'invalid'],
  ['quality', 42],
])('fails closed on malformed result field %s', (field, value) => {
  const valid = report([
    'missing-design-token: path="semantic.motion.disclosure" component="Accordion" part="component" platform="react"',
  ]);
  expect(() =>
    canonicalGapRequestsFromComponentProductionReport({
      ...valid,
      [String(field)]: value,
    })
  ).toThrow();
});

it.each([
  null,
  { message: 'missing-design-token: path="anything"' },
  {
    id: 'preflight:1',
    stage: 'preflight',
    severity: 'invalid',
    message: 'failure',
  },
])(
  'rejects malformed stage findings instead of silently dropping them: %j',
  (finding) => {
    const valid = report(['generic failure']);
    const stages = valid.stages.map((stage, index) =>
      index === 0 ? { ...stage, findings: [finding] } : stage
    );
    expect(() =>
      canonicalGapRequestsFromComponentProductionReport({ ...valid, stages })
    ).toThrow();
  }
);

it.each([
  'missing-icon-resource: name="ChevronMagic"',
  'missing-design-token: path="semantic.motion.disclosure"',
  'missing-design-asset: path="brand/accordion.svg"',
  'missing-icon-resource-registry: component="Accordion"',
  'missing-icon-resource-registry: platform="react"',
  'missing-design-token-registry: component="Accordion"',
  'missing-icon-resource: name="ChevronMagic" purpose="indicator" platform="arbitrary"',
  'missing-design-token: path="semantic.motion.disclosure" part="component" platform="arbitrary"',
  'missing-design-token: path="first" path="second" part="component" platform="react"',
])('rejects malformed supported resource blocker %s', (message) => {
  expect(() =>
    canonicalGapRequestsFromComponentProductionReport(report([message]))
  ).toThrow();
});

it('rejects a non-string stage status even when its derived summaries agree', () => {
  const valid = report([]);
  const stages = valid.stages.map((stage, index) =>
    index === 0 ? { ...stage, status: ['passed'] } : stage
  );
  expect(() =>
    canonicalGapRequestsFromComponentProductionReport({ ...valid, stages })
  ).toThrow(/stage/);
});

it('does not route semantic completion, ordinary failures or successful production', () => {
  for (const input of [
    report(
      ['Reviewed API, accessibility and design semantics are still required.'],
      'semantic-completion'
    ),
    report(['Generator command exited with code 1.']),
    report([]),
  ]) {
    expect(
      canonicalGapRequestsFromComponentProductionReport(input).requests
    ).toEqual([]);
  }
});

it('does not promote warning-only resources into blockers or issues', () => {
  const ready = report([]);
  const input = createComponentProductionResult({
    input: ready.input,
    completeness: null,
    quality: null,
    stages: ready.stages.map((stage, index) =>
      index === 0
        ? {
            ...stage,
            findings: [
              {
                id: 'preflight:warning',
                stage: 'preflight',
                severity: 'warning',
                message:
                  'missing-design-token: path="semantic.optional" component="Accordion" part="component" platform="react"',
              },
            ],
          }
        : stage
    ),
  });
  expect(
    canonicalGapRequestsFromComponentProductionReport(input).requests
  ).toEqual([]);
});
