import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { toBlockingVelliraUiUsageReport } from './enforcement';
import type { VelliraUiUsageReport } from './types';

const report = (findings: VelliraUiUsageReport['findings']) =>
  ({
    schemaVersion: '1',
    mode: 'audit',
    findings,
    exceptions: [],
    summary: {
      filesScanned: 1,
      findings: findings.length,
      blockingFindings: 0,
      exceptionsApplied: 0,
    },
  }) satisfies VelliraUiUsageReport;

describe('Vellira UI usage blocking enforcement', () => {
  it('converts every unexcepted finding into an error that blocks CI', () => {
    const auditReport = report([
      {
        ruleId: 'vellira-ui.existing-component-bypass',
        path: 'apps/website/src/example.tsx',
        line: 1,
        column: 1,
        detected: 'button',
        canonicalAlternative: 'Button',
        severity: 'warning',
        blocking: false,
        nextAction: 'reuse-existing',
        message: 'Use canonical Button.',
      },
    ]);

    const blockingReport = toBlockingVelliraUiUsageReport(auditReport);

    expect(blockingReport).toMatchObject({
      schemaVersion: '1',
      mode: 'blocking',
      summary: {
        findings: 1,
        blockingFindings: 1,
        exceptionsApplied: 0,
      },
    });
    expect(blockingReport.findings).toEqual([
      expect.objectContaining({
        ruleId: 'vellira-ui.existing-component-bypass',
        severity: 'error',
        blocking: true,
      }),
    ]);

    expect(auditReport).toMatchObject({
      mode: 'audit',
      summary: { blockingFindings: 0 },
      findings: [
        expect.objectContaining({ severity: 'warning', blocking: false }),
      ],
    });
  });

  it('keeps a clean baseline non-blocking', () => {
    const blockingReport = toBlockingVelliraUiUsageReport(report([]));

    expect(blockingReport).toMatchObject({
      mode: 'blocking',
      findings: [],
      summary: {
        findings: 0,
        blockingFindings: 0,
        exceptionsApplied: 0,
      },
    });
  });

  it('fails the real CLI when an ephemeral raw control is injected', () => {
    const relativeProofPath =
      'apps/website/src/__vellira_ui_usage_negative_proof__.tsx';
    const proofPath = path.join(process.cwd(), relativeProofPath);

    expect(fs.existsSync(proofPath)).toBe(false);
    fs.writeFileSync(
      proofPath,
      'export const VelliraUiUsageNegativeProof = () => <button>Proof</button>;\n'
    );

    try {
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/checks/vellira-ui-usage/cli.ts',
          '--json',
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        }
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);

      const output = JSON.parse(result.stdout) as VelliraUiUsageReport;
      expect(output).toMatchObject({
        mode: 'blocking',
        summary: {
          blockingFindings: 1,
        },
      });
      expect(output.findings).toContainEqual(
        expect.objectContaining({
          path: relativeProofPath,
          detected: 'button',
          severity: 'error',
          blocking: true,
        })
      );
    } finally {
      fs.rmSync(proofPath, { force: true });
    }
  });
});
