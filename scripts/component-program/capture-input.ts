/**
 * Capture an untrusted Component Program as descriptor-only JSON data.
 *
 * A raw JSON.stringify call can execute getters/toJSON and mutate away an
 * unadmitted numericBindingSlots proposal before the compiler checks it.
 * Snapshot first; only the detached graph may be sized or interpreted.
 */
export function captureComponentProgramInput(value: unknown): unknown {
  const ancestors = new Set<object>();
  let visited = 0;

  function copy(input: unknown, depth: number): unknown {
    visited += 1;
    if (visited > 8192 || depth > 32) {
      throw new Error('Component Program input exceeds capture bounds.');
    }
    if (
      input === null ||
      input === undefined ||
      typeof input === 'string' ||
      typeof input === 'boolean'
    ) {
      return input;
    }
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) {
        throw new Error('Non-finite Component Program number.');
      }
      return input;
    }
    if (typeof input !== 'object') {
      throw new Error('Unsupported Component Program data value.');
    }
    if (ancestors.has(input)) {
      throw new Error('Cyclic Component Program data.');
    }

    ancestors.add(input);
    try {
      const prototype: unknown = Object.getPrototypeOf(input);
      if (Array.isArray(input)) {
        if (prototype !== Array.prototype) {
          throw new Error('Unsupported Component Program array prototype.');
        }
        const lengthDescriptor = Object.getOwnPropertyDescriptor(
          input,
          'length'
        );
        const length: unknown = lengthDescriptor?.value;
        if (
          typeof length !== 'number' ||
          !Number.isSafeInteger(length) ||
          length > 8192 ||
          Reflect.ownKeys(input).length !== length + 1
        ) {
          throw new Error('Invalid Component Program array.');
        }

        const values: unknown[] = [];
        for (let index = 0; index < length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(
            input,
            String(index)
          );
          if (
            !descriptor ||
            !descriptor.enumerable ||
            !('value' in descriptor)
          ) {
            throw new Error('Sparse or accessor Component Program array.');
          }
          values.push(copy(descriptor.value as unknown, depth + 1));
        }
        return values;
      }

      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error('Unsupported Component Program object prototype.');
      }
      const keys = Reflect.ownKeys(input);
      if (keys.length > 8192) {
        throw new Error('Too many Component Program fields.');
      }
      const result: Record<string, unknown> = Object.create(null);
      for (const key of keys) {
        if (typeof key !== 'string') {
          throw new Error('Symbol Component Program field.');
        }
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new Error('Hidden or accessor Component Program field.');
        }
        result[key] = copy(descriptor.value as unknown, depth + 1);
      }
      return result;
    } finally {
      ancestors.delete(input);
    }
  }

  return copy(value, 0);
}
