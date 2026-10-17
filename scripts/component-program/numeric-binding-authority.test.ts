import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { parseComponentProductionInput } from '../component-production/contracts';
import { compileComponentProgram } from './compile';
import { mediaProgram, mediaSpec } from './fixtures/programs';
import { prepareNumericBindingAuthorityV1 } from './numeric-binding-authority';
import { fingerprintNumericSeriesBindingV1 } from './numeric-series-fingerprint';
import { componentProgramSource } from './source';

const dataset = () => ({
  schemaVersion: '1' as const,
  kind: 'bounded-numeric-series' as const,
  data: {
    series: [{ id: 'revenue', label: 'Revenue' }],
    rows: [
      { x: 0, xLabel: 'Start', values: { revenue: null } },
      { x: 2, xLabel: 'End', values: { revenue: 42 } },
    ],
  },
});

function webSpec() {
  const program = mediaProgram();
  return {
    ...mediaSpec(),
    platform: 'web' as const,
    componentProgram: {
      ...program,
      modules: program.modules.map((selection) => ({
        ...selection,
        platforms: ['react'] as const,
      })),
      transitions: program.transitions.map((transition) => ({
        ...transition,
        platforms: ['react'] as const,
      })),
    },
  };
}

function prepared() {
  const spec = webSpec();
  const input = parseComponentProductionInput(spec);
  const program = compileComponentProgram(
    componentProgramSource(input),
    input.componentProgram
  );
  expect(program.disposition).toBe('compiled');
  if (!program.fingerprint) throw new Error('Fixture did not compile.');

  const binding = dataset();
  const fingerprint = fingerprintNumericSeriesBindingV1(binding);
  expect(fingerprint.ok).toBe(true);
  if (!fingerprint.ok) throw new Error('Fixture binding was invalid.');

  return {
    spec,
    request: {
      schemaVersion: '1',
      ownerName: 'PortraitProbe',
      bindingId: 'dashboard-series',
      expectedProgramFingerprint: program.fingerprint,
      expectedBindingFingerprint: fingerprint.fingerprint,
      binding,
    },
  };
}

