import {
  componentMetadata,
  componentTokenLifecycle,
  getComponentTokenLifecycle,
} from '@vellira-ui/metadata';
import { describe, expect, it } from 'vitest';

import {
  assertComponentTokenLifecycleCanMaterialize,
  needsComponentTokenLifecycleMutation,
} from './token-lifecycle-contract';

describe('Generator V2 token ownership authority', () => {
  it('keeps every current metadata-backed token family aligned with componentMetadata', () => {
    const metadataNames = componentMetadata
      .map((metadata) => metadata.name)
      .sort();
    const currentMetadataOwners = Object.entries(componentTokenLifecycle)
      .filter(
        ([, lifecycle]) => lifecycle.status === 'current' && lifecycle.public
      )
      .map(([name]) => name)
      .sort();

    expect(currentMetadataOwners).toEqual(metadataNames);

    for (const metadata of componentMetadata) {
      expect(getComponentTokenLifecycle(metadata.name)).toMatchObject({
        status: 'current',
        public: true,
        owner: metadata.name,
      });
    }
  });

  it('does not invent ContextMenu metadata ownership', () => {
    expect(componentMetadata.map((metadata) => metadata.name)).not.toContain(
      'ContextMenu'
    );
    expect(getComponentTokenLifecycle('ContextMenu')).toMatchObject({
      status: 'deprecated',
      public: true,
      owner: 'token-compatibility',
    });
  });

  it('allows Generator V2 to maintain current registered families', () => {
    expect(() =>
      assertComponentTokenLifecycleCanMaterialize('Button')
    ).not.toThrow();
    expect(needsComponentTokenLifecycleMutation('Button')).toBe(false);
  });

  it('blocks Generator V2 from silently reviving deprecated families', () => {
    expect(() =>
      assertComponentTokenLifecycleCanMaterialize('ContextMenu')
    ).toThrow(/deprecated-component-token-family/);
  });

  it('fails closed for an unregistered future family', () => {
    expect(getComponentTokenLifecycle('FutureExample')).toBeUndefined();
    expect(needsComponentTokenLifecycleMutation('FutureExample')).toBe(false);
    expect(() =>
      assertComponentTokenLifecycleCanMaterialize('FutureExample')
    ).toThrow(/unregistered-component-token-family/);
  });
});
