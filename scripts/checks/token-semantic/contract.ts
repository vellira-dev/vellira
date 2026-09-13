import { createHash } from 'node:crypto';

export const tokenSemanticRuleIds = [
  'tokens.value-kind',
  'tokens.state-vocabulary',
  'tokens.semantic-vocabulary',
  'tokens.platform-boundary',
  'tokens.shadow-authority',
  'tokens.component-ownership',
  'tokens.namespace-lifecycle',
  'tokens.factory-convention',
  'tokens.semantic-dependency',
  'tokens.public-api',
  'tokens.visual-preservation',
  'tokens.consumer-reference',
] as const;

export type TokenSemanticRuleId = (typeof tokenSemanticRuleIds)[number];
export type AuditCoverage = 'complete' | 'partial' | 'not-run' | 'error';
export type AuditSeverity = 'error' | 'warning';

export interface TokenSemanticFinding {
  id: string;
  ruleId: TokenSemanticRuleId;
  code: string;
  severity: AuditSeverity;
  sourcePath: string;
  tokenPath: string | null;
  line: number | null;
  column: number | null;
  layer: string;
  theme: string | null;
  platform: string | null;
  evidence: string;
  expected: string | null;
  migrationStatus: string;
  suggestedAction: string;
}

export type FindingInput = Omit<TokenSemanticFinding, 'id'>;

export interface RuleResult {
  coverage: 'complete' | 'partial';
  scope: string;
  checked: number;
  findings: FindingInput[];
}

export interface RuleAdapter {
  ruleId: TokenSemanticRuleId;
  run: () => RuleResult;
}

export interface RuleCoverage {
  ruleId: TokenSemanticRuleId;
  coverage: AuditCoverage;
  scope: string;
  checked: number;
}

export interface TokenSemanticReport {
  schemaVersion: 1;
  status: 'pass' | 'fail' | 'incomplete' | 'error';
  coverage: RuleCoverage[];
  findings: TokenSemanticFinding[];
  summary: {
    requiredRules: number;
    completeRules: number;
    incompleteRules: number;
    runtimeErrors: number;
    errors: number;
    warnings: number;
  };
}

export function createFinding(input: FindingInput): TokenSemanticFinding {
  const identity = JSON.stringify([
    input.ruleId,
    input.code,
    input.sourcePath,
    input.tokenPath,
    input.line,
    input.column,
    input.theme,
    input.platform,
    input.evidence,
  ]);
  const id = createHash('sha256').update(identity).digest('hex').slice(0, 24);
  return { id, ...input };
}

export function runTokenSemanticAudit(
  adapters: readonly RuleAdapter[]
): TokenSemanticReport {
  const byId = new Map<TokenSemanticRuleId, RuleAdapter>();
  for (const adapter of adapters) {
    if (!tokenSemanticRuleIds.includes(adapter.ruleId)) {
      throw new Error(`Unknown token semantic rule: ${adapter.ruleId}`);
    }
    if (byId.has(adapter.ruleId)) {
      throw new Error(`Duplicate token semantic rule: ${adapter.ruleId}`);
    }
    byId.set(adapter.ruleId, adapter);
  }

  const findings: TokenSemanticFinding[] = [];
  const coverage: RuleCoverage[] = tokenSemanticRuleIds.map((ruleId) => {
    const adapter = byId.get(ruleId);
    if (!adapter) {
      return {
        ruleId,
        coverage: 'not-run',
        scope: 'No adapter is connected; this is not a successful check.',
        checked: 0,
      };
    }
    try {
      const result = adapter.run();
      if (
        !['complete', 'partial'].includes(result.coverage) ||
        !result.scope.trim() ||
        !Number.isInteger(result.checked) ||
        result.checked < 0 ||
        (result.coverage === 'complete' && result.checked === 0) ||
        result.findings.some((finding) => finding.ruleId !== ruleId)
      ) {
        throw new Error(`Invalid result for ${ruleId}`);
      }
      findings.push(...result.findings.map(createFinding));
      return {
        ruleId,
        coverage: result.coverage,
        scope: result.scope,
        checked: result.checked,
      };
    } catch (error) {
      const evidence = error instanceof Error ? error.message : String(error);
      findings.push(
        createFinding({
          ruleId,
          code: 'rule-execution-error',
          severity: 'error',
          sourcePath: 'scripts/checks/token-semantic',
          tokenPath: null,
          line: null,
          column: null,
          layer: 'consumer',
          theme: null,
          platform: null,
          evidence,
          expected: 'A complete, readable canonical authority.',
          migrationStatus: 'not-applicable',
          suggestedAction:
            'Repair the rule or its authority; do not suppress it.',
        })
      );
      return { ruleId, coverage: 'error', scope: evidence, checked: 0 };
    }
  });

  findings.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const summary = {
    requiredRules: tokenSemanticRuleIds.length,
    completeRules: coverage.filter((rule) => rule.coverage === 'complete')
      .length,
    incompleteRules: coverage.filter(
      (rule) => rule.coverage === 'partial' || rule.coverage === 'not-run'
    ).length,
    runtimeErrors: coverage.filter((rule) => rule.coverage === 'error').length,
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning')
      .length,
  };
  const status = summary.runtimeErrors
    ? 'error'
    : summary.errors
      ? 'fail'
      : summary.incompleteRules
        ? 'incomplete'
        : 'pass';
  return { schemaVersion: 1, status, coverage, findings, summary };
}

export function tokenSemanticExitCode(
  report: TokenSemanticReport,
  reportOnly: boolean
): number {
  if (report.summary.runtimeErrors > 0) return 2;
  if (reportOnly) return 0;
  return report.status === 'pass' ? 0 : 1;
}

export function formatTokenSemanticReport(report: TokenSemanticReport): string {
  const { summary } = report;
  return [
    `Token semantic audit: ${report.status.toUpperCase()}`,
    `Coverage: ${summary.completeRules}/${summary.requiredRules} complete; ${summary.incompleteRules} incomplete; ${summary.runtimeErrors} execution errors.`,
    `Findings: ${summary.errors} errors, ${summary.warnings} warnings.`,
    ...report.coverage.map(
      (rule) => `  [${rule.coverage}] ${rule.ruleId}: ${rule.scope}`
    ),
    ...report.findings.map(
      (finding) =>
        `  [${finding.severity}] ${finding.ruleId}/${finding.code} ${finding.sourcePath}:${finding.line ?? 0}: ${finding.evidence}`
    ),
  ].join('\n');
}
