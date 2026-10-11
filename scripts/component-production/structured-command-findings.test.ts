import { describe, expect, it } from 'vitest';
import { tokenSemanticRuleIds } from '../checks/token-semantic/contract';
import { structuredCommandFindings } from './structured-command-findings';
import { qualityFindingSourcePaths } from './finding-path';
import { runValidationStage } from './validation-command';

const command = {
  id: 'tokens',
  stage: 'tooling' as const,
  command: ['audit'],
  timeoutMs: 1000,
  resultFormat: 'token-semantic' as const,
};
const report = {
  schemaVersion: 1,
  status: 'fail',
  coverage: tokenSemanticRuleIds.map((ruleId) => ({
    ruleId,
    coverage: 'complete',
  })),
  findings: [
    {
      id: 'bad-variable',
      severity: 'error',
      ruleId: 'tokens.consumer-reference',
      sourcePath: 'packages/react/src/components/Notice/Notice.module.scss',
      code: 'unknown-variable',
      evidence: '--spacing-4 is not canonical',
    },
  ],
};
const execution = (value: unknown) => ({
  exitCode: 1,
  stdout: JSON.stringify(value),
  stderr: '',
  timedOut: false,
});

describe('structured negative command evidence', () => {
  it('retains exact token owner and excludes wrapper stack paths', () => {
    const result = structuredCommandFindings(command, {
      ...execution(report),
      stderr: '$ node scripts/checks/token-semantic/cli.ts',
    });
    expect(result).toEqual([
      expect.objectContaining({
        path: report.findings[0].sourcePath,
        ruleId: 'tokens.consumer-reference',
      }),
    ]);
    expect(result?.[0].message).not.toContain('cli.ts');
  });
  it('retains infrastructure alongside candidate findings for incomplete audits', () => {
    const result = structuredCommandFindings(
      command,
      execution({
        ...report,
        status: 'incomplete',
        coverage: [{ coverage: 'error' }],
      })
    );
    expect(result).toHaveLength(2);
    expect(result?.[1].ruleId).toBe('validation.harness');
  });
  it.each([
    {},
    { ...report, findings: [] },
    { ...report, findings: [{ ...report.findings[0], severity: 'unknown' }] },
    { ...report, findings: [{ ...report.findings[0], ruleId: 'unknown' }] },
  ])('fails closed on malformed or empty failure reports', (value) => {
    const result = runValidationStage({
      root: '.',
      stageId: 'tooling',
      commands: [command],
      runner: () => execution(value),
    });
    expect(result.status).toBe('failed');
    expect(result.findings[0].ruleId).toBe('validation.runtime');
  });
  it.each(['stderr', 'stdout'] as const)(
    'retains mixed infrastructure output on %s',
    (stream) => {
      const result = runValidationStage({
        root: '.',
        stageId: 'tooling',
        commands: [command],
        runner: () => ({
          ...execution(report),
          [stream]:
            stream === 'stdout'
              ? 'Error: missing authority\n' + JSON.stringify(report)
              : 'Error: missing authority',
        }),
      });
      expect(result.status).toBe('failed');
      expect(result.findings[0].ruleId).toBe('validation.runtime');
    }
  );
  it('keeps missing and duplicate coverage as infrastructure evidence', () => {
    for (const coverage of [
      [],
      [report.coverage[0]],
      report.coverage.map(() => report.coverage[0]),
    ]) {
      const result = structuredCommandFindings(
        command,
        execution({ ...report, coverage })
      );
      expect(
        result?.some((finding) => finding.ruleId === 'validation.harness')
      ).toBe(true);
    }
  });
  it('retains exact icon locations and all independently failing files', () => {
    const result = qualityFindingSourcePaths('conformity.icon-resources', [
      'prohibited-icon-glyph: packages/react/src/components/Notice/Root/NoticeRoot.tsx:10 — "×"',
      'prohibited-icon-glyph: packages/react/src/components/Notice/Action/NoticeAction.tsx:12 — "×"',
    ]);
    expect(result).toEqual([
      'packages/react/src/components/Notice/Action/NoticeAction.tsx',
      'packages/react/src/components/Notice/Root/NoticeRoot.tsx',
    ]);
  });
  it('consumes canonical quality failures without granting paths to absence findings', () => {
    const quality = {
      schemaVersion: '1',
      components: [
        {
          componentName: 'Notice',
          status: 'fail',
          findings: [
            {
              status: 'fail',
              platform: 'react',
              ruleId: 'conformity.icon-resources',
              message: 'Use canonical icons.',
              evidence: [
                'prohibited-icon-glyph: packages/react/src/components/Notice/Notice.tsx:10 — "×"',
              ],
            },
            {
              status: 'fail',
              platform: 'react-native',
              ruleId: 'platform.overlay-presentation',
              evidence: ['packages/react-native/src/components/Notice'],
            },
            { status: 'pass', platform: 'react', ruleId: 'coverage.tests' },
          ],
        },
      ],
    };
    const descriptor = {
      ...command,
      resultFormat: 'component-quality' as const,
      componentName: 'Notice',
      stage: 'quality' as const,
    };
    const findings = structuredCommandFindings(descriptor, execution(quality));
    expect(findings).toHaveLength(2);
    expect(findings?.[0].path).toBe(
      'packages/react/src/components/Notice/Notice.tsx'
    );
    expect(findings?.[1].path).toBeUndefined();
    for (const invalid of [
      { ...quality, components: [] },
      {
        ...quality,
        components: [{ ...quality.components[0], componentName: 'Other' }],
      },
      {
        ...quality,
        components: [
          {
            ...quality.components[0],
            findings: [
              { ...quality.components[0].findings[0], status: 'unknown' },
            ],
          },
        ],
      },
      {
        ...quality,
        components: [
          {
            ...quality.components[0],
            findings: [
              { ...quality.components[0].findings[0], platform: 'unknown' },
            ],
          },
        ],
      },
    ])
      expect(() =>
        structuredCommandFindings(descriptor, execution(invalid))
      ).toThrow('Malformed');
  });
  it('does not guess absence ownership from a directory or multiple implementations', () => {
    expect(
      qualityFindingSourcePaths('platform.overlay-presentation', [
        'packages/react-native/src/components/Notice',
      ])
    ).toEqual([undefined]);
    expect(
      qualityFindingSourcePaths('platform.interaction', [
        'packages/react/src/components/Notice/A.tsx',
        'packages/react/src/components/Notice/B.tsx',
      ])
    ).toEqual([undefined]);
  });
  it('does not grant traversal authority', () => {
    expect(
      qualityFindingSourcePaths('conformity.icon-resources', [
        'packages/../../secret.tsx:10',
      ])
    ).toEqual([undefined]);
  });
});
