import fs from 'node:fs';
import path from 'node:path';

import {
  componentMetadata,
  componentStabilityGateIds,
  validateComponentMetadata,
} from '../../../packages/metadata/src';
import type {
  ComponentCapability,
  ComponentLifecycle,
  ComponentMetadata,
  ComponentPlatform,
  ComponentQualityFinding,
  ComponentQualityResult,
  ComponentStabilityApprovalRecordV1,
  ComponentStabilityBlocker,
  ComponentStabilityGateId,
  ComponentStabilityGateResult,
  ComponentStabilityReportV1,
  ComponentStabilityWarning,
} from '@vellira-ui/metadata';

import { runComponentCompletenessCheck } from '../component-completeness/run';
import type {
  ComponentCheckResult,
  ComponentCompletenessResult,
} from '../component-completeness/types';
import { runComponentQualityCheck } from '../component-quality/engine';
import { componentQualityRules } from '../component-quality/rules';
import {
  evaluateComponentReviewSurfaces,
  type ComponentReviewBundleSurface,
} from '../../component-production/review-bundle';
import type { ComponentProductionInputV1 } from '../../component-production/contracts';

export const STABLE_APPROVAL_QUESTION =
  'Would I ship this component today without requesting any code, UX, accessibility, docs, or presentation change?';

export const stableWarningPolicies = {
  'coverage.storybook': {
    blocking: true,
    reason:
      'Stable requires production-complete Storybook coverage, so this production warning blocks graduation.',
  },
  'conformity.hardcoded-geometry': {
    blocking: false,
    reason:
      'This V1 geometry recommendation remains non-blocking until its quality rule is reclassified.',
  },
} as const;

export type StabilityEvidence = {
  metadata: ComponentMetadata;
  completeness: ComponentCompletenessResult;
  quality: ComponentQualityResult;
  reviewSurfaces: readonly ComponentReviewBundleSurface[];
  approval: ComponentStabilityApprovalRecordV1 | null;
  approvalError?: string;
};

type GateSignal = {
  applicable: boolean;
  ok: boolean;
  code: string;
  message: string;
  evidence?: readonly string[];
  platform?: ComponentPlatform;
};

const capabilityRuleIds: Record<ComponentCapability, readonly string[]> = {
  controlled: ['api.controlled-contract', 'coverage.tests'],
  uncontrolled: ['api.controlled-contract', 'coverage.tests'],
  indeterminate: ['api.declared-capabilities', 'coverage.tests'],
  disabled: ['api.declared-capabilities', 'coverage.tests'],
  required: ['api.declared-capabilities', 'coverage.tests'],
  invalid: ['api.declared-capabilities', 'coverage.tests'],
  loading: ['api.declared-capabilities', 'coverage.tests'],
  keyboard: ['platform.interaction'],
  'focus-management': ['platform.focus-management'],
  'compound-api': ['api.declared-capabilities', 'coverage.tests'],
  multiple: ['api.declared-capabilities', 'coverage.tests'],
  collapsible: ['api.declared-capabilities', 'coverage.tests'],
  portal: ['platform.overlay-presentation'],
  responsive: ['api.declared-capabilities', 'coverage.tests'],
};

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function completenessSignals(
  checks: readonly ComponentCheckResult[],
  names: readonly ComponentCheckResult['name'][]
): GateSignal[] {
  return checks
    .filter((check) => names.includes(check.name))
    .map((check) => ({
      applicable: true,
      ok: check.ok,
      code: `completeness.${check.name}`,
      message:
        check.details ??
        `${check.name} completeness ${check.ok ? 'passed' : 'failed'}.`,
      ...(check.platform ? { platform: check.platform } : {}),
      ...(check.details ? { evidence: [check.details] } : {}),
    }));
}

