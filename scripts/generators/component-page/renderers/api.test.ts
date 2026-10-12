import { describe, expect, it } from 'vitest';

import { getApiDefaultValue } from './api';

import type { ComponentPageMetadata } from '../metadata/metadata';
import type { ExtractedProp } from '../model/types';

const name: ExtractedProp = {
  name: 'name',
  kind: 'string',
  required: true,
  type: 'string',
  description: '',
};

const size: ExtractedProp = {
  name: 'size',
  kind: 'select',
  required: false,
  options: ['sm', 'md', 'lg'],
  type: "'sm' | 'md' | 'lg'",
  description: '',
};

describe('getApiDefaultValue', () => {
  const meta = {
    defaults: {
      shared: { name: 'Example User', size: 'md' },
      react: { size: 'sm' },
    },
  } satisfies ComponentPageMetadata;

  it('never labels required preview values as runtime defaults', () => {
    expect(getApiDefaultValue(name, meta, 'react')).toBeUndefined();
    expect(getApiDefaultValue(name, meta, 'react-native')).toBeUndefined();
  });

  it('keeps documented optional defaults scoped to the platform', () => {
    expect(getApiDefaultValue(size, meta, 'react')).toBe("'sm'");
    expect(getApiDefaultValue(size, meta, 'react-native')).toBe("'md'");
  });

  it('makes no claim without configured default metadata', () => {
    expect(getApiDefaultValue(size, {}, 'react')).toBeUndefined();
  });
});
