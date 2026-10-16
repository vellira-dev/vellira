import { describe, expect, it } from 'vitest';
import { validateBoundedNumericSeries as validate } from './numericSeriesValidation';

const dataset = () => ({
  series: [
    { id: 'revenue', label: 'Revenue' },
    { id: 'costs', label: 'Costs' },
  ],
  rows: [
    { x: -1, xLabel: 'Before', values: { revenue: 0, costs: null } },
    { x: 2, xLabel: 'After', values: { revenue: 42, costs: -3 } },
  ],
});

const rejected = (value: unknown, code: string) => {
  const result = validate(value);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe(code);
};

describe('bounded numeric series runtime validation', () => {
  it('accepts finite values, explicit gaps, and empty rows', () => {
    expect(validate(dataset()).ok).toBe(true);
    expect(validate({ series: [{ id: 'a', label: 'A' }], rows: [] }).ok).toBe(
      true
    );
  });

  it('does not modify valid consumer labels or rows', () => {
    const source = dataset();
    const result = validate(source);
    expect(result.ok).toBe(true);
    expect(source.rows[0].xLabel).toBe('Before');
  });

  it('rejects invalid outer shapes and extra properties', () => {
    rejected(null, 'invalid-dataset');
    rejected([], 'invalid-dataset');
    rejected({ ...dataset(), hidden: true }, 'invalid-dataset');
    rejected({ ...dataset(), rows: {} }, 'invalid-rows');
    rejected({ ...dataset(), series: [] }, 'invalid-series');
    rejected(
      { ...dataset(), series: new Array(5).fill({ id: 'a', label: 'A' }) },
      'invalid-series'
    );
    rejected(
      { ...dataset(), rows: new Array(91).fill(dataset().rows[0]) },
      'invalid-rows'
    );
  });

  it('rejects duplicate and unsafe IDs and equivalent labels', () => {
    rejected(
      { ...dataset(), series: [{ id: '__proto__', label: 'A' }] },
      'invalid-series-id'
    );
    rejected(
      { ...dataset(), series: [{ id: 'bad space', label: 'A' }] },
      'invalid-series-id'
    );
    rejected(
      {
        ...dataset(),
        series: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'B' },
        ],
      },
      'duplicate-series-id'
    );
    rejected(
      {
        ...dataset(),
        series: [
          { id: 'a', label: 'Revenue' },
          { id: 'b', label: 'revenue' },
        ],
      },
      'duplicate-series-label'
    );
    rejected(
      { ...dataset(), series: [{ id: 'a', label: '   ' }] },
      'invalid-series-label'
    );
    rejected(
      { ...dataset(), series: [{ id: 'a', label: 'a'.repeat(121) }] },
      'invalid-series-label'
    );
  });

  it('rejects non-finite or out-of-range and unordered x', () => {
    for (const x of [NaN, Infinity, -Infinity, 1e9 + 1, '2', null]) {
      const bad = dataset();
      (bad.rows[0] as { x: unknown }).x = x;
      rejected(bad, 'invalid-x');
    }
    const bad = dataset();
    bad.rows[1].x = -1;
    rejected(bad, 'non-increasing-x');
  });

  it('rejects malformed row labels and observation keys', () => {
    const badLabel = dataset();
    badLabel.rows[0].xLabel = ' \t ';
    rejected(badLabel, 'invalid-x-label');
    const absent = dataset() as unknown as {
      rows: Array<{ values: Record<string, unknown> }>;
    };
    delete absent.rows[0].values.costs;
    rejected(absent, 'series-key-mismatch');
    const extra = dataset() as unknown as {
      rows: Array<{ values: Record<string, unknown> }>;
    };
    extra.rows[0].values.extra = 7;
    rejected(extra, 'series-key-mismatch');
  });

  it('requires explicit null and finite, bounded numeric y observations', () => {
    for (const value of [undefined, NaN, Infinity, -Infinity, 1e12 + 1, '5']) {
      const bad = dataset() as unknown as {
        rows: Array<{ values: Record<string, unknown> }>;
      };
      bad.rows[0].values.costs = value;
      rejected(bad, 'invalid-y');
    }
  });

  it('rejects arrays, accessors and inherited data instead of evaluating them', () => {
    let called = false;
    const values = Object.defineProperty({ costs: null }, 'revenue', {
      enumerable: true,
      get() { called = true; return 4; },
    });
    const bad = dataset();
    (bad.rows[0] as { values: unknown }).values = values;
    rejected(bad, 'series-key-mismatch');
    expect(called).toBe(false);
    const inherited = Object.create({ revenue: 0, costs: null });
    (bad.rows[0] as { values: unknown }).values = inherited;
    rejected(bad, 'invalid-values');
  });
});
