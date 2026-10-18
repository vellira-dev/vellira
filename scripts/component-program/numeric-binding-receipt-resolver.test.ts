import { describe, expect, it } from 'vitest';

import { parseComponentProductionInput } from '../component-production/contracts';
import { compileComponentProgram } from './compile';
import { mediaProgram, mediaSpec } from './fixtures/programs';
import { prepareNumericBindingAuthorityV1 } from './numeric-binding-authority';
import { resolveNumericBindingReceiptsV1 } from './numeric-binding-receipt-resolver';
import { fingerprintNumericSeriesBindingV1 } from './numeric-series-fingerprint';
import { componentProgramSource } from './source';

function webSpec() {
  const program = mediaProgram();
  return {
    ...mediaSpec(),
    platform: 'web' as const,
    componentProgram: {
      ...program,
      modules: program.modules.map((module) => ({
        ...module,
        platforms: ['react'] as const,
      })),
      transitions: program.transitions.map((transition) => ({
        ...transition,
        platforms: ['react'] as const,
      })),
    },
  };
}

function dataset(amount: number) {
  return {
    schemaVersion: '1' as const,
    kind: 'bounded-numeric-series' as const,
    data: {
      series: [{ id: 'value', label: 'Value' }],
      rows: [
        { x: 0, xLabel: 'Start', values: { value: amount } },
        { x: 1, xLabel: 'End', values: { value: null } },
      ],
    },
  };
}

function fixture(count = 1) {
  const source = webSpec();
  const parsed = parseComponentProductionInput(source);
  const program = compileComponentProgram(
    componentProgramSource(parsed),
    parsed.componentProgram
  );
  expect(program.disposition).toBe('compiled');
  if (!program.fingerprint) throw new Error('Fixture program did not compile.');

  const slots = [];
  const entries = [];
  for (let index = 0; index < count; index++) {
    const slotId = 'series-' + index;
    const binding = dataset(index + 10);
    const fingerprint = fingerprintNumericSeriesBindingV1(binding);
    if (!fingerprint.ok) throw new Error('Fixture dataset failed validation.');
    const authority = prepareNumericBindingAuthorityV1(source, {
      schemaVersion: '1',
      ownerName: 'PortraitProbe',
      bindingId: slotId,
      expectedProgramFingerprint: program.fingerprint,
      expectedBindingFingerprint: fingerprint.fingerprint,
      binding,
    });
    if (!authority.ok) throw new Error('Fixture receipt failed preparation.');

    slots.push({
      id: slotId,
      kind: 'bounded-numeric-series' as const,
      platform: 'react' as const,
      ownerRootId: authority.receipt.ownerRootId,
      bindingFingerprint: fingerprint.fingerprint,
      authorityFingerprint: authority.receipt.authorityFingerprint,
    });
    entries.push({
      slotId,
      binding,
      receipt: authority.receipt,
    });
  }

  return {
    source,
    production: {
      ...source,
      componentProgram: {
        ...source.componentProgram,
        numericBindingSlots: {
          schemaVersion: '1' as const,
          baseProgramFingerprint: program.fingerprint,
          slots,
        },
      },
    },
    evidence: { schemaVersion: '1' as const, entries },
    fingerprint: program.fingerprint,
  };
}

