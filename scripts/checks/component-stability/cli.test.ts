import type { ComponentStabilityReportV1 } from '@vellira-ui/metadata';
import { describe, expect, it } from 'vitest';

import { runComponentStabilityCli } from './cli';

const report: ComponentStabilityReportV1 = {
  schemaVersion: '1',
  component: 'Fixture',
  lifecycle: 'beta',
  status: 'NOT_STABLE_ELIGIBLE',
  gates: [],
  capabilities: [],
  blockers: [
    {
      gateId: 'human-approval',
      code: 'human-approval.missing',
      message: 'Missing approval.',
    },
  ],
  warnings: [],
  approval: null,
};

describe('Component Stable gate CLI', () => {
  it('emits the versioned JSON report and a blocking exit code', async () => {
    const output: string[] = [];
    const code = await runComponentStabilityCli(
      ['Fixture', '--json'],
      (message) => output.push(message),
      () => undefined,
      async () => report
    );

    expect(code).toBe(1);
    expect(JSON.parse(output[0] ?? '{}')).toMatchObject({
      schemaVersion: '1',
      component: 'Fixture',
      status: 'NOT_STABLE_ELIGIBLE',
    });
  });

  it('ends human output with the eligibility result', async () => {
    const output: string[] = [];
    const code = await runComponentStabilityCli(
      ['Fixture'],
      (message) => output.push(message),
      () => undefined,
      async () => report
    );

    expect(code).toBe(1);
    expect(output[0]?.trimEnd().endsWith('NOT_STABLE_ELIGIBLE')).toBe(true);
  });
});
