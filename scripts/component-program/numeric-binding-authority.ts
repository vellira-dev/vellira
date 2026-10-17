import { createHash } from 'node:crypto';

import type { NumericSeriesBindingEnvelopeV1 } from '../../packages/metadata/src/numericSeriesBinding';
import { parseComponentProductionInput } from '../component-production/contracts';
import { compileComponentProgram, programDigest } from './compile';
import { fingerprintNumericSeriesBindingV1 } from './numeric-series-fingerprint';
import { componentProgramSource } from './source';

export type NumericBindingAuthorityRequestV1 = Readonly<{
  schemaVersion: '1';
  ownerName: string;
  bindingId: string;
  expectedProgramFingerprint: string;
  expectedBindingFingerprint: string;
  binding: NumericSeriesBindingEnvelopeV1;
}>;

export type NumericBindingAuthorityReceiptV1 = Readonly<{
  schemaVersion: '1';
  disposition: 'review-required';
  grammarAdmitted: false;
  ownerName: string;
  ownerPlatform: 'react';
  ownerRootId: string;
  bindingId: string;
  sourceFingerprint: string;
  programFingerprint: string;
  bindingFingerprint: string;
  authorityFingerprint: string;
}>;

export type NumericBindingAuthorityResultV1 =
  | Readonly<{
      ok: true;
      receipt: NumericBindingAuthorityReceiptV1;
      snapshot: NumericSeriesBindingEnvelopeV1;
      canonicalJson: string;
    }>
  | Readonly<{
      ok: false;
      code:
        | 'invalid-request'
        | 'invalid-production-spec'
        | 'unsupported-platform'
        | 'owner-mismatch'
        | 'program-not-compiled'
        | 'program-fingerprint-mismatch'
        | 'invalid-binding'
        | 'binding-fingerprint-mismatch';
      path: '$';
    }>;

type AuthorityFailureCode = Extract<
  NumericBindingAuthorityResultV1,
  { ok: false }
>['code'];

const rejected = (
  code: AuthorityFailureCode
): NumericBindingAuthorityResultV1 => ({
  ok: false,
  code,
  path: '$',
});

/** A request is an exact data-only record, never an arbitrary JSON escape hatch. */
function requestFields(input: unknown): Record<string, unknown> {
  if (
    input === null ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    throw new Error('Invalid authority request.');
  }
  const fields = [
    'schemaVersion',
    'ownerName',
    'bindingId',
    'expectedProgramFingerprint',
    'expectedBindingFingerprint',
    'binding',
  ];
  const own = Reflect.ownKeys(input);
  if (
    own.length !== fields.length ||
    !fields.every((key) => own.includes(key))
  ) {
    throw new Error('Invalid authority request fields.');
  }
  const result: Record<string, unknown> = Object.create(null);
  for (const key of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      throw new Error('Invalid authority request descriptor.');
    }
    result[key] = descriptor.value as unknown;
  }
  return result;
}

/**
 * Bind only identities to a previously reviewed Web Component Program source.
 * No numeric grammar, renderer, or production capability is admitted here.
 */
export function prepareNumericBindingAuthorityV1(
  productionInput: unknown,
  requestInput: unknown
): NumericBindingAuthorityResultV1 {
  let request: NumericBindingAuthorityRequestV1;
  try {
    const raw = requestFields(requestInput);
    if (
      raw.schemaVersion !== '1' ||
      typeof raw.ownerName !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9._-]{0,95}$/.test(raw.ownerName) ||
      typeof raw.bindingId !== 'string' ||
      !/^[a-z][a-z0-9-]{0,63}$/.test(raw.bindingId) ||
      typeof raw.expectedProgramFingerprint !== 'string' ||
      !/^component-program-v1:[a-f0-9]{64}$/.test(
        raw.expectedProgramFingerprint
      ) ||
      typeof raw.expectedBindingFingerprint !== 'string' ||
      !/^numeric-series-binding-v1:sha256:[a-f0-9]{64}$/.test(
        raw.expectedBindingFingerprint
      )
    ) {
      return rejected('invalid-request');
    }
    request = raw as unknown as NumericBindingAuthorityRequestV1;
  } catch {
    return rejected('invalid-request');
  }

  try {
    const production = parseComponentProductionInput(productionInput);
    if (production.platform !== 'web') return rejected('unsupported-platform');
    if (production.componentName !== request.ownerName) {
      return rejected('owner-mismatch');
    }
    if (!production.componentProgram) return rejected('program-not-compiled');

    // The source is derived from validated production input, not caller-authored
    // as a second mutable authority.
    const source = componentProgramSource(production);
    const compiled = compileComponentProgram(
      source,
      production.componentProgram
    );
    if (
      compiled.disposition !== 'compiled' ||
      !compiled.program ||
      !compiled.fingerprint
    ) {
      return rejected('program-not-compiled');
    }
    if (compiled.fingerprint !== request.expectedProgramFingerprint) {
      return rejected('program-fingerprint-mismatch');
    }

    const binding = fingerprintNumericSeriesBindingV1(request.binding);
    if (!binding.ok) return rejected('invalid-binding');
    if (binding.fingerprint !== request.expectedBindingFingerprint) {
      return rejected('binding-fingerprint-mismatch');
    }

    const root = compiled.program.decisions.anatomy.find(
      (item) => item.parent === null && item.role === 'root'
    );
    if (!root) return rejected('program-not-compiled');

    const receiptFields = Object.freeze({
      schemaVersion: '1' as const,
      disposition: 'review-required' as const,
      grammarAdmitted: false as const,
      ownerName: production.componentName,
      ownerPlatform: 'react' as const,
      ownerRootId: root.id,
      bindingId: request.bindingId,
      sourceFingerprint: programDigest(
        'component-program-source-v1',
        compiled.program.source
      ),
      programFingerprint: compiled.fingerprint,
      bindingFingerprint: binding.fingerprint,
    });
    const digest = createHash('sha256')
      .update(JSON.stringify(receiptFields), 'utf8')
      .digest('hex');
    const receipt = Object.freeze({
      ...receiptFields,
      authorityFingerprint: 'numeric-binding-authority-v1:sha256:' + digest,
    });
    return Object.freeze({
      ok: true as const,
      receipt,
      snapshot: binding.value,
      canonicalJson: binding.canonicalJson,
    });
  } catch {
    return rejected('invalid-production-spec');
  }
}