function qualitySignal(
  finding: ComponentQualityFinding,
  warnings: ComponentStabilityWarning[]
): GateSignal {
  if (finding.status === 'not-applicable') {
    const hasReason = Boolean(finding.message?.trim());

    return {
      applicable: false,
      ok: hasReason,
      code: hasReason
        ? `${finding.ruleId}.not-applicable`
        : `${finding.ruleId}.unexplained-not-applicable`,
      message:
        finding.message ??
        `${finding.ruleId} returned not-applicable without a deterministic reason.`,
      ...(finding.platform ? { platform: finding.platform } : {}),
      ...(finding.evidence ? { evidence: finding.evidence } : {}),
    };
  }

  if (finding.status === 'warn') {
    const policy =
      stableWarningPolicies[
        finding.ruleId as keyof typeof stableWarningPolicies
      ];

    if (!policy) {
      return {
        applicable: true,
        ok: false,
        code: `${finding.ruleId}.unclassified-warning`,
        message: `${finding.ruleId} is an unresolved warning with no explicit Stable policy.`,
        ...(finding.platform ? { platform: finding.platform } : {}),
        ...(finding.evidence ? { evidence: finding.evidence } : {}),
      };
    }

    if (!policy.blocking) {
      warnings.push({
        ruleId: finding.ruleId,
        policy: 'non-blocking-recommendation',
        reason: policy.reason,
        ...(finding.platform ? { platform: finding.platform } : {}),
        ...(finding.evidence ? { evidence: finding.evidence } : {}),
      });
    }

    return {
      applicable: true,
      ok: !policy.blocking,
      code: `${finding.ruleId}.${policy.blocking ? 'production-warning' : 'recommendation'}`,
      message: `${finding.message ?? finding.ruleId} ${policy.reason}`,
      ...(finding.platform ? { platform: finding.platform } : {}),
      ...(finding.evidence ? { evidence: finding.evidence } : {}),
    };
  }

  return {
    applicable: true,
    ok: finding.status === 'pass',
    code: finding.ruleId,
    message:
      finding.message ??
      `${finding.ruleId} ${finding.status === 'pass' ? 'passed' : 'failed'}.`,
    ...(finding.platform ? { platform: finding.platform } : {}),
    ...(finding.evidence ? { evidence: finding.evidence } : {}),
  };
}

function qualitySignals(
  findings: readonly ComponentQualityFinding[],
  dimensions: readonly ComponentQualityFinding['dimension'][],
  warnings: ComponentStabilityWarning[]
) {
  return findings
    .filter((finding) => dimensions.includes(finding.dimension))
    .map((finding) => qualitySignal(finding, warnings));
}

function surfaceSignals(
  surfaces: readonly ComponentReviewBundleSurface[],
  ids: readonly string[]
): GateSignal[] {
  return surfaces
    .filter((surface) => ids.includes(surface.id) && surface.required)
    .map((surface) => ({
      applicable: true,
      ok: surface.status === 'ready',
      code: `review-surface.${surface.id}`,
      message:
        surface.status === 'ready'
          ? `${surface.label} is ready.`
          : `${surface.label} is missing required evidence.`,
      ...(surface.platform ? { platform: surface.platform } : {}),
      evidence:
        surface.status === 'ready'
          ? surface.artifacts
          : surface.missingArtifacts,
    }));
}

function makeGate(
  id: ComponentStabilityGateId,
  signals: readonly GateSignal[],
  notApplicableReason?: string
): ComponentStabilityGateResult {
  const blockers: ComponentStabilityBlocker[] = signals
    .filter((signal) => !signal.ok)
    .map((signal) => ({
      gateId: id,
      code: signal.code,
      message: signal.message,
      ...(signal.platform ? { platform: signal.platform } : {}),
      ...(signal.evidence ? { evidence: signal.evidence } : {}),
    }));
  const applicable = signals.filter((signal) => signal.applicable);
  const evidence = unique(
    signals.flatMap((signal) => signal.evidence ?? [signal.code])
  );

  if (blockers.length > 0) {
    return { id, status: 'fail', evidence, blockers };
  }

  if (applicable.length === 0) {
    const derivedReason = unique(
      signals
        .filter((signal) => signal.ok && !signal.applicable)
        .map((signal) => signal.message)
    ).join(' ');
    const reason = notApplicableReason ?? derivedReason;

    if (reason) {
      return {
        id,
        status: 'not-applicable',
        evidence,
        reason,
        blockers: [],
      };
    }

    const blocker: ComponentStabilityBlocker = {
      gateId: id,
      code: 'missing-gate-evidence',
      message: `${id} has no applicable evidence and no deterministic not-applicable reason.`,
    };

    return { id, status: 'fail', evidence, blockers: [blocker] };
  }

  return { id, status: 'pass', evidence, blockers: [] };
}

