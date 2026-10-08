import { describe, expect, it } from 'vitest';

import type { ComponentPageMetadata } from '../metadata/metadata';
import type { ExtractedProp } from '../model/types';
import {
  buildRequiredDefaultProps,
  mergeRequiredDefaultProps,
  withRequiredCatalogPreviewDefaults,
} from './required-default-props';

function prop(
  name: string,
  required: boolean,
  kind: ExtractedProp['kind'] = 'string'
): ExtractedProp {
  if (kind === 'select') {
    return {
      name,
      required,
      kind,
      type: "'sm' | 'md' | 'lg'",
      description: '',
      options: ['sm', 'md', 'lg'],
    };
  }

  return {
    name,
    required,
    kind,
    type: kind === 'boolean' ? 'boolean' : kind === 'number' ? 'number' : 'string',
    description: '',
  };
}

describe('required default props', () => {
  it('projects only required API props with declared defaults', () => {
    const componentConfig: ComponentPageMetadata = {
      defaults: {
        shared: {
          fallback: 'JD',
          name: 'Jordan Diaz',
          size: 'md',
        },
      },
    };

    expect(
      buildRequiredDefaultProps({
        componentConfig,
        platform: 'react',
        apiProps: [
          prop('fallback', true),
          prop('name', true),
          prop('size', false, 'select'),
        ],
      })
    ).toEqual(["fallback='JD'", "name='Jordan Diaz'"]);
  });

  it('uses platform defaults over shared defaults', () => {
    const componentConfig: ComponentPageMetadata = {
      defaults: {
        shared: { name: 'Shared name' },
        native: { name: 'Native name' },
      },
    };

    expect(
      buildRequiredDefaultProps({
        componentConfig,
        platform: 'react-native',
        apiProps: [prop('name', true)],
      })
    ).toEqual(["name='Native name'"]);
  });

  it('lets explicit props override required defaults', () => {
    expect(
      mergeRequiredDefaultProps(
        ["fallback='JD'", "name='Jordan Diaz'"],
        ["name='Ada Lovelace'", "size='lg'"]
      )
    ).toEqual(["fallback='JD'", "name='Ada Lovelace'", "size='lg'"]);
  });

  it('adds required defaults to catalog preview metadata without replacing explicit props', () => {
    expect(
      withRequiredCatalogPreviewDefaults(
        { props: ["name='Ada Lovelace'", "size='lg'"] },
        ["fallback='JD'", "name='Jordan Diaz'"]
      )
    ).toEqual({
      props: ["fallback='JD'", "name='Ada Lovelace'", "size='lg'"],
    });
  });
});
