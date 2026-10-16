import type { BoundedNumericSeries } from './numericSeries';
import { validateBoundedNumericSeries } from './numericSeriesValidation';

/**
 * Proposed serializable numeric binding envelope.
 * This is not a Component Program parameter or an admitted grammar module.
 */
export type NumericSeriesBindingEnvelopeV1 = Readonly<{
  schemaVersion: '1';
  kind: 'bounded-numeric-series';
  data: BoundedNumericSeries;
}>;

export type NumericSeriesBindingParseResult =
  | Readonly<{ ok: true; value: NumericSeriesBindingEnvelopeV1 }>
  | Readonly<{ ok: false; code: 'invalid-binding'; path: '$' }>;

export function parseNumericSeriesBindingV1(
  input: unknown
): NumericSeriesBindingParseResult {
  try {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      return { ok: false, code: 'invalid-binding', path: '$' };
    }
    const object = input as Record<string, unknown>;
    if (
      Object.getPrototypeOf(object) !== Object.prototype ||
      Reflect.ownKeys(object).length !== 3 ||
      !Object.hasOwn(object, 'schemaVersion') ||
      !Object.hasOwn(object, 'kind') ||
      !Object.hasOwn(object, 'data') ||
      Object.getOwnPropertyDescriptor(object, 'schemaVersion')?.get !==
        undefined ||
      Object.getOwnPropertyDescriptor(object, 'kind')?.get !== undefined ||
      Object.getOwnPropertyDescriptor(object, 'data')?.get !== undefined ||
      object.schemaVersion !== '1' ||
      object.kind !== 'bounded-numeric-series'
    ) {
      return { ok: false, code: 'invalid-binding', path: '$' };
    }
    const result = validateBoundedNumericSeries(object.data);
    if (!result.ok) return { ok: false, code: 'invalid-binding', path: '$' };
    return {
      ok: true,
      value: {
        schemaVersion: '1',
        kind: 'bounded-numeric-series',
        data: result.data,
      },
    };
  } catch {
    return { ok: false, code: 'invalid-binding', path: '$' };
  }
}
