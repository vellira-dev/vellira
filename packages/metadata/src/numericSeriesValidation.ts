import type { BoundedNumericSeries } from './numericSeries';

export type NumericSeriesValidationCode =
  | 'invalid-dataset'
  | 'invalid-series'
  | 'invalid-series-id'
  | 'duplicate-series-id'
  | 'invalid-series-label'
  | 'duplicate-series-label'
  | 'invalid-rows'
  | 'invalid-row'
  | 'invalid-x'
  | 'non-increasing-x'
  | 'invalid-x-label'
  | 'invalid-values'
  | 'series-key-mismatch'
  | 'invalid-y';

export type NumericSeriesValidationResult =
  | Readonly<{ ok: true; data: BoundedNumericSeries }>
  | Readonly<{ ok: false; code: NumericSeriesValidationCode; path: string }>;

const invalid = (
  code: NumericSeriesValidationCode,
  path: string
): NumericSeriesValidationResult => ({ ok: false, code, path });

const record = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const fields = (
  value: Record<string, unknown>,
  expected: readonly string[]
) => {
  const own = Reflect.ownKeys(value);
  return (
    own.length === expected.length &&
    expected.every(
      (key) =>
        Object.hasOwn(value, key) &&
        Object.getOwnPropertyDescriptor(value, key)?.get === undefined &&
        Object.getOwnPropertyDescriptor(value, key)?.set === undefined
    )
  );
};

const label = (value: unknown): value is string =>
  typeof value === 'string' &&
  Array.from(value).length >= 1 &&
  Array.from(value).length <= 120 &&
  /\S/u.test(value);

const finite = (value: unknown, limit: number): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  Math.abs(value) <= limit;

/**
 * Standalone proposed-data validator, NOT Component Program numeric grammar admission.
 * Full Unicode case-fold parity is not yet certified; this implementation rejects
 * obvious NFC / case-insensitive label collisions without claiming that parity.
 */
export function validateBoundedNumericSeries(
  input: unknown
): NumericSeriesValidationResult {
  if (!record(input) || !fields(input, ['series', 'rows']))
    return invalid('invalid-dataset', '$');
  const { series, rows } = input;
  if (!Array.isArray(series) || series.length < 1 || series.length > 4)
    return invalid('invalid-series', '$.series');
  if (!Array.isArray(rows) || rows.length > 90)
    return invalid('invalid-rows', '$.rows');

  const ids = new Set<string>();
  const labels = new Set<string>();
  for (let i = 0; i < series.length; i++) {
    const item: unknown = series[i];
    const path = `$.series[${i}]`;
    if (!record(item) || !fields(item, ['id', 'label']))
      return invalid('invalid-series', path);
    const { id, label: seriesLabel } = item;
    if (
      typeof id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(id) ||
      ['__proto__', 'prototype', 'constructor'].includes(id)
    )
      return invalid('invalid-series-id', `${path}.id`);
    if (ids.has(id)) return invalid('duplicate-series-id', `${path}.id`);
    ids.add(id);
    if (!label(seriesLabel))
      return invalid('invalid-series-label', `${path}.label`);
    const normalized = seriesLabel.normalize('NFC').toLowerCase();
    if (labels.has(normalized))
      return invalid('duplicate-series-label', `${path}.label`);
    labels.add(normalized);
  }

  let previousX = -Infinity;
  for (let i = 0; i < rows.length; i++) {
    const item: unknown = rows[i];
    const path = `$.rows[${i}]`;
    if (!record(item) || !fields(item, ['x', 'xLabel', 'values']))
      return invalid('invalid-row', path);
    const { x, xLabel, values } = item;
    if (!finite(x, 1e9)) return invalid('invalid-x', `${path}.x`);
    if (x <= previousX) return invalid('non-increasing-x', `${path}.x`);
    previousX = x;
    if (!label(xLabel)) return invalid('invalid-x-label', `${path}.xLabel`);
    if (!record(values)) return invalid('invalid-values', `${path}.values`);
    if (!fields(values, Array.from(ids)))
      return invalid('series-key-mismatch', `${path}.values`);
    for (const id of ids) {
      const value = values[id];
      if (value !== null && !finite(value, 1e12))
        return invalid('invalid-y', `${path}.values.${id}`);
    }
  }
  return { ok: true, data: input as BoundedNumericSeries };
}