function capabilityResults(
  metadata: ComponentMetadata,
  findings: readonly ComponentQualityFinding[]
) {
  return metadata.platforms.flatMap((platform) =>
    (metadata.capabilities ?? []).map((capability) => {
      const ruleIds = capabilityRuleIds[capability];
      const matching = findings.filter(
        (finding) =>
          finding.platform === platform && ruleIds.includes(finding.ruleId)
      );
      const missingRuleIds = ruleIds.filter(
        (ruleId) => !matching.some((finding) => finding.ruleId === ruleId)
      );
      const failed = matching.filter((finding) => finding.status !== 'pass');
      const status =
        missingRuleIds.length === 0 && failed.length === 0 ? 'pass' : 'fail';
      const reason =
        status === 'fail'
          ? [
              missingRuleIds.length
                ? `Missing quality evidence from: ${missingRuleIds.join(', ')}.`
                : null,
              ...failed.map(
                (finding) =>
                  finding.message ??
                  `${finding.ruleId} returned ${finding.status}.`
              ),
            ]
              .filter(Boolean)
              .join(' ')
          : undefined;

      return {
        capability,
        platform,
        status,
        ruleIds,
        evidence: unique(
          matching.flatMap((finding) => [
            finding.ruleId,
            ...(finding.evidence ?? []),
          ])
        ),
        ...(reason ? { reason } : {}),
      } as const;
    })
  );
}

