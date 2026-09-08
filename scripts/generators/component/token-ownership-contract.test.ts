import { componentMetadata } from '@vellira-ui/metadata';
import { describe, expect, it } from 'vitest';

import { componentTokenFamilyOwnershipV1 } from '../../../packages/tokens/src/token-ownership.js';

import { assertComponentTokenFamilyLifecycle } from './component-token-contract';

const toFamilyName = (componentName: string) =>
  `${componentName[0]?.toLowerCase() ?? ''}${componentName.slice(1)}`;

describe('Generator V2 token ownership authority', () => {
  it('keeps every current metadata-backed token family aligned with componentMetadata', () => {
    const metadataFamilies = componentMetadata
      .map((metadata) => toFamilyName(metadata.name))
      .sort();
    const currentMetadataFamilies = Object.entries(
      componentTokenFamilyOwnershipV1
    )
      .filter(
        ([, ownership]) =>
          ownership.lifecycle === 'current' &&
          ownership.owner === 'component-metadata'
      )
      .map(([family]) => family)
      .sort();

    expect(currentMetadataFamilies).toEqual(metadataFamilies);

    for (const metadata of componentMetadata) {
      const family = toFamilyName(metadata.name);
      const ownership =
        componentTokenFamilyOwnershipV1[
          family as keyof typeof componentTokenFamilyOwnershipV1
        ];

      expect(ownership, `${metadata.name} is missing token ownership`).toMatchObject({
        lifecycle: 'current',
        owner: 'component-metadata',
        metadataComponent: metadata.name,
      });
    }
  });

  it('does not invent ContextMenu metadata ownership', () => {
    expect(componentMetadata.map((metadata) => metadata.name)).not.toContain(
      'ContextMenu'
    );
    expect(componentTokenFamilyOwnershipV1.contextMenu).toMatchObject({
      lifecycle: 'deprecated',
      owner: 'tokens-compatibility',
      metadataComponent: null,
    });
  });

  it('allows Generator V2 to maintain current registered families', () => {
    expect(() =>
      assertComponentTokenFamilyLifecycle({
        componentName: 'Button',
        componentTokens: 'standard',
      })
    ).not.toThrow();
  });

  it('blocks Generator V2 from silently reviving deprecated families', () => {
    expect(() =>
      assertComponentTokenFamilyLifecycle({
        componentName: 'ContextMenu',
        componentTokens: 'standard',
      })
    ).toThrow(/component-token-family-not-current/);
  });

  it('does not block a genuinely new family before lifecycle registration exists', () => {
    expect(() =>
      assertComponentTokenFamilyLifecycle({
        componentName: 'FutureExample',
        componentTokens: 'standard',
      })
    ).not.toThrow();
  });
});
