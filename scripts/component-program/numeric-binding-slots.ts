import type { ComponentProgramNumericBindingSlotsV1 } from '../../packages/metadata/src/componentProgram';

const slotKeys = [
  'id',
  'kind',
  'platform',
  'ownerRootId',
  'bindingFingerprint',
  'authorityFingerprint',
] as const;

/** Capture only exact own enumerable data fields; never evaluate getters. */
function exactRecord(value: unknown, keys: readonly string[]): unknown[] {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error('Invalid record.');
  }
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || !keys.every((key) => own.includes(key))) {
    throw new Error('Unknown record fields.');
  }
  return keys.map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      throw new Error('Invalid record descriptor.');
    }
    return descriptor.value as unknown;
  });
}

/** Require dense ordinary arrays with no extra keys or getter elements. */
function finiteSlots(value: unknown): unknown[] {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    throw new Error('Invalid slot array.');
  }
  const length: unknown = Object.getOwnPropertyDescriptor(
    value,
    'length'
  )?.value;
  if (
    typeof length !== 'number' ||
    !Number.isSafeInteger(length) ||
    length < 1 ||
    length > 4 ||
    Reflect.ownKeys(value).length !== length + 1
  ) {
    throw new Error('Invalid slot count.');
  }
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      throw new Error('Sparse or accessor slot.');
    }
    result.push(descriptor.value as unknown);
  }
  return result;
}

/**
 * Proposed references only; this parser never admits numeric semantics.
 * Full receipt/source verification remains in the review-only preflight.
 */
export function parseComponentProgramNumericBindingSlotsV1(
  input: unknown
): ComponentProgramNumericBindingSlotsV1 {
  try {
    const [schemaVersion, baseProgramFingerprint, sourceSlots] = exactRecord(
      input,
      ['schemaVersion', 'baseProgramFingerprint', 'slots']
    );
    if (
      schemaVersion !== '1' ||
      typeof baseProgramFingerprint !== 'string' ||
      !/^component-program-v1:[a-f0-9]{64}$/.test(baseProgramFingerprint)
    ) {
      throw new Error('Invalid numeric slot version or base identity.');
    }

    const ids = new Set<string>();
    const authorities = new Set<string>();
    const slots = finiteSlots(sourceSlots).map((item) => {
      const [
        id,
        kind,
        platform,
        ownerRootId,
        bindingFingerprint,
        authorityFingerprint,
      ] = exactRecord(item, slotKeys);
      if (
        typeof id !== 'string' ||
        !/^[a-z][a-z0-9-]{0,63}$/.test(id) ||
        kind !== 'bounded-numeric-series' ||
        platform !== 'react' ||
        typeof ownerRootId !== 'string' ||
        !/^[A-Za-z][A-Za-z0-9._-]{0,95}$/.test(ownerRootId) ||
        typeof bindingFingerprint !== 'string' ||
        !/^numeric-series-binding-v1:sha256:[a-f0-9]{64}$/.test(
          bindingFingerprint
        ) ||
        typeof authorityFingerprint !== 'string' ||
        !/^numeric-binding-authority-v1:sha256:[a-f0-9]{64}$/.test(
          authorityFingerprint
        ) ||
        ids.has(id) ||
        authorities.has(authorityFingerprint)
      ) {
        throw new Error('Invalid or conflicting numeric slot.');
      }
      ids.add(id);
      authorities.add(authorityFingerprint);
      return Object.freeze({
        id,
        kind,
        platform,
        ownerRootId,
        bindingFingerprint,
        authorityFingerprint,
      });
    });

    return Object.freeze({
      schemaVersion: '1',
      baseProgramFingerprint,
      slots: Object.freeze(slots),
    });
  } catch {
    throw new Error('Invalid Numeric Binding Slots V1.');
  }
}
