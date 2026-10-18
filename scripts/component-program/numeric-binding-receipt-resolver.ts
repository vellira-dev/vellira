import type { NumericSeriesBindingEnvelopeV1 } from '../../packages/metadata/src/numericSeriesBinding';
import { parseComponentProductionInput } from '../component-production/contracts';
import { captureComponentProgramInput } from './capture-input';
import { compileComponentProgram } from './compile';
import {
  prepareNumericBindingAuthorityV1,
  type NumericBindingAuthorityReceiptV1,
} from './numeric-binding-authority';
import { componentProgramSource } from './source';

export type NumericBindingReceiptResolutionV1 =
  | Readonly<{
      ok: true;
      schemaVersion: '1';
      disposition: 'review-required';
      grammarAdmitted: false;
      baseProgramFingerprint: string;
      resolved: readonly Readonly<{
        slotId: string;
        receipt: NumericBindingAuthorityReceiptV1;
        snapshot: NumericSeriesBindingEnvelopeV1;
        canonicalJson: string;
      }>[];
    }>
  | Readonly<{
      ok: false;
      code:
        | 'invalid-production-spec'
        | 'unsupported-platform'
        | 'missing-slots'
        | 'invalid-evidence'
        | 'base-program-not-compiled'
        | 'base-program-fingerprint-mismatch'
        | 'program-not-blocked'
        | 'missing-receipt'
        | 'invalid-binding'
        | 'dataset-mismatch'
        | 'receipt-mismatch';
      path: '$';
    }>;

type ErrorCode = Extract<
  NumericBindingReceiptResolutionV1,
  { ok: false }
>['code'];

const rejected = (code: ErrorCode): NumericBindingReceiptResolutionV1 =>
  Object.freeze({ ok: false, code, path: '$' });

const receiptKeys = [
  'schemaVersion',
  'disposition',
  'grammarAdmitted',
  'ownerName',
  'ownerPlatform',
  'ownerRootId',
  'bindingId',
  'sourceFingerprint',
  'programFingerprint',
  'bindingFingerprint',
  'authorityFingerprint',
] as const;

/** Only call after captureComponentProgramInput has detached the graph. */
function exactFields(
  value: unknown,
  fields: readonly string[]
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Reflect.ownKeys(value).length === fields.length &&
    fields.every((field) => Object.hasOwn(value, field))
  );
}

/**
 * Re-evaluate content identities for finite slots against independently
 * recomputed authority receipts. Never admits Numeric Grammar or Factory.
 *
 * Neither caller-provided receipts nor their hashes establish provenance.
 */
export function resolveNumericBindingReceiptsV1(
  productionInput: unknown,
  evidenceInput: unknown
): NumericBindingReceiptResolutionV1 {
  let production: ReturnType<typeof parseComponentProductionInput>;
  try {
    const detached = captureComponentProgramInput(productionInput);
    production = parseComponentProductionInput(detached);
  } catch {
    return rejected('invalid-production-spec');
  }
  if (production.platform !== 'web') return rejected('unsupported-platform');
  if (!production.componentProgram?.numericBindingSlots) {
    return rejected('missing-slots');
  }

  const { numericBindingSlots, ...baselineDecisions } =
    production.componentProgram;
  const source = componentProgramSource(production);
  const baseline = compileComponentProgram(source, baselineDecisions);
  if (
    baseline.disposition !== 'compiled' ||
    !baseline.program ||
    !baseline.fingerprint
  ) {
    return rejected('base-program-not-compiled');
  }
  if (numericBindingSlots.baseProgramFingerprint !== baseline.fingerprint) {
    return rejected('base-program-fingerprint-mismatch');
  }
  const denied = compileComponentProgram(
    source,
    production.componentProgram
  );
  if (
    denied.disposition !== 'missing-grammar-capability' ||
    denied.program !== null ||
    denied.fingerprint !== null
  ) {
    return rejected('program-not-blocked');
  }

  let entries: Record<string, unknown>[];
  try {
    const detached = captureComponentProgramInput(evidenceInput);
    const bytes = JSON.stringify(detached);
    if (
      typeof bytes !== 'string' ||
      Buffer.byteLength(bytes, 'utf8') > 524288 ||
      !exactFields(detached, ['schemaVersion', 'entries']) ||
      detached.schemaVersion !== '1' ||
      !Array.isArray(detached.entries) ||
      detached.entries.length !== numericBindingSlots.slots.length
    ) {
      return rejected('invalid-evidence');
    }
    entries = detached.entries.map((entry) => {
      if (
        !exactFields(entry, ['slotId', 'receipt', 'binding']) ||
        typeof entry.slotId !== 'string' ||
        !/^[a-z][a-z0-9-]{0,63}$/.test(entry.slotId) ||
        !exactFields(entry.receipt, receiptKeys)
      ) {
        throw new Error('Invalid numeric receipt entry.');
      }
      return entry;
    });
  } catch {
    return rejected('invalid-evidence');
  }

  // The resolver is intentionally order-independent for supplied evidence.
  // Output ordering follows the already verified finite slot declaration.
  const byId = new Map<string, Record<string, unknown>>();
  for (const entry of entries) {
    const id = entry.slotId as string;
    if (byId.has(id)) return rejected('invalid-evidence');
    byId.set(id, entry);
  }
  if (byId.size !== numericBindingSlots.slots.length) {
    return rejected('missing-receipt');
  }

  const baseProduction = {
    ...production,
    componentProgram: baselineDecisions,
  };
  const resolved: Extract<
    NumericBindingReceiptResolutionV1,
    { ok: true }
  >['resolved'][number][] = [];

  for (const slot of numericBindingSlots.slots) {
    const entry = byId.get(slot.id);
    if (!entry) return rejected('missing-receipt');
    const candidate = prepareNumericBindingAuthorityV1(baseProduction, {
      schemaVersion: '1',
      ownerName: production.componentName,
      bindingId: slot.id,
      expectedProgramFingerprint: baseline.fingerprint,
      expectedBindingFingerprint: slot.bindingFingerprint,
      binding: entry.binding,
    });
    if (!candidate.ok) {
      if (candidate.code === 'invalid-binding') {
        return rejected('invalid-binding');
      }
      if (candidate.code === 'binding-fingerprint-mismatch') {
        return rejected('dataset-mismatch');
      }
      return rejected('invalid-evidence');
    }

    const expected = candidate.receipt;
    const supplied = entry.receipt as Record<string, unknown>;
    if (
      expected.ownerRootId !== slot.ownerRootId ||
      expected.ownerPlatform !== slot.platform ||
      expected.authorityFingerprint !== slot.authorityFingerprint ||
      !receiptKeys.every((key) => supplied[key] === expected[key])
    ) {
      return rejected('receipt-mismatch');
    }
    resolved.push(
      Object.freeze({
        slotId: slot.id,
        receipt: expected,
        snapshot: candidate.snapshot,
        canonicalJson: candidate.canonicalJson,
      })
    );
  }

  return Object.freeze({
    ok: true,
    schemaVersion: '1',
    disposition: 'review-required',
    grammarAdmitted: false,
    baseProgramFingerprint: baseline.fingerprint,
    resolved: Object.freeze(resolved),
  });
}
