import { describe, expect, it } from 'vitest';

import { parseNumericSeriesBindingV1 as parse } from './numericSeriesBinding';

const data = () => ({
  series: [{ id: 'revenue', label: 'Revenue' }],
  rows: [{ x: 0, xLabel: '0', values: { revenue: null } }],
});
const valid = () => ({
  schemaVersion: '1',
  kind: 'bounded-numeric-series',
  data: data(),
});

describe('numeric binding envelope pre-admission', () => {
  it('accepts a versioned, bounded numeric dataset', () => {
    const result = parse(valid());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.schemaVersion).toBe('1');
      expect(result.value.data.rows[0].values.revenue).toBeNull();
    }
  });

  it('rejects unversioned, wrong-kind and widened envelopes', () => {
    expect(parse(data()).ok).toBe(false);
    expect(parse({ ...valid(), schemaVersion: '2' }).ok).toBe(false);
    expect(parse({ ...valid(), kind: 'arbitrary-json' }).ok).toBe(false);
    expect(parse({ ...valid(), extra: true }).ok).toBe(false);
  });

  it('delegates dataset validation without numeric coercion', () => {
    expect(
      parse({
        ...valid(),
        data: {
          ...data(),
          rows: [{ x: '0', xLabel: '0', values: { revenue: null } }],
        },
      }).ok
    ).toBe(false);
  });

  it('contains untrusted reflection errors without throwing', () => {
    const trap = () => {
      throw new Error('proxy trap');
    };
    const proxy = new Proxy({}, { ownKeys: trap });
    expect(parse(proxy)).toEqual({
      ok: false,
      code: 'invalid-binding',
      path: '$',
    });
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(parse(revoked.proxy).ok).toBe(false);
  });
});
