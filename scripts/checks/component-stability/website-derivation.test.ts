import fs from 'node:fs';
import path from 'node:path';

import { componentMetadata } from '@vellira-ui/metadata';
import { describe, expect, it } from 'vitest';

import { deriveComponentCatalogEntries } from '../../../apps/website/src/component-catalog/registry/deriveComponentCatalogEntries';
import { webComponents } from '../../../apps/website/src/component-catalog/registry/components';

describe('website lifecycle derivation', () => {
  it('derives lifecycle and platforms from canonical metadata', () => {
    for (const component of webComponents) {
      const canonical = componentMetadata.find(
        ({ name }) => name === component.name.replaceAll(' ', '')
      );
      expect(canonical, component.name).toBeDefined();
      expect(component.status).toBe(canonical?.status);
      expect(component.platforms).toEqual(canonical?.platforms);
    }

    expect(webComponents.find(({ slug }) => slug === 'accordion')?.status).toBe(
      'beta'
    );
    expect(webComponents.find(({ slug }) => slug === 'switch')?.status).toBe(
      'beta'
    );
  });

  it('rejects a website entry without canonical metadata', () => {
    expect(() =>
      deriveComponentCatalogEntries(
        [
          {
            component: 'Missing',
            slug: 'missing',
            name: 'Missing',
            description: 'Missing.',
            category: 'general',
            order: 1,
            docs: {},
          },
        ],
        componentMetadata
      )
    ).toThrow('has no canonical metadata');
  });

  it('keeps lifecycle and platform fields out of the presentation registry', () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        'apps/website/src/component-catalog/registry/components.ts'
      ),
      'utf8'
    );

    expect(source).not.toMatch(/^\s+status:/m);
    expect(source).not.toMatch(/^\s+platforms:/m);
  });
});