export function evaluateComponentStability(
  evidence: StabilityEvidence
): ComponentStabilityReportV1 {
  const { metadata, completeness, quality, reviewSurfaces } = evidence;
  const warnings: ComponentStabilityWarning[] = [];
  const qualityByDimension = (
    dimensions: readonly ComponentQualityFinding['dimension'][]
  ) => qualitySignals(quality.findings, dimensions, warnings);
  const checks = completeness.checks;
  const capabilities = capabilityResults(metadata, quality.findings);
  const capabilitySignals: GateSignal[] = capabilities.map((result) => ({
    applicable: true,
    ok: result.status === 'pass',
    code: `capability.${result.capability}`,
    message:
      result.reason ??
      `${result.capability} has deterministic evidence on ${result.platform}.`,
    platform: result.platform,
    evidence: result.evidence,
  }));
  const hasInteractionCapability = (metadata.capabilities ?? []).some(
    (capability) =>
      capability === 'keyboard' ||
      capability === 'focus-management' ||
      capability === 'portal'
  );

  const gates: ComponentStabilityGateResult[] = [
    makeGate(
      'implementation-completeness',
      completenessSignals(checks, [
        'metadata',
        'production-authorities',
        'implementation',
      ])
    ),
    makeGate('public-api', [
      ...qualityByDimension(['public-api']),
      ...completenessSignals(checks, ['types']),
    ]),
    makeGate('type-quality', completenessSignals(checks, ['type-ownership'])),
    makeGate(
      'declared-capabilities',
      [...qualityByDimension(['behavior']), ...capabilitySignals],
      'The component declares no capabilities.'
    ),
    makeGate(
      'accessibility',
      [
        ...qualityByDimension(['accessibility']),
        ...completenessSignals(checks, ['accessibility']),
      ],
      metadata.requirements.accessibility
        ? undefined
        : 'Canonical metadata does not require accessibility evidence.'
    ),
    makeGate(
      'interaction',
      qualityByDimension(['interaction']),
      hasInteractionCapability
        ? undefined
        : 'No keyboard, focus-management, or portal capability is declared.'
    ),
    makeGate('tests-regression', [
      ...qualityByDimension(['tests']),
      ...completenessSignals(checks, ['tests']),
    ]),
    makeGate(
      'storybook',
      [
        ...qualityByDimension(['storybook']),
        ...completenessSignals(checks, ['storybook']),
        ...surfaceSignals(
          reviewSurfaces,
          metadata.platforms.map(
            (platform) =>
              `storybook-${platform === 'react' ? 'react' : 'react-native'}`
          )
        ),
      ],
      metadata.requirements.storybook
        ? undefined
        : 'Canonical metadata does not require Storybook evidence.'
    ),
    makeGate('public-website-docs', [
      ...qualityByDimension(['documentation']),
      ...completenessSignals(checks, ['website', 'api-docs', 'component-docs']),
      ...surfaceSignals(reviewSurfaces, [
        'website-component-page',
        'catalog-registration',
        ...metadata.platforms.map(
          (platform) =>
            `docs-${platform === 'react' ? 'react' : 'react-native'}`
        ),
      ]),
    ]),
    makeGate(
      'catalog-signature-preview',
      surfaceSignals(reviewSurfaces, ['catalog-signature-preview'])
    ),
    makeGate('tokens-theming', [
      ...qualityByDimension(['tokens-theming']),
      ...completenessSignals(checks, ['component-tokens', 'tokens']),
    ]),
    makeGate(
      'design-resource-compliance',
      qualityByDimension(['design-system'])
    ),
    makeGate('exports-package', [
      ...qualityByDimension(['exports-package']),
      ...completenessSignals(checks, ['exports']),
    ]),
    makeGate('declared-platforms', [
      ...checks
        .filter((check) => check.platform !== undefined)
        .map((check) => ({
          applicable: true,
          ok: check.ok,
          code: `platform.${check.platform}.${check.name}`,
          message:
            check.details ??
            `${check.platform} ${check.name} completeness ${check.ok ? 'passed' : 'failed'}.`,
          platform: check.platform,
          ...(check.details ? { evidence: [check.details] } : {}),
        })),
      ...quality.findings.map((finding) => qualitySignal(finding, warnings)),
    ]),
    makeGate('human-approval', [
      {
        applicable: true,
        ok: evidence.approval !== null && !evidence.approvalError,
        code: evidence.approvalError
          ? 'human-approval.invalid'
          : evidence.approval
            ? 'human-approval.approved'
            : 'human-approval.missing',
        message:
          evidence.approvalError ??
          (evidence.approval
            ? `Approved by ${evidence.approval.approvedBy} from ${evidence.approval.source.url}.`
            : 'No explicit human Stable approval record exists.'),
        ...(evidence.approval
          ? {
              evidence: [
                evidence.approval.source.url,
                evidence.approval.source.revision,
              ],
            }
          : {}),
      },
    ]),
  ];

  if (
    gates.map((gate) => gate.id).join('|') !==
    componentStabilityGateIds.join('|')
  ) {
    throw new Error('Stable gate registry drifted from its metadata contract.');
  }

  const blockers = gates.flatMap((gate) => gate.blockers);

  return {
    schemaVersion: '1',
    component: metadata.name,
    lifecycle: metadata.status,
    status: blockers.length === 0 ? 'STABLE_ELIGIBLE' : 'NOT_STABLE_ELIGIBLE',
    gates,
    capabilities,
    blockers,
    warnings: warnings.filter(
      (warning, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.ruleId === warning.ruleId &&
            candidate.platform === warning.platform
        ) === index
    ),
    approval: evidence.approval,
  };
}

function metadataToProductionInput(
  metadata: ComponentMetadata
): ComponentProductionInputV1 {
  const web = metadata.platforms.includes('react');
  const native = metadata.platforms.includes('react-native');

  return {
    schemaVersion: '1',
    componentName: metadata.name,
    platform: web && native ? 'both' : web ? 'web' : 'native',
    layer: metadata.layer,
    category: metadata.category,
    profile: metadata.profile,
    capabilities: metadata.capabilities ?? [],
    dependencies: metadata.dependencies,
    icons: metadata.requirements.icons ?? [],
    tokens: metadata.requirements.tokens ?? [],
    assets: metadata.requirements.assets ?? [],
    componentTokens: metadata.requirements.componentTokens ?? false,
    parts: [],
  };
}

