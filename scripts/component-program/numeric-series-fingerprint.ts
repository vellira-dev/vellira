import { createHash } from 'node:crypto';

import {
  snapshotNumericSeriesBindingV1,
  type NumericSeriesSnapshotResultV1,
} from '../../packages/metadata/src/numericSeriesSnapshot';

export type NumericSeriesFingerprintResultV1 =
  | Readonly<{
      ok: true;
      value: Extract<NumericSeriesSnapshotResultV1, { ok: true }>['value'];
      canonicalJson: string;
      fingerprint: string;
    }>
  | Extract<NumericSeriesSnapshotResultV1, { ok: false }>;

/**
 * SHA-256 of the independently detached canonical UTF-8 wire string.
 * Node-only pre-admission tooling; not a Component Program compiler hook.
 */
export function fingerprintNumericSeriesBindingV1(
  input: unknown
): NumericSeriesFingerprintResultV1 {
  const result = snapshotNumericSeriesBindingV1(input);
  if (!result.ok) return result;
  const digest = createHash('sha256')
    .update(result.canonicalJson, 'utf8')
    .digest('hex');
  return {
    ok: true,
    value: result.value,
    canonicalJson: result.canonicalJson,
    fingerprint: 'numeric-series-binding-v1:sha256:' + digest,
  };
}
