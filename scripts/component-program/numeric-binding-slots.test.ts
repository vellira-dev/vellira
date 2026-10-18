import { describe, expect, it } from 'vitest';

import { parseComponentProductionInput } from '../component-production/contracts';
import { compileComponentProgram } from './compile';
import { mediaProgram, mediaSpec } from './fixtures/programs';
import { prepareNumericBindingAuthorityV1 } from './numeric-binding-authority';
import { parseComponentProgramNumericBindingSlotsV1 } from './numeric-binding-slots';
import { fingerprintNumericSeriesBindingV1 } from './numeric-series-fingerprint';
import { parseComponentProgramDecisions } from './parse';
import { componentProgramSource } from './source';

const invalid = 'Invalid Numeric Binding Slots V1.';

const proposal = () => ({
  schemaVersion: '1',
  baseProgramFingerprint: 'component-program-v1:' + 'a'.repeat(64),
  slots: [
    {
      id: 'revenue',
      kind: 'bounded-numeric-series',
      platform: 'react',
      ownerRootId: 'Root',
      bindingFingerprint: 'numeric-series-binding-v1:sha256:' + 'b'.repeat(64),
      authorityFingerprint:
        'numeric-binding-authority-v1:sha256:' + 'c'.repeat(64),
    },
  ],
});

const parse = parseComponentProgramNumericBindingSlotsV1;
const expectInvalid = (value: unknown) =>
  expect(() => parse(value)).toThrow(invalid);

