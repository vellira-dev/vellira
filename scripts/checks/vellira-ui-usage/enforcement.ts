import type { VelliraUiUsageReport } from './types';

export function toBlockingVelliraUiUsageReport(
  report: VelliraUiUsageReport
): VelliraUiUsageReport {
  const findings = report.findings.map((finding) => ({
    ...finding,
    severity: 'error' as const,
    blocking: true as const,
  }));

  return {
    ...report,
    mode: 'blocking',
    findings,
    summary: {
      ...report.summary,
      blockingFindings: findings.length,
    },
  };
}
