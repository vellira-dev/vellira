export type VelliraUiUsageRuleId =
  | 'vellira-ui.existing-component-bypass'
  | 'vellira-ui.local-component-duplicate'
  | 'vellira-ui.third-party-bypass'
  | 'vellira-ui.missing-component'
  | 'vellira-ui.noncanonical-icon'
  | 'vellira-ui.noncanonical-token-value'
  | 'vellira-ui.missing-token-resource';

export type VelliraUiUsageNextAction =
  | 'reuse-existing'
  | 'request-missing-component'
  | 'request-missing-resource'
  | 'architectural-exception';

export type VelliraUiUsageSeverity = 'info' | 'warning' | 'error';

export type VelliraUiUsageExceptionCategory =
  'framework-infrastructure' | 'generated-vendor' | 'architectural-exception';

export interface VelliraUiUsageFinding {
  ruleId: VelliraUiUsageRuleId;
  path: string;
  line: number;
  column: number;
  detected: string;
  canonicalAlternative?: string;
  severity: VelliraUiUsageSeverity;
  blocking: boolean;
  nextAction: VelliraUiUsageNextAction;
  message: string;
}

export interface VelliraUiUsageException {
  ruleId: VelliraUiUsageRuleId;
  path: string;
  line: number;
  detected: string;
  category: VelliraUiUsageExceptionCategory;
  reason: string;
  issue: `#${number}`;
}

export interface AppliedVelliraUiUsageException extends VelliraUiUsageException {
  column: number;
}

export interface VelliraUiUsageSummary {
  filesScanned: number;
  findings: number;
  blockingFindings: number;
  exceptionsApplied: number;
}

export interface VelliraUiUsageReport {
  schemaVersion: '1';
  mode: 'audit';
  findings: VelliraUiUsageFinding[];
  exceptions: AppliedVelliraUiUsageException[];
  summary: VelliraUiUsageSummary;
}
