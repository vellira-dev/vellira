import type {
  ComponentCapability,
  ComponentLifecycle,
  ComponentPlatform,
} from './component';

export const componentStabilityGateIds = [
  'implementation-completeness',
  'public-api',
  'type-quality',
  'declared-capabilities',
  'accessibility',
  'interaction',
  'tests-regression',
  'storybook',
  'public-website-docs',
  'catalog-signature-preview',
  'tokens-theming',
  'design-resource-compliance',
  'exports-package',
  'declared-platforms',
  'human-approval',
] as const;

export type ComponentStabilityGateId =
  (typeof componentStabilityGateIds)[number];
export type ComponentStabilityGateStatus = 'pass' | 'fail' | 'not-applicable';
export type ComponentStabilityStatus =
  'STABLE_ELIGIBLE' | 'NOT_STABLE_ELIGIBLE';

export interface ComponentStabilityBlocker {
  gateId: ComponentStabilityGateId;
  code: string;
  message: string;
  platform?: ComponentPlatform;
  evidence?: readonly string[];
}

export interface ComponentStabilityGateResult {
  id: ComponentStabilityGateId;
  status: ComponentStabilityGateStatus;
  evidence: readonly string[];
  reason?: string;
  blockers: readonly ComponentStabilityBlocker[];
}

export interface ComponentCapabilityStabilityResult {
  capability: ComponentCapability;
  platform: ComponentPlatform;
  status: ComponentStabilityGateStatus;
  ruleIds: readonly string[];
  evidence: readonly string[];
  reason?: string;
}

export interface ComponentStabilityWarning {
  ruleId: string;
  policy: 'non-blocking-recommendation';
  reason: string;
  platform?: ComponentPlatform;
  evidence?: readonly string[];
}

export interface ComponentStabilityApprovalRecordV1 {
  schemaVersion: '1';
  component: string;
  decision: 'approved';
  question: string;
  answer: 'yes';
  approvedBy: string;
  approvedAt: string;
  source: {
    kind: 'github-pull-request';
    url: string;
    number: number;
    revision: string;
  };
  scope: readonly string[];
}

export interface ComponentStabilityReportV1 {
  schemaVersion: '1';
  component: string;
  lifecycle: ComponentLifecycle;
  status: ComponentStabilityStatus;
  gates: readonly ComponentStabilityGateResult[];
  capabilities: readonly ComponentCapabilityStabilityResult[];
  blockers: readonly ComponentStabilityBlocker[];
  warnings: readonly ComponentStabilityWarning[];
  approval: ComponentStabilityApprovalRecordV1 | null;
}
