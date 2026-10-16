import { describe, expect, it } from 'vitest';

import {
  fingerprintNumericSeriesBindingV1 as fingerprint,
} from './numeric-series-fingerprint';

const simple = () => ({
  schemaVersion: '1',
  kind: 'bounded-numeric-series',
  data: {
    series: [{ id: 'a', label: 'A' }],
    rows: [{ x: 0, xLabel: 'zero', values: { a: null } }],
  },
});

describe('numeric series canonical fingerprint (pre-admission)', () => {
  it('matches an independent fixed UTF-8 SHA-256 golden vector', () => {
    const result = fingerprint(simple());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.canonicalJson).toBe(
      '{"schemaVersion":"1","kind":"bounded-numeric-series","data":{"series":[{"id":"a","label":"A"}],"rows":[{"x":0,"xLabel":"zero","values":{"a":null}}]}}'
    );
    expect(result.fingerprint).toBe(
      'numeric-series-binding-v1:sha256:a54740928d96236996648d0f4b153ee61549dee12f0a5b6571151ab5d40ace46'
    );
  });

  it('preserves declared series key order, including integer-like IDs', () => {
    const left = {
      schemaVersion: '1',
      kind: 'bounded-numeric-series',
      data: {
        series: [
          { id: '10', label: 'Ten' },
          { id: '2', label: 'Two' },
        ],
        rows: [{ x: 0, xLabel: 'zero', values: { '2': null, '10': 9 } }],
      },
    };
    const right = {
      ...left,
      data: {
        ...left.data,
        rows: [{ x: 0, xLabel: 'zero', values: { '10': 9, '2': null } }],
      },
    };
    const a = fingerprint(left);
    const b = fingerprint(right);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.canonicalJson).toContain('"values":{"10":9,"2":null}');
  });

  it('distinguishes missing observations and semantic series changes', () => {
    const empty = fingerprint(simple());
    const observed = simple();
    (observed.data.rows[0].values as Record<string, unknown>).a = 0;
    const withZero = fingerprint(observed);
    const renamed = simple();
    renamed.data.series[0].label = 'Different';
    const withRename = fingerprint(renamed);
    expect(empty.ok && withZero.ok && withRename.ok).toBe(true);
    if (!empty.ok || !withZero.ok || !withRename.ok) return;
    expect(empty.fingerprint).not.toBe(withZero.fingerprint);
    expect(empty.fingerprint).not.toBe(withRename.fingerprint);
  });

  it('does not change a completed fingerprint after caller mutation', () => {
    const original = simple();
    const result = fingerprint(original);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const before = result.fingerprint;

    original.data.series[0].label = 'Mutated';
    original.data.rows[0].x = 999;
    const changed = fingerprint(original);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;

    expect(before).toBe(
      'numeric-series-binding-v1:sha256:a54740928d96236996648d0f4b153ee61549dee12f0a5b6571151ab5d40ace46'
    );
    expect(changed.fingerprint).not.toBe(before);
    expect(result.value.data.series[0].label).toBe('A');
  });

  it('refuses arbitrary object fingerprinting', () => {
    const object = { ...simple(), arbitrary: { executable: true } };
    expect(fingerprint(object)).toEqual({
      ok: false,
      code: 'invalid-snapshot',
      path: '$',
    });
  });
});
