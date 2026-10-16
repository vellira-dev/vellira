/**
 * Type-only, proposed Web numeric data shape.
 *
 * The public Component Program does not yet compile numeric-data modules.
 * TypeScript shapes do not validate finite ranges, Unicode identifiers,
 * aligned own keys, or explicit null gaps at runtime.
 */
export type NumericSeries = Readonly<{
  id: string;
  label: string;
}>;

export type NumericSeriesRow = Readonly<{
  x: number;
  xLabel: string;
  values: Readonly<Record<string, number | null>>;
}>;

export type BoundedNumericSeries = Readonly<{
  series: readonly NumericSeries[];
  rows: readonly NumericSeriesRow[];
}>;
