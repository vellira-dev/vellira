import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  BoundedNumericSeries,
  NumericSeries,
  NumericSeriesRow,
} from './numericSeries';

describe('proposed numeric series type contract', () => {
  it('keeps descriptor, row and nullable numeric value identities explicit', () => {
    expectTypeOf<NumericSeries>().toEqualTypeOf<
      Readonly<{ id: string; label: string }>
    >();
    expectTypeOf<NumericSeriesRow>().toEqualTypeOf<
      Readonly<{
        x: number;
        xLabel: string;
        values: Readonly<Record<string, number | null>>;
      }>
    >();
    expectTypeOf<BoundedNumericSeries>().toEqualTypeOf<
      Readonly<{
        series: readonly NumericSeries[];
        rows: readonly NumericSeriesRow[];
      }>
    >();
  });

  it('keeps explicit null rather than treating missing as a numeric value', () => {
    const dataset: BoundedNumericSeries = {
      series: [{ id: 'income', label: 'Income' }],
      rows: [
        { x: 0, xLabel: 'First', values: { income: 0 } },
        { x: 1, xLabel: 'Second', values: { income: null } },
      ],
    };

    expect(dataset.rows[0].values.income).toBe(0);
    expect(dataset.rows[1].values.income).toBeNull();
    expectTypeOf<NumericSeriesRow['values'][string]>().toEqualTypeOf<
      number | null
    >();
  });

  it('rejects mutable arrays and string cells at TypeScript check time', () => {
    const dataset: BoundedNumericSeries = {
      series: [{ id: 'income', label: 'Income' }],
      rows: [{ x: 0, xLabel: 'First', values: { income: 0 } }],
    };

    if (false) {
      // @ts-expect-error Rows are read-only.
      dataset.rows.push({ x: 1, xLabel: 'Second', values: { income: 1 } });
      // @ts-expect-error A value is a number or explicit null, never a string.
      dataset.rows[0].values.income = '1';
      // @ts-expect-error Row coordinates are read-only.
      dataset.rows[0].x = 1;
    }
    expect(dataset.rows).toHaveLength(1);
  });
});
