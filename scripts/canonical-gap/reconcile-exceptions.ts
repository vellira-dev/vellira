import type {
  AppliedVelliraUiUsageException,
  VelliraUiUsageReport,
} from '../checks/vellira-ui-usage/types';
import {
  CANONICAL_GAP_SCHEMA_VERSION,
  CanonicalGapError,
  extractCanonicalGapRequestAuthority,
  type CanonicalGapIssueClient,
  type CanonicalGapManagedIssue,
} from './types';

export type CanonicalGapExceptionReconcileResult = {
  schemaVersion: '1';
  mode: 'plan' | 'apply';
  status: 'ok' | 'no-work';
  sourceSha: string | null;
  scannedFiles: number;
  inspectedOpenIssues: number;
  appliedExceptions: number;
  results: readonly {
    requestId: string;
    issueNumber: number;
    issueUrl: string;
    action: 'planned-close' | 'closed';
    exception: {
      path: string;
      line: number;
      detected: string;
      reviewedBy: string;
    };
  }[];
};

type ExceptionMatch = {
  issue: CanonicalGapManagedIssue;
  exception: AppliedVelliraUiUsageException;
};

const TOKEN_VALUE_RULE = 'vellira-ui.noncanonical-token-value';
const COMMIT_SHA = /^[0-9a-f]{40}$/;

export async function reconcileCanonicalGapUiExceptions(
  report: VelliraUiUsageReport,
  client: CanonicalGapIssueClient,
  options: { apply: boolean; sourceSha?: string }
): Promise<CanonicalGapExceptionReconcileResult> {
  assertCompleteUiReport(report);
  if (
    options.apply &&
    (!client.closeManagedIssue || !COMMIT_SHA.test(options.sourceSha ?? ''))
  ) {
    throw new CanonicalGapError(
      'Exception reconciliation apply requires authenticated issue closure and an exact source SHA.'
    );
  }

  const managed = await client.listManagedIssues();
  const activeColors = new Set(
    report.findings
      .filter(({ ruleId }) => ruleId === TOKEN_VALUE_RULE)
      .map(({ detected }) => detected.toLowerCase())
  );
  const matches: ExceptionMatch[] = [];

  for (const issue of managed) {
    if (
      issue.state !== 'open' ||
      !issue.labels.includes('canonical-gap') ||
      !issue.labels.includes('canonical-gap:ready') ||
      !issue.labels.includes('design-resource-gap') ||
      issue.labels.includes('launch-blocker') ||
      issue.labels.includes('launch-critical-path')
    ) {
      continue;
    }

    // The editable issue title and marker are not sufficient authority.
    // A legacy marker-only issue is deliberately left for human review.
    const authority = extractCanonicalGapRequestAuthority(issue.body);
    if (
      !authority ||
      authority.requestId !== issue.requestId ||
      authority.kind !== 'token' ||
      authority.launchCritical ||
      authority.source?.ruleId !== TOKEN_VALUE_RULE ||
      authority.consumer !== authority.source.path ||
      authority.canonicalTarget !== authority.source.detected ||
      activeColors.has(authority.canonicalTarget.toLowerCase())
    ) {
      continue;
    }

    const exception = report.exceptions.find(
      (value) =>
        value.category === 'architectural-exception' &&
        value.ruleId === authority.source?.ruleId &&
        value.path === authority.source.path &&
        value.line === authority.source.line &&
        value.column === authority.source.column &&
        value.detected === authority.source.detected
    );
    if (exception) matches.push({ issue, exception });
  }

  matches.sort((a, b) => a.issue.number - b.issue.number);
  const results: CanonicalGapExceptionReconcileResult['results'][number][] = [];
  for (const { issue, exception } of matches) {
    if (options.apply) {
      const note = [
        '## Canonical gap resolution — approved UI exception',
        '',
        'This exact UI finding is covered by a reviewed architectural exception',
        'in the current canonical UI usage checker.',
        '',
        '- Source SHA: ' + options.sourceSha,
        '- Finding: ' +
          exception.ruleId +
          ' in ' +
          exception.path +
          ':' +
          exception.line +
          ':' +
          exception.column +
          ' (' +
          exception.detected +
          ')',
        '- Reviewed exception: ' + exception.issue,
        '- The full current UI scan contains no unresolved finding for this token value.',
        '',
        'The issue is superseded by this reviewed exception, NOT by the creation',
        'of a semantic token. Closing as not planned. No user-authored or',
        'launch-critical work is eligible for this reconciliation.',
      ].join('\n');
      await client.closeManagedIssue!(issue, note);
    }

    results.push({
      requestId: issue.requestId,
      issueNumber: issue.number,
      issueUrl: issue.url,
      action: options.apply ? 'closed' : 'planned-close',
      exception: {
        path: exception.path,
        line: exception.line,
        detected: exception.detected,
        reviewedBy: exception.issue,
      },
    });
  }

  return {
    schemaVersion: CANONICAL_GAP_SCHEMA_VERSION,
    mode: options.apply ? 'apply' : 'plan',
    status: results.length > 0 ? 'ok' : 'no-work',
    sourceSha: options.sourceSha ?? null,
    scannedFiles: report.summary.filesScanned,
    inspectedOpenIssues: managed.filter(({ state }) => state === 'open').length,
    appliedExceptions: report.exceptions.length,
    results,
  };
}

function assertCompleteUiReport(report: VelliraUiUsageReport): void {
  if (
    report.schemaVersion !== CANONICAL_GAP_SCHEMA_VERSION ||
    report.mode !== 'audit' ||
    !Array.isArray(report.findings) ||
    !Array.isArray(report.exceptions) ||
    report.summary.filesScanned < 1 ||
    report.summary.findings !== report.findings.length ||
    report.summary.exceptionsApplied !== report.exceptions.length
  ) {
    throw new CanonicalGapError(
      'Exception reconciliation requires one complete canonical UI audit report.'
    );
  }
}
