import { tokenSemanticRuleIds } from '../checks/token-semantic/contract';
import type { ComponentProductionFinding } from './contracts';
import type {
  ValidationCommandDescriptor,
  ValidationCommandExecution,
} from './validation-command';
import { findingSourcePaths, qualityFindingSourcePaths } from './finding-path';

/** Structured diagnostics are negative evidence, never command-success substitutes. */
export function structuredCommandFindings(
  command: ValidationCommandDescriptor,
  execution: ValidationCommandExecution
): ComponentProductionFinding[] | null {
  if (!command.resultFormat) return null;
  if (execution.exitCode !== 1)
    throw new Error('Canonical diagnostic did not exit with a finding status.');
  const text = stripVTControlCharacters(execution.stdout).trim();
  // Canonical JSON commands use pnpm --silent. Legacy command banners may
  // precede the value, but trailing output and partial reports stay infrastructure.
  const start = text.indexOf('{');
  if (
    start < 0 ||
    text
      .slice(0, start)
      .split('\n')
      .some((line) => line.trim() && !line.startsWith('> '))
  )
    throw new Error('Unexpected output before canonical JSON.');
  if (
    stripVTControlCharacters(execution.stderr)
      .split('\n')
      .some((line) => {
        const value = line.trim();
        return (
          value &&
          !/^\$ (?:node|tsx) /.test(value) &&
          !/^(?:\[)?ELIFECYCLE(?:\])?\s+Command failed with exit code 1\.$/.test(
            value
          )
        );
      })
  )
    throw new Error('Unexpected stderr alongside canonical JSON.');
  const report = JSON.parse(text.slice(start));
  const findings: ComponentProductionFinding[] = [];
  if (command.resultFormat === 'token-semantic') {
    if (
      report.schemaVersion !== 1 ||
      !Array.isArray(report.findings) ||
      !Array.isArray(report.coverage) ||
      !['pass', 'fail', 'incomplete', 'error'].includes(report.status)
    )
      throw new Error('Malformed token-semantic report.');
    for (const finding of report.findings) {
      if (
        !finding ||
        !['error', 'warning'].includes(finding.severity) ||
        typeof finding.sourcePath !== 'string' ||
        typeof finding.evidence !== 'string' ||
        !tokenSemanticRuleIds.includes(finding.ruleId) ||
        typeof finding.code !== 'string' ||
        typeof finding.id !== 'string'
      )
        throw new Error('Malformed token finding.');
      if (finding.severity !== 'error') continue;
      const paths = findingSourcePaths([finding.sourcePath]);
      findings.push({
        id: `${command.stage}:${command.id}:${finding.id}`,
        stage: command.stage,
        severity: 'blocking',
        message: `${finding.code}: ${finding.evidence}`,
        ruleId: finding.ruleId,
        ...(paths.length === 1 ? { path: paths[0] } : {}),
      });
    }
    if (
      report.status !== 'fail' ||
      report.coverage.length !== tokenSemanticRuleIds.length ||
      new Set(report.coverage.map((r: { ruleId: string }) => r?.ruleId))
        .size !== tokenSemanticRuleIds.length ||
      report.coverage.some(
        (r: {
          coverage: string;
          ruleId: (typeof tokenSemanticRuleIds)[number];
        }) =>
          !r ||
          r.coverage !== 'complete' ||
          !tokenSemanticRuleIds.includes(r.ruleId)
      )
    ) {
      findings.push({
        id: `${command.stage}:${command.id}:incomplete`,
        stage: command.stage,
        severity: 'blocking',
        ruleId: 'validation.harness',
        message: 'Token audit did not complete every canonical rule.',
      });
    }
  } else {
    if (
      report.schemaVersion !== '1' ||
      !Array.isArray(report.components) ||
      report.components.length !== 1 ||
      !report.components[0] ||
      report.components[0].componentName !== command.componentName ||
      report.components[0].status !== 'fail' ||
      !Array.isArray(report.components[0].findings)
    )
      throw new Error('Malformed component-quality report.');
    for (const finding of report.components[0].findings) {
      if (
        !finding ||
        !['pass', 'fail', 'warn', 'not-applicable'].includes(finding.status) ||
        typeof finding.ruleId !== 'string' ||
        (finding.platform !== undefined &&
          !['react', 'react-native'].includes(finding.platform)) ||
        (finding.message !== undefined &&
          typeof finding.message !== 'string') ||
        (finding.evidence !== undefined &&
          (!Array.isArray(finding.evidence) ||
            !finding.evidence.every((e: unknown) => typeof e === 'string')))
      )
        throw new Error('Malformed quality finding.');
      if (finding.status !== 'fail') continue;
      const bounded = qualityFindingSourcePaths(
        finding.ruleId,
        finding.evidence
      );
      for (const source of bounded)
        findings.push({
          id: `${command.stage}:${command.id}:${finding.platform ?? 'shared'}:${finding.ruleId}${source ? ':' + source : ''}`,
          stage: command.stage,
          severity: 'blocking',
          message: finding.message ?? finding.ruleId,
          ruleId: finding.ruleId,
          ...(source ? { path: source } : {}),
          ...(finding.platform ? { platform: finding.platform } : {}),
        });
    }
  }
  if (!findings.length)
    throw new Error('Failed canonical command returned no blocking findings.');
  return findings;
}
import { stripVTControlCharacters } from 'node:util';
