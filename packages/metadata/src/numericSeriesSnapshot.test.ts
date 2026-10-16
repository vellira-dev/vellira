import { describe, expect, it } from 'vitest';

import { snapshotNumericSeriesBindingV1 as snapshot } from './numericSeriesSnapshot';

const valid = () => ({
  schemaVersion: '1',
  kind: 'bounded-numeric-series',
  data: {
    series: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    rows: [
      { x: -0, xLabel: 'zero', values: { a: 0, b: null } },
      { x: 2, xLabel: 'two', values: { a: 7, b: -8 } },
    ],
  },
});

const failure = {
  ok: false,
  code: 'invalid-snapshot',
  path: '$',
} as const;

describe('immutable numeric binding snapshots', () => {
  it('copies, validates and freezes the entire bounded graph', () => {
    const source = valid();
    const result = snapshot(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.data).not.toBe(source.data);
    expect(result.value.data.series[0]).not.toBe(source.data.series[0]);
    expect(result.value.data.rows[0]).not.toBe(source.data.rows[0]);
    expect(result.value.data.rows[0].values).not.toBe(
      source.data.rows[0].values
    );
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.data)).toBe(true);
    expect(Object.isFrozen(result.value.data.series)).toBe(true);
    expect(Object.isFrozen(result.value.data.series[0])).toBe(true);
    expect(Object.isFrozen(result.value.data.rows)).toBe(true);
    expect(Object.isFrozen(result.value.data.rows[0])).toBe(true);
    expect(Object.isFrozen(result.value.data.rows[0].values)).toBe(true);
    expect(Reflect.set(result.value.data.rows[0].values, 'a', 500)).toBe(false);

    source.data.series[0].label = 'Changed';
    source.data.rows[0].values.a = 500;
    source.data.rows[0].xLabel = 'Changed';
    expect(result.value.data.series[0].label).toBe('A');
    expect(result.value.data.rows[0].values.a).toBe(0);
    expect(result.value.data.rows[0].xLabel).toBe('zero');
    expect(result.canonicalJson).toContain('"label":"A"');
    expect(result.canonicalJson).not.toContain('Changed');
  });

  it('emits deterministic JSON using declared series order', () => {
    const source = valid();
    const first = snapshot(source);
    const reordered = valid();
    reordered.data.rows[0].values = { b: null, a: 0 };
    reordered.data.rows[1].values = { b: -8, a: 7 };
    const second = snapshot(reordered);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(JSON.parse(first.canonicalJson)).toEqual({
      schemaVersion: '1',
      kind: 'bounded-numeric-series',
      data: {
        series: source.data.series,
        rows: [
          { x: 0, xLabel: 'zero', values: { a: 0, b: null } },
          { x: 2, xLabel: 'two', values: { a: 7, b: -8 } },
        ],
      },
    });
    expect(first.canonicalJson).toContain(
      '"x":0,"xLabel":"zero","values":{"a":0,"b":null}'
    );
    expect(Object.is(first.value.data.rows[0].x, -0)).toBe(false);
  });

  it('never invokes array or object toJSON supplied by the caller', () => {
    let invoked = 0;
    const source = valid();
    Object.defineProperty(source.data.rows, 'toJSON', {
      value: () => {
        invoked += 1;
        return [];
      },
    });
    expect(snapshot(source)).toEqual(failure);
    expect(invoked).toBe(0);

    const sourceWithSerializer = valid();
    Object.defineProperty(sourceWithSerializer.data.rows[0].values, 'toJSON', {
      enumerable: false,
      get() {
        invoked += 1;
        throw new Error('Must not be called.');
      },
    });
    expect(snapshot(sourceWithSerializer)).toEqual(failure);
    expect(invoked).toBe(0);
  });

  it('rejects sparse arrays and element accessors without invoking getters', () => {
    const sparse = valid();
    const rows: unknown[] = [];
    rows.length = 1;
    (sparse.data as { rows: unknown }).rows = rows;
    expect(snapshot(sparse)).toEqual(failure);

    let invoked = 0;
    const accessor = valid();
    Object.defineProperty(accessor.data.series, '0', {
      configurable: true,
      enumerable: true,
      get() {
        invoked += 1;
        return { id: 'a', label: 'Spoof' };
      },
    });
    expect(snapshot(accessor)).toEqual(failure);
    expect(invoked).toBe(0);
  });

  it('rejects extra fields, extra symbols and invalid datasets', () => {
    const expanded = valid() as unknown as Record<string, unknown>;
    expanded.extra = true;
    expect(snapshot(expanded)).toEqual(failure);

    const extraSymbol = valid();
    Object.defineProperty(extraSymbol.data.rows[0].values, Symbol('hidden'), {
      value: 3,
    });
    expect(snapshot(extraSymbol)).toEqual(failure);

    const missing = valid();
    (missing.data.rows[0].values as unknown as Record<string, unknown>).b =
      undefined;
    expect(snapshot(missing)).toEqual(failure);

    const badX = valid();
    badX.data.rows[1].x = -1;
    expect(snapshot(badX)).toEqual(failure);
  });

  it('contains proxy exceptions including revoked and nested proxies', () => {
    const throwing = () => {
      throw new Error('untrusted trap');
    };
    expect(snapshot(new Proxy({}, { ownKeys: throwing }))).toEqual(failure);

    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(snapshot(revoked.proxy)).toEqual(failure);

    const nested = valid();
    (nested.data as { rows: unknown }).rows = new Proxy(
      nested.data.rows,
      { getOwnPropertyDescriptor: throwing }
    );
    expect(snapshot(nested)).toEqual(failure);
  });
});