describe('finite numeric binding slot reference contract', () => {
  it('captures and freezes exact, bounded Web references', () => {
    const raw = proposal();
    const parsed = parse(raw);
    expect(parsed).toEqual(raw);
    expect(parsed).not.toBe(raw);
    expect(parsed.slots).not.toBe(raw.slots);
    expect(parsed.slots[0]).not.toBe(raw.slots[0]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.slots)).toBe(true);
    expect(Object.isFrozen(parsed.slots[0])).toBe(true);

    raw.slots[0].id = 'changed';
    expect(parsed.slots[0].id).toBe('revenue');
    expect(Reflect.set(parsed.slots[0], 'id', 'other')).toBe(false);
  });

  it('rejects foreign fields, dataset objects and wrong fingerprint kinds', () => {
    expectInvalid({ ...proposal(), data: { series: [], rows: [] } });
    expectInvalid({ ...proposal(), baseProgramFingerprint: 'unverified' });
    expectInvalid({ ...proposal(), schemaVersion: '2' });
    expectInvalid({
      ...proposal(),
      slots: [{ ...proposal().slots[0], data: {} }],
    });
    expectInvalid({
      ...proposal(),
      slots: [
        {
          ...proposal().slots[0],
          bindingFingerprint: 'component-program-v1:' + 'b'.repeat(64),
        },
      ],
    });
    expectInvalid({
      ...proposal(),
      slots: [
        {
          ...proposal().slots[0],
          authorityFingerprint: 'numeric-series-binding-v1:sha256:',
        },
      ],
    });
  });

  it('rejects unsupported platforms, modules and root names', () => {
    for (const changes of [
      { platform: 'react-native' },
      { kind: 'arbitrary-json' },
      { id: 'a b' },
      { ownerRootId: '' },
    ]) {
      expectInvalid({
        ...proposal(),
        slots: [{ ...proposal().slots[0], ...changes }],
      });
    }
  });

  it('enforces cardinality, uniqueness and no reused authority receipts', () => {
    expectInvalid({ ...proposal(), slots: [] });
    expectInvalid({
      ...proposal(),
      slots: Array.from({ length: 5 }, (_, index) => ({
        ...proposal().slots[0],
        id: 'series-' + index,
      })),
    });
    const a = proposal().slots[0];
    expectInvalid({ ...proposal(), slots: [a, { ...a }] });
    expectInvalid({
      ...proposal(),
      slots: [a, { ...a, id: 'costs' }],
    });
    const b = {
      ...a,
      id: 'costs',
      authorityFingerprint:
        'numeric-binding-authority-v1:sha256:' + 'd'.repeat(64),
    };
    expect(parse({ ...proposal(), slots: [b, a] }).slots).toHaveLength(2);
  });

  it('rejects array holes, accessors, symbols and non-enumerable extras', () => {
    const empty = proposal();
    empty.slots.length = 2;
    expectInvalid(empty);

    const symbolic = proposal();
    Object.defineProperty(symbolic.slots[0], Symbol('private'), {
      value: true,
    });
    expectInvalid(symbolic);

    const withToJSON = proposal();
    let executed = false;
    Object.defineProperty(withToJSON.slots, 'toJSON', {
      value: () => {
        executed = true;
        return [];
      },
    });
    expectInvalid(withToJSON);
    expect(executed).toBe(false);

    const accessor = proposal();
    Object.defineProperty(accessor.slots[0], 'id', {
      configurable: true,
      enumerable: true,
      get() {
        executed = true;
        return 'unsafe';
      },
    });
    expectInvalid(accessor);
    expect(executed).toBe(false);
  });

  it('contains throwing and revoked Proxy traps', () => {
    const throwing = () => {
      throw new Error('untrusted proxy');
    };
    expectInvalid(new Proxy({}, { getPrototypeOf: throwing }));
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expectInvalid(revoked.proxy);
    const nested = proposal();
    (nested as { slots: unknown }).slots = new Proxy(nested.slots, {
      ownKeys: throwing,
    });
    expectInvalid(nested);
  });

  it('integrates with decisions but never compiles unadmitted numeric slots', () => {
    const baselineDecisions = mediaProgram();
    const source = componentProgramSource(mediaSpec());
    const baseline = compileComponentProgram(source, baselineDecisions);
    expect(baseline.disposition).toBe('compiled');
    expect(baseline.fingerprint).toMatch(/^component-program-v1:[a-f0-9]{64}$/);
    if (!baseline.fingerprint) throw new Error('No baseline program.');

    const slots = {
      ...proposal(),
      baseProgramFingerprint: baseline.fingerprint,
    };
    const parsed = parseComponentProgramDecisions({
      ...baselineDecisions,
      numericBindingSlots: slots,
    });
    expect(parsed.numericBindingSlots).toEqual(slots);
    const blocked = compileComponentProgram(source, parsed);
    expect(blocked).toMatchObject({
      disposition: 'missing-grammar-capability',
      program: null,
      fingerprint: null,
    });
    expect(blocked.findings).toContainEqual(
      expect.objectContaining({
        code: 'missing-grammar-capability',
        subject: 'bounded-numeric-series',
      })
    );
    const mismatched = compileComponentProgram(source, {
      ...baselineDecisions,
      numericBindingSlots: proposal(),
    });
    expect(mismatched).toMatchObject({
      disposition: 'blocked',
      program: null,
      fingerprint: null,
    });
    expect(mismatched.findings).toContainEqual(
      expect.objectContaining({
        code: 'invalid-composition',
        subject: 'numeric-binding-slots',
      })
    );
    expect(compileComponentProgram(source, baselineDecisions)).toEqual(
      baseline
    );
  });

  it('accepts prior Web authority receipt references without admitting grammar', () => {
    const baselineProgram = mediaProgram();
    const spec = {
      ...mediaSpec(),
      platform: 'web' as const,
      componentProgram: {
        ...baselineProgram,
        modules: baselineProgram.modules.map((module) => ({
          ...module,
          platforms: ['react'] as const,
        })),
        transitions: baselineProgram.transitions.map((transition) => ({
          ...transition,
          platforms: ['react'] as const,
        })),
      },
    };
    const parsed = parseComponentProductionInput(spec);
    const baseline = compileComponentProgram(
      componentProgramSource(parsed),
      parsed.componentProgram
    );
    expect(baseline.disposition).toBe('compiled');
    if (!baseline.fingerprint) throw new Error('Missing Web program.');

    const binding = {
      schemaVersion: '1' as const,
      kind: 'bounded-numeric-series' as const,
      data: {
        series: [{ id: 'revenue', label: 'Revenue' }],
        rows: [{ x: 0, xLabel: 'Start', values: { revenue: null } }],
      },
    };
    const hashed = fingerprintNumericSeriesBindingV1(binding);
    expect(hashed.ok).toBe(true);
    if (!hashed.ok) return;

    const authority = prepareNumericBindingAuthorityV1(spec, {
      schemaVersion: '1',
      ownerName: 'PortraitProbe',
      bindingId: 'revenue',
      expectedProgramFingerprint: baseline.fingerprint,
      expectedBindingFingerprint: hashed.fingerprint,
      binding,
    });
    expect(authority.ok).toBe(true);
    if (!authority.ok) return;

    const numericBindingSlots = {
      schemaVersion: '1',
      baseProgramFingerprint: baseline.fingerprint,
      slots: [
        {
          id: 'revenue',
          kind: 'bounded-numeric-series',
          platform: 'react',
          ownerRootId: authority.receipt.ownerRootId,
          bindingFingerprint: authority.receipt.bindingFingerprint,
          authorityFingerprint: authority.receipt.authorityFingerprint,
        },
      ],
    };
    const withSlots = parseComponentProductionInput({
      ...spec,
      componentProgram: {
        ...spec.componentProgram,
        numericBindingSlots,
      },
    });
    expect(withSlots.componentProgram?.numericBindingSlots).toEqual(
      numericBindingSlots
    );
    expect(
      compileComponentProgram(
        componentProgramSource(withSlots),
        withSlots.componentProgram
      ).disposition
    ).toBe('missing-grammar-capability');
  });

  it('does not execute a root numericBindingSlots getter that deletes itself', () => {
    const source = componentProgramSource(mediaSpec());
    const decisions: Record<string, unknown> = { ...mediaProgram() };
    let invoked = 0;
    Object.defineProperty(decisions, 'numericBindingSlots', {
      enumerable: true,
      configurable: true,
      get() {
        invoked += 1;
        delete decisions.numericBindingSlots;
        return proposal();
      },
    });

    const result = compileComponentProgram(source, decisions);
    expect(result.disposition).toBe('blocked');
    expect(result.program).toBeNull();
    expect(result.fingerprint).toBeNull();
    expect(invoked).toBe(0);
    expect(Object.hasOwn(decisions, 'numericBindingSlots')).toBe(true);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: 'invalid-composition' })
    );
  });

  it('does not execute root toJSON that deletes proposed numeric slots', () => {
    const source = componentProgramSource(mediaSpec());
    const decisions: Record<string, unknown> = {
      ...mediaProgram(),
      numericBindingSlots: proposal(),
    };
    let invoked = 0;
    Object.defineProperty(decisions, 'toJSON', {
      configurable: true,
      value() {
        invoked += 1;
        delete decisions.numericBindingSlots;
        return mediaProgram();
      },
    });

    const result = compileComponentProgram(source, decisions);
    expect(result.disposition).toBe('blocked');
    expect(result.program).toBeNull();
    expect(result.fingerprint).toBeNull();
    expect(invoked).toBe(0);
    expect(Object.hasOwn(decisions, 'numericBindingSlots')).toBe(true);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: 'invalid-composition' })
    );
  });

  it('rejects nested getters before sizing without changing legacy fingerprints', () => {
    const source = componentProgramSource(mediaSpec());
    const baseline = compileComponentProgram(source, mediaProgram());
    expect(baseline.disposition).toBe('compiled');

    const decisions = mediaProgram();
    let invoked = 0;
    Object.defineProperty(decisions.modules[0], 'parameters', {
      enumerable: true,
      configurable: true,
      get() {
        invoked += 1;
        return { dataset: proposal() };
      },
    });
    const result = compileComponentProgram(source, decisions);
    expect(result.disposition).toBe('blocked');
    expect(result.program).toBeNull();
    expect(result.fingerprint).toBeNull();
    expect(invoked).toBe(0);
    expect(compileComponentProgram(source, mediaProgram())).toEqual(baseline);
  });

  it('checks root ownership and preserves scalar parameter restrictions', () => {
    const source = componentProgramSource(mediaSpec());
    const baseline = mediaProgram();
    expect(() =>
      parseComponentProgramDecisions({
        ...baseline,
        numericBindingSlots: {
          ...proposal(),
          slots: [{ ...proposal().slots[0], ownerRootId: 'Other' }],
        },
      })
    ).toThrow('Numeric slot root differs from the program root.');

    const blockedScalar = compileComponentProgram(source, {
      ...baseline,
      modules: [
        { ...baseline.modules[0], parameters: { dataset: proposal() } },
        ...baseline.modules.slice(1),
      ],
    });
    expect(blockedScalar).toMatchObject({
      disposition: 'blocked',
      program: null,
    });
    expect(blockedScalar.findings).toContainEqual(
      expect.objectContaining({
        code: 'invalid-composition',
      })
    );
    expect(compileComponentProgram(source, baseline).disposition).toBe(
      'compiled'
    );
  });
});
