import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('component catalog preview contract', () => {
  it('gives every catalog component a curated or generated preview', () => {
    const catalog = read(
      'apps/website/src/component-catalog/registry/components.ts'
    );
    const curated = read(
      'apps/website/src/component-catalog/shared/ComponentsCatalog/ComponentCatalogPreview.tsx'
    );
    const generated = read(
      'apps/website/src/component-catalog/shared/ComponentsCatalog/generatedCatalogPreviews.tsx'
    );
    const slugs = [...catalog.matchAll(/slug: '([^']+)'/g)].map(
      (match) => match[1]
    );

    expect(slugs.length).toBeGreaterThan(0);

    for (const slug of slugs) {
      const hasCuratedPreview = curated.includes(`case '${slug}':`);
      const hasGeneratedPreview = generated.includes(
        `// component-catalog-preview:${slug}`
      );

      expect(
        Number(hasCuratedPreview) + Number(hasGeneratedPreview),
        `${slug} must have exactly one component catalog preview owner`
      ).toBe(1);
    }
  });

  it('fails closed instead of silently returning null for unknown previews', () => {
    const source = read(
      'apps/website/src/component-catalog/shared/ComponentsCatalog/ComponentCatalogPreview.tsx'
    );

    expect(source).not.toContain('default:\n      return null;');
    expect(source).toContain('Missing component catalog preview');
  });
});
