import type { ComponentTokenContract } from '@vellira-ui/metadata';

import type { TokenSemanticReport } from '../../checks/token-semantic/contract';

export type ComponentGeneratorTokenSemanticGateInput = {
  componentTokens: ComponentTokenContract | false;
  requestedTokens?: readonly string[];
};

type TokenSemanticAuditRunner = (
  root: string
) => TokenSemanticReport | Promise<TokenSemanticReport>;

export function componentGeneratorCheckRequiresTokenSemanticGate(
  input: ComponentGeneratorTokenSemanticGateInput
): boolean {
  return input.componentTokens !== false || (input.requestedTokens?.length ?? 0) > 0;
}

export async function assertComponentGeneratorTokenSemanticReadiness(
  root: string,
  audit?: TokenSemanticAuditRunner
): Promise<void> {
  const runAudit =
    audit ??
    (await import('../../checks/token-semantic/checker')).checkTokenSemantics;
  const report = await runAudit(root);

  if (report.status === 'pass') return;

  const summary = report.summary;
  const findingIds = report.findings.slice(0, 5).map((finding) => finding.id);
  const findingSuffix =
    findingIds.length > 0 ? ` Findings: ${findingIds.join(', ')}.` : '';

  throw new Error(
    `Component generator token semantic validation failed with status ${report.status}: ${summary.completeRules}/${summary.requiredRules} rules complete, ${summary.errors} errors, ${summary.warnings} warnings, ${summary.runtimeErrors} runtime errors.${findingSuffix}`
  );
}