describe('numeric binding authority preflight', () => {
  it('pins a validated Web source and compiled program to a frozen dataset', () => {
    const { spec, request } = prepared();
    const result = prepareNumericBindingAuthorityV1(spec, request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.receipt).toMatchObject({
      schemaVersion: '1',
      disposition: 'review-required',
      grammarAdmitted: false,
      ownerName: 'PortraitProbe',
      ownerPlatform: 'react',
      ownerRootId: 'Root',
      bindingId: 'dashboard-series',
      programFingerprint: request.expectedProgramFingerprint,
      bindingFingerprint: request.expectedBindingFingerprint,
    });
    expect(result.receipt.sourceFingerprint).toMatch(
      /^component-program-source-v1:[a-f0-9]{64}$/
    );
    expect(Object.isFrozen(result.receipt)).toBe(true);
    expect(Object.isFrozen(result.snapshot.data.rows[0].values)).toBe(true);
    expect(result.snapshot.data.rows[1].values.revenue).toBe(42);
    const { authorityFingerprint, ...identity } = result.receipt;
    const independentDigest = createHash('sha256')
      .update(JSON.stringify(identity), 'utf8')
      .digest('hex');
    expect(authorityFingerprint).toBe(
      'numeric-binding-authority-v1:sha256:' + independentDigest
    );
  });

  it('keeps the issued receipt and snapshot stable after caller mutations', () => {
    const { spec, request } = prepared();
    const result = prepareNumericBindingAuthorityV1(spec, request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const original = result.receipt.authorityFingerprint;
    request.binding.data.rows[1].values.revenue = -8;
    request.binding.data.series[0].label = 'Other';
    expect(result.receipt.authorityFingerprint).toBe(original);
    expect(result.snapshot.data.rows[1].values.revenue).toBe(42);
    expect(result.snapshot.data.series[0].label).toBe('Revenue');
    expect(
      prepareNumericBindingAuthorityV1(spec, request)
    ).toMatchObject({
      ok: false,
      code: 'binding-fingerprint-mismatch',
    });
  });

  it('rejects wrong pinned fingerprints and owner identities', () => {
    const { spec, request } = prepared();
    expect(
      prepareNumericBindingAuthorityV1(spec, {
        ...request,
        ownerName: 'AnotherProbe',
      })
    ).toMatchObject({ ok: false, code: 'owner-mismatch' });

    const mutatedSpec = {
      ...spec,
      componentTokens: 'boolean-control' as const,
    };
    expect(
      prepareNumericBindingAuthorityV1(mutatedSpec, request)
    ).toMatchObject({ ok: false, code: 'program-fingerprint-mismatch' });

    expect(
      prepareNumericBindingAuthorityV1(spec, {
        ...request,
        expectedBindingFingerprint:
          'numeric-series-binding-v1:sha256:' + '0'.repeat(64),
      })
    ).toMatchObject({ ok: false, code: 'binding-fingerprint-mismatch' });
  });

  it('never grants React Native or unregistered numeric grammar authority', () => {
    const { spec, request } = prepared();
    expect(
      prepareNumericBindingAuthorityV1(
        { ...spec, platform: 'both' },
        request
      )
    ).toMatchObject({ ok: false, code: 'unsupported-platform' });

    const numericSpec = {
      ...spec,
      componentProgram: {
        ...spec.componentProgram,
        modules: [
          ...spec.componentProgram.modules,
          {
            id: 'bounded-numeric-series',
            platforms: ['react'] as const,
            bindings: {},
          },
        ],
      },
    };
    expect(
      prepareNumericBindingAuthorityV1(numericSpec, request)
    ).toMatchObject({ ok: false, code: 'program-not-compiled' });
  });

  it('refuses object-valued scalar parameters and malformed datasets', () => {
    const { spec, request } = prepared();
    const badProgram = {
      ...spec,
      componentProgram: {
        ...spec.componentProgram,
        modules: spec.componentProgram.modules.map((module, index) =>
          index === 0
            ? { ...module, parameters: { dataset: dataset() } }
            : module
        ),
      },
    };
    expect(
      prepareNumericBindingAuthorityV1(badProgram, request)
    ).toMatchObject({ ok: false, code: 'invalid-production-spec' });

    const extra = dataset() as unknown as Record<string, unknown>;
    extra.extra = true;
    expect(
      prepareNumericBindingAuthorityV1(spec, { ...request, binding: extra })
    ).toMatchObject({ ok: false, code: 'invalid-binding' });
  });

  it('fails closed on extra fields, getters and revoked Proxy requests', () => {
    const { spec, request } = prepared();
    expect(
      prepareNumericBindingAuthorityV1(spec, { ...request, extra: 1 })
    ).toMatchObject({ ok: false, code: 'invalid-request' });

    let called = false;
    const accessor = Object.defineProperty({ ...request }, 'binding', {
      enumerable: true,
      get() {
        called = true;
        return dataset();
      },
    });
    expect(
      prepareNumericBindingAuthorityV1(spec, accessor)
    ).toMatchObject({ ok: false, code: 'invalid-request' });
    expect(called).toBe(false);

    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(
      prepareNumericBindingAuthorityV1(spec, revoked.proxy)
    ).toMatchObject({ ok: false, code: 'invalid-request' });
  });

  it('rejects absent or invalid production authority', () => {
    const { spec, request } = prepared();
    expect(
      prepareNumericBindingAuthorityV1(null, request)
    ).toMatchObject({ ok: false, code: 'invalid-production-spec' });
    expect(
      prepareNumericBindingAuthorityV1(
        { ...spec, componentProgram: undefined },
        request
      )
    ).toMatchObject({ ok: false, code: 'program-not-compiled' });
  });
});
