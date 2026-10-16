import type { BoundedNumericSeries } from './numericSeries';
import {
  parseNumericSeriesBindingV1,
  type NumericSeriesBindingEnvelopeV1,
} from './numericSeriesBinding';

export type NumericSeriesImmutableSnapshotV1 = Readonly<{
  value: NumericSeriesBindingEnvelopeV1;
  canonicalJson: string;
}>;

export type NumericSeriesSnapshotResultV1 =
  | Readonly<{ ok: true } & NumericSeriesImmutableSnapshotV1>
  | Readonly<{ ok: false; code: 'invalid-snapshot'; path: '$' }>;

const rejected = (): NumericSeriesSnapshotResultV1 => ({
  ok: false,
  code: 'invalid-snapshot',
  path: '$',
});

/**
 * Capture only own, enumerable data descriptors. Never invoke source getters,
 * setters or toJSON. Reflection traps can throw; the public boundary catches.
 */
function ownData(
  input: unknown,
  keys: readonly string[],
  requireObjectPrototype = false
): unknown[] {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid record.');
  }
  const prototype: unknown = Object.getPrototypeOf(input);
  if (
    prototype !== Object.prototype &&
    (requireObjectPrototype || prototype !== null)
  ) {
    throw new Error('Unsupported record prototype.');
  }
  const names = Reflect.ownKeys(input);
  if (names.length !== keys.length || !keys.every((key) => names.includes(key))) {
    throw new Error('Unexpected record keys.');
  }
  return keys.map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      throw new Error('Accessor or missing record field.');
    }
    return descriptor.value as unknown;
  });
}

/** Reject sparse arrays, accessors, array subclasses and extra own keys. */
function denseArray(input: unknown, minimum: number, maximum: number): unknown[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) {
    throw new Error('Invalid array.');
  }
  const length = Object.getOwnPropertyDescriptor(input, 'length')?.value as unknown;
  if (
    typeof length !== 'number' ||
    !Number.isSafeInteger(length) ||
    length < minimum ||
    length > maximum ||
    Reflect.ownKeys(input).length !== length + 1
  ) {
    throw new Error('Unbounded or extended array.');
  }
  const copy: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      throw new Error('Sparse or accessor array element.');
    }
    copy.push(descriptor.value as unknown);
  }
  return copy;
}

const zero = (value: unknown): unknown =>
  typeof value === 'number' && Object.is(value, -0) ? 0 : value;

/**
 * Canonical wire representation with fixed field order and declared series
 * key order, not host object enumeration order. Only detached primitives enter.
 */
function canonicalNumericJson(value: NumericSeriesBindingEnvelopeV1): string {
  const { series, rows } = value.data;
  const seriesJson = series
    .map(
      (item) =>
        '{"id":' +
        JSON.stringify(item.id) +
        ',"label":' +
        JSON.stringify(item.label) +
        '}'
    )
    .join(',');
  const rowsJson = rows
    .map((row) => {
      const valuesJson = series
        .map(
          (item) =>
            JSON.stringify(item.id) + ':' + JSON.stringify(row.values[item.id])
        )
        .join(',');
      return (
        '{"x":' +
        JSON.stringify(row.x) +
        ',"xLabel":' +
        JSON.stringify(row.xLabel) +
        ',"values":{' +
        valuesJson +
        '}}'
      );
    })
    .join(',');
  return (
    '{"schemaVersion":"1","kind":"bounded-numeric-series","data":{"series":[' +
    seriesJson +
    '],"rows":[' +
    rowsJson +
    ']}}'
  );
}

/**
 * Isolated pre-admission snapshot; no Component Program/Factory/Chart activation.
 * Copies the bounded graph before validation, freezes every copy and emits
 * canonical bytes without calling any input object's JSON serializer.
 */
export function snapshotNumericSeriesBindingV1(
  input: unknown
): NumericSeriesSnapshotResultV1 {
  try {
    const [version, kind, rawData] = ownData(
      input,
      ['schemaVersion', 'kind', 'data'],
      true
    );
    if (version !== '1' || kind !== 'bounded-numeric-series') return rejected();

    const [rawSeries, rawRows] = ownData(rawData, ['series', 'rows']);
    const series = denseArray(rawSeries, 1, 4).map((entry) => {
      const [id, label] = ownData(entry, ['id', 'label']);
      return { id, label };
    });
    const ids = series.map(({ id }) => {
      if (typeof id !== 'string') throw new Error('Invalid series ID.');
      return id;
    });
    const rows = denseArray(rawRows, 0, 90).map((entry) => {
      const [x, xLabel, rawValues] = ownData(entry, [
        'x',
        'xLabel',
        'values',
      ]);
      const captured = ownData(rawValues, ids);
      const values: Record<string, unknown> = Object.create(null);
      ids.forEach((id, index) => {
        values[id] = zero(captured[index]);
      });
      return { x: zero(x), xLabel, values };
    });
    const data = { series, rows };
    const parsed = parseNumericSeriesBindingV1({
      schemaVersion: '1',
      kind: 'bounded-numeric-series',
      data,
    });
    if (!parsed.ok) return rejected();

    // Only newly allocated records are frozen; no user-owned object is frozen.
    for (const item of series) Object.freeze(item);
    for (const row of rows) {
      Object.freeze(row.values);
      Object.freeze(row);
    }
    Object.freeze(series);
    Object.freeze(rows);
    Object.freeze(data);
    const value = Object.freeze({
      schemaVersion: '1' as const,
      kind: 'bounded-numeric-series' as const,
      data: parsed.value.data as BoundedNumericSeries,
    });
    return { ok: true, value, canonicalJson: canonicalNumericJson(value) };
  } catch {
    return rejected();
  }
}