describe('review-only numeric binding receipt resolver', () => {
  it('independently binds two receipts and datasets in declared slot order', () => {
    const { production, evidence, fingerprint } = fixture(2);
    const reversed = {
      ...evidence,
      entries: [...evidence.entries].reverse(),
    };
    const result = resolveNumericBindingReceiptsV1(production, reversed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result).toMatchObject({
      schemaVersion: '1',
      disposition: 'review-required',
      grammarAdmitted: false,
      baseProgramFingerprint: fingerprint,
    });
    expect(result.resolved.map((entry) => entry.slotId)).toEqual([
      'series-0',
      'series-1',
    ]);
    expect(result.resolved[0].canonicalJson).toContain('"value":10');
    expect(result.resolved[1].canonicalJson).toContain('"value":11');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.resolved)).toBe(true);
    expect(Object.isFrozen(result.resolved[0])).toBe(true);
    expect(Object.isFrozen(result.resolved[0].receipt)).toBe(true);
    expect(Object.isFrozen(result.resolved[0].snapshot.data.rows)).toBe(true);
    expect(
      Object.isFrozen(result.resolved[0].snapshot.data.rows[0].values)
    ).toBe(true);
  });

  it('detaches both receipts and data from changes after resolution', () => {
    const { production, evidence } = fixture();
    const result = resolveNumericBindingReceiptsV1(production, evidence);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const originalReceipt = result.resolved[0].receipt.authorityFingerprint;
    const originalJson = result.resolved[0].canonicalJson;
    evidence.entries[0].binding.data.rows[0].values.value = 999;
    production.componentProgram.numericBindingSlots.slots[0].id = 'changed';
    expect(result.resolved[0].receipt.authorityFingerprint).toBe(
      originalReceipt
    );
    expect(result.resolved[0].canonicalJson).toBe(originalJson);
    expect(result.resolved[0].snapshot.data.rows[0].values.value).toBe(10);
    expect(resolveNumericBindingReceiptsV1(production, evidence).ok).toBe(
      false
    );
  });

  it('rejects stale baselines, swapped ownership and changed source tokens', () => {
    const { production, evidence } = fixture();
    const stale = {
      ...production,
      componentProgram: {
        ...production.componentProgram,
        numericBindingSlots: {
          ...production.componentProgram.numericBindingSlots,
          baseProgramFingerprint: 'component-program-v1:' + '0'.repeat(64),
        },
      },
    };
    expect(resolveNumericBindingReceiptsV1(stale, evidence)).toMatchObject({
      ok: false,
      code: 'base-program-fingerprint-mismatch',
    });

    const wrongOwner = { ...production, componentName: 'AnotherProbe' };
    expect(resolveNumericBindingReceiptsV1(wrongOwner, evidence)).toMatchObject(
      { ok: false, code: 'receipt-mismatch' }
    );

    const modifiedSource = {
      ...production,
      componentTokens: 'boolean-control' as const,
    };
    expect(
      resolveNumericBindingReceiptsV1(modifiedSource, evidence)
    ).toMatchObject({ ok: false, code: 'base-program-fingerprint-mismatch' });
  });

  it('rejects datasets with matching-looking but stale hashes', () => {
    const { production, evidence } = fixture();
    const changed = fixture();
    changed.evidence.entries[0].binding.data.rows[0].values.value = 99;
    expect(
      resolveNumericBindingReceiptsV1(production, changed.evidence)
    ).toMatchObject({ ok: false, code: 'dataset-mismatch' });

    const malformed = fixture();
    malformed.evidence.entries[0].binding.data.rows[1].x = -1;
    expect(
      resolveNumericBindingReceiptsV1(production, malformed.evidence)
    ).toMatchObject({ ok: false, code: 'invalid-binding' });
  });

  it('recomputes receipts, rejecting spoofed and swapped SHA-256 identities', () => {
    const { production, evidence } = fixture(2);
    const forged = {
      ...evidence,
      entries: evidence.entries.map((entry, index) => ({
        ...entry,
        receipt:
          index === 0
            ? {
                ...entry.receipt,
                authorityFingerprint:
                  'numeric-binding-authority-v1:sha256:' + 'f'.repeat(64),
              }
            : entry.receipt,
      })),
    };
    expect(resolveNumericBindingReceiptsV1(production, forged)).toMatchObject({
      ok: false,
      code: 'receipt-mismatch',
    });

    const forgedSlot = {
      ...production,
      componentProgram: {
        ...production.componentProgram,
        numericBindingSlots: {
          ...production.componentProgram.numericBindingSlots,
          slots: production.componentProgram.numericBindingSlots.slots.map(
            (slot, index) =>
              index === 0
                ? {
                    ...slot,
                    authorityFingerprint:
                      'numeric-binding-authority-v1:sha256:' + 'f'.repeat(64),
                  }
                : slot
          ),
        },
      },
    };
    expect(resolveNumericBindingReceiptsV1(forgedSlot, forged)).toMatchObject({
      ok: false,
      code: 'receipt-mismatch',
    });

    const swapped = {
      ...evidence,
      entries: [
        { ...evidence.entries[0], receipt: evidence.entries[1].receipt },
        { ...evidence.entries[1], receipt: evidence.entries[0].receipt },
      ],
    };
    expect(resolveNumericBindingReceiptsV1(production, swapped)).toMatchObject({
      ok: false,
      code: 'receipt-mismatch',
    });
  });

  it('requires exactly one evidence entry per finite slot', () => {
    const { production, evidence } = fixture(2);
    expect(
      resolveNumericBindingReceiptsV1(production, {
        ...evidence,
        entries: [evidence.entries[0]],
      })
    ).toMatchObject({ ok: false, code: 'invalid-evidence' });
    expect(
      resolveNumericBindingReceiptsV1(production, {
        ...evidence,
        entries: [evidence.entries[0], evidence.entries[0]],
      })
    ).toMatchObject({ ok: false, code: 'invalid-evidence' });
    expect(
      resolveNumericBindingReceiptsV1(production, {
        ...evidence,
        entries: [
          evidence.entries[0],
          { ...evidence.entries[1], slotId: 'not-declared' },
        ],
      })
    ).toMatchObject({ ok: false, code: 'missing-receipt' });
  });

  it('refuses fields not in the receipt or envelope contracts', () => {
    const { production, evidence } = fixture();
    expect(
      resolveNumericBindingReceiptsV1(production, {
        ...evidence,
        extra: true,
      })
    ).toMatchObject({ ok: false, code: 'invalid-evidence' });
    expect(
      resolveNumericBindingReceiptsV1(production, {
        ...evidence,
        entries: [
          {
            ...evidence.entries[0],
            receipt: { ...evidence.entries[0].receipt, userApproved: true },
          },
        ],
      })
    ).toMatchObject({ ok: false, code: 'invalid-evidence' });
    expect(
      resolveNumericBindingReceiptsV1(production, {
        ...evidence,
        entries: [{ ...evidence.entries[0], arbitrary: { executable: true } }],
      })
    ).toMatchObject({ ok: false, code: 'invalid-evidence' });
  });

  it('never executes root/nested toJSON or accessor values', () => {
    const { production, evidence } = fixture();
    let called = 0;
    const hostile = { ...evidence };
    Object.defineProperty(hostile, 'entries', {
      enumerable: true,
      get() {
        called += 1;
        return evidence.entries;
      },
    });
    expect(resolveNumericBindingReceiptsV1(production, hostile)).toMatchObject({
      ok: false,
      code: 'invalid-evidence',
    });
    expect(called).toBe(0);

    const serializer = fixture();
    const receipt = { ...serializer.evidence.entries[0].receipt };
    Object.defineProperty(receipt, 'toJSON', {
      configurable: true,
      value() {
        called += 1;
        return {};
      },
    });
    serializer.evidence.entries[0].receipt = receipt;
    expect(
      resolveNumericBindingReceiptsV1(
        serializer.production,
        serializer.evidence
      )
    ).toMatchObject({ ok: false, code: 'invalid-evidence' });
    expect(called).toBe(0);
  });

  it('contains throwing/reflection Proxy errors without partial output', () => {
    const { production, evidence } = fixture();
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(
      resolveNumericBindingReceiptsV1(production, revoked.proxy)
    ).toMatchObject({ ok: false, code: 'invalid-evidence' });

    const source = fixture();
    const badProduction = {
      ...source.production,
      componentProgram: new Proxy(source.production.componentProgram, {
        getOwnPropertyDescriptor() {
          throw new Error('Unsafe reflection');
        },
      }),
    };
    expect(
      resolveNumericBindingReceiptsV1(badProduction, evidence)
    ).toMatchObject({ ok: false, code: 'invalid-production-spec' });
  });

  it('preserves the compiler denial gate and rejects native/absent slots', () => {
    const { production, evidence, source } = fixture();
    const denied = compileComponentProgram(
      componentProgramSource(parseComponentProductionInput(production)),
      production.componentProgram
    );
    expect(denied).toMatchObject({
      disposition: 'missing-grammar-capability',
      program: null,
      fingerprint: null,
    });
    expect(resolveNumericBindingReceiptsV1(source, evidence)).toMatchObject({
      ok: false,
      code: 'missing-slots',
    });
    expect(
      resolveNumericBindingReceiptsV1(
        { ...production, platform: 'both' },
        evidence
      )
    ).toMatchObject({ ok: false, code: 'unsupported-platform' });
    expect(
      resolveNumericBindingReceiptsV1(
        { ...production, componentProgram: undefined },
        evidence
      )
    ).toMatchObject({ ok: false, code: 'missing-slots' });
  });

  it('accepts four bounded independent slots without claiming admission', () => {
    const { production, evidence } = fixture(4);
    const resolution = resolveNumericBindingReceiptsV1(production, evidence);
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect(resolution.resolved).toHaveLength(4);
    expect(resolution.grammarAdmitted).toBe(false);
    expect(resolution.disposition).toBe('review-required');
  });
});