function validateApproval(
  input: unknown,
  componentName: string
): { approval: ComponentStabilityApprovalRecordV1 | null; error?: string } {
  const approval = input as Partial<ComponentStabilityApprovalRecordV1>;
  const source = approval?.source;
  const valid =
    approval?.schemaVersion === '1' &&
    approval.component === componentName &&
    approval.decision === 'approved' &&
    approval.question === STABLE_APPROVAL_QUESTION &&
    approval.answer === 'yes' &&
    typeof approval.approvedBy === 'string' &&
    approval.approvedBy.trim().length > 0 &&
    typeof approval.approvedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(approval.approvedAt) &&
    source?.kind === 'github-pull-request' &&
    typeof source.number === 'number' &&
    Number.isInteger(source.number) &&
    source.number > 0 &&
    typeof source.url === 'string' &&
    source.url.endsWith(`/pull/${source.number}`) &&
    typeof source.revision === 'string' &&
    /^[0-9a-f]{40}$/i.test(source.revision) &&
    Array.isArray(approval.scope) &&
    approval.scope.length > 0 &&
    approval.scope.every(
      (item) => typeof item === 'string' && item.trim().length > 0
    );

  return valid
    ? { approval: input as ComponentStabilityApprovalRecordV1 }
    : {
        approval: null,
        error: `Human approval record for ${componentName} is malformed or does not answer the canonical release question.`,
      };
}

export function loadComponentStabilityApproval(
  rootDir: string,
  componentName: string
) {
  const approvalFile = path.join(
    rootDir,
    'scripts',
    'checks',
    'component-stability',
    'approvals',
    `${componentName}.json`
  );

  if (!fs.existsSync(approvalFile)) {
    return { approval: null };
  }

  try {
    return validateApproval(
      JSON.parse(fs.readFileSync(approvalFile, 'utf8')),
      componentName
    );
  } catch {
    return {
      approval: null,
      error: `Human approval record for ${componentName} is not valid JSON.`,
    };
  }
}

export async function runComponentStabilityCheck(params: {
  componentName: string;
  rootDir?: string;
  metadataRegistry?: readonly unknown[];
}): Promise<ComponentStabilityReportV1> {
  const rootDir = path.resolve(params.rootDir ?? process.cwd());
  const registry = params.metadataRegistry ?? componentMetadata;
  const candidates = registry.map((input) => {
    const validation = validateComponentMetadata(input);
    if (!validation.valid) {
      throw new Error(
        `Invalid component metadata: ${validation.errors.join('; ')}`
      );
    }
    return validation.value;
  });
  const metadata = candidates.find(
    (candidate) =>
      candidate.name.toLowerCase() === params.componentName.toLowerCase()
  );

  if (!metadata) {
    throw new Error(`Unknown component "${params.componentName}".`);
  }

  const completenessResults = await runComponentCompletenessCheck({
    root: rootDir,
    metadata: [metadata],
    generatedDocsScope: 'targeted',
  });
  const completeness = completenessResults.find(
    (result) => result.componentName === metadata.name
  );
  if (!completeness) {
    throw new Error(`Missing completeness result for ${metadata.name}.`);
  }

  const qualityRun = await runComponentQualityCheck({
    componentName: metadata.name,
    metadataRegistry: [metadata],
    rootDir,
    rules: componentQualityRules,
  });
  const quality = qualityRun.report.components[0];
  if (!quality) {
    throw new Error(`Missing Component Quality result for ${metadata.name}.`);
  }

  const reviewSurfaces = evaluateComponentReviewSurfaces({
    root: rootDir,
    input: metadataToProductionInput(metadata),
  });
  const approval = loadComponentStabilityApproval(rootDir, metadata.name);

  return evaluateComponentStability({
    metadata,
    completeness,
    quality,
    reviewSurfaces,
    ...approval,
  });
}

export type ComponentLifecycleTransitionResult =
  { valid: true } | { valid: false; error: string };

export function validateComponentLifecycleTransition(params: {
  component: string;
  previous: ComponentLifecycle | null;
  next: ComponentLifecycle;
  stability?: ComponentStabilityReportV1;
}): ComponentLifecycleTransitionResult {
  const { component, previous, next, stability } = params;

  if (previous === next) return { valid: true };
  if (next === 'deprecated') return { valid: true };
  if (previous === null && next === 'experimental') return { valid: true };
  if (previous === 'experimental' && next === 'beta') return { valid: true };

  if (next === 'stable') {
    return stability?.component === component &&
      stability.status === 'STABLE_ELIGIBLE'
      ? { valid: true }
      : {
          valid: false,
          error: `${component} cannot transition from ${previous ?? 'unregistered'} to stable without a STABLE_ELIGIBLE report.`,
        };
  }

  return {
    valid: false,
    error: `Unsupported component lifecycle transition for ${component}: ${previous ?? 'unregistered'} -> ${next}.`,
  };
}
