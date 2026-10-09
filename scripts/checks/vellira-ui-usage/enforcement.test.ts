import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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
    const relativeProofPath = 'apps/website/src/proof.tsx';
    // Other suites scan the maintained checkout concurrently. Never inject or
    // remove a source file there while proving the CLI's blocking behavior.
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vellira-ui-enforcement-')
    );
    const proofPath = path.join(root, relativeProofPath);
    const source = 'export const Proof = () => <button>Proof</button>;\n';
    const cli = path.resolve('scripts/checks/vellira-ui-usage/cli.ts');
    const args = ['--import', import.meta.resolve('tsx'), cli, '--json'];

    expect(fs.existsSync(proofPath)).toBe(false);
    try {
      fs.mkdirSync(path.dirname(proofPath), { recursive: true });
      fs.symlinkSync(
        path.resolve('packages'),
        path.join(root, 'packages'),
        'dir'
      );
      fs.writeFileSync(proofPath, source);
      const result = spawnSync(process.execPath, args, {
        cwd: root,
        encoding: 'utf8',
      });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);

      const output = JSON.parse(result.stdout) as VelliraUiUsageReport;
      const [finding] = output.findings;

      expect(output.mode).toBe('blocking');
      expect(output.summary.blockingFindings).toBe(1);
      expect(finding?.path).toBe(relativeProofPath);
      expect(finding?.detected).toBe('button');
      expect(finding?.severity).toBe('error');
      expect(finding?.blocking).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
