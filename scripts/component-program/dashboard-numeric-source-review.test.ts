import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseComponentProductionInput } from '../component-production/contracts';
import { compileComponentProgram } from './compile';
import { resolveNumericBindingReceiptsV1 } from './numeric-binding-receipt-resolver';
import { componentProgramSource } from './source';

const component = 'DashboardNumericSourceProbe';
const sourcePath = '../component-production/specs/' + component + '.json';
const evidencePath =
  '../component-production/numeric-evidence/' + component + '.json';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

describe('Dashboard numeric source â content proof only', () => {
  it('recompiles the approved numeric-free baseline and denies Numeric Grammar', () => {
    const production = parseComponentProductionInput(readJson(sourcePath));
    expect(production.componentName).toBe(component);
    expect(production.platform).toBe('web');
    const proposed = production.componentProgram;
    expect(proposed?.numericBindingSlots?.slots).toHaveLength(1);
    if (!proposed?.numericBindingSlots)
      throw new Error('Missing numeric slot proposal.');

    const { numericBindingSlots, ...baselineDecisions } = proposed;
    const source = componentProgramSource(production);
    const baseline = compileComponentProgram(source, baselineDecisions);
    expect(baseline.disposition).toBe('compiled');
    expect(baseline.fingerprint).toBe(
      numericBindingSlots.baseProgramFingerprint
    );

    const attempted = compileComponentProgram(source, proposed);
    expect(attempted.disposition).toBe('missing-grammar-capability');
    expect(attempted.program).toBeNull();
    expect(attempted.fingerprint).toBeNull();
  });

  it('independently recomputes the exact synthetic Numeric Receipt', () => {
    const production = readJson(sourcePath);
    const evidence = readJson(evidencePath);
    const result = resolveNumericBindingReceiptsV1(production, evidence);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.disposition).toBe('review-required');
    expect(result.grammarAdmitted).toBe(false);
    expect(result.resolved.map((item) => item.slotId)).toEqual([
      'sample-series',
    ]);
    expect(result.resolved[0]?.receipt.grammarAdmitted).toBe(false);
    expect(result.resolved[0]?.snapshot.data.rows).toHaveLength(3);
  });

  it('refuses a tampered synthetic sample without minting authority', () => {
    const production = readJson(sourcePath);
    const evidence = readJson(evidencePath) as {
      schemaVersion: string;
      entries: {
        slotId: string;
        receipt: Record<string, unknown>;
        binding: unknown;
      }[];
    };
    const invalid = {
      ...evidence,
      entries: [
        {
          ...evidence.entries[0],
          receipt: {
            ...evidence.entries[0]?.receipt,
            authorityFingerprint:
              'numeric-binding-authority-v1:sha256:' + 'f'.repeat(64),
          },
        },
      ],
    };
    expect(resolveNumericBindingReceiptsV1(production, invalid)).toMatchObject({
      ok: false,
      code: 'receipt-mismatch',
    });
  });
});
