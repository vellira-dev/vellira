import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getCatalogPreviewFindings } from './catalog-preview-contract';

function fixture(params: {
  catalogSlugs: readonly string[];
  legacySlugs?: readonly string[];
  generatedSlugs?: readonly string[];
}) {
  return getCatalogPreviewFindings({
    componentsRegistrySource: params.catalogSlugs
      .map((slug) => `  { slug: '${slug}' },`)
      .join('\n'),
    legacyPreviewSource: (params.legacySlugs ?? [])
      .map((slug) => `    case '${slug}':`)
      .join('\n'),
    generatedPreviewRegistrySource: `export const generatedCatalogPreviews = {\n${(
      params.generatedSlugs ?? []
    )
      .map((slug) => `  '${slug}': ExampleCatalogPreview,`)
      .join('\n')}\n};`,
  });
}

describe('catalog signature preview contract', () => {
  it('accepts exactly one preview per catalog component', () => {
    expect(
      fixture({
        catalogSlugs: ['button', 'accordion'],
        legacySlugs: ['button'],
        generatedSlugs: ['accordion'],
      })
    ).toEqual([]);
  });

  it('reports a missing signature preview', () => {
    expect(
      fixture({
        catalogSlugs: ['button', 'accordion'],
        legacySlugs: ['button'],
      })
    ).toContainEqual(
      expect.objectContaining({
        code: 'catalog-preview.missing',
        slug: 'accordion',
      })
    );
  });

  it('reports duplicate signature preview ownership', () => {
    expect(
      fixture({
        catalogSlugs: ['accordion'],
        legacySlugs: ['accordion'],
        generatedSlugs: ['accordion'],
      })
    ).toContainEqual(
      expect.objectContaining({
        code: 'catalog-preview.duplicate',
        slug: 'accordion',
      })
    );
  });

  it('keeps the maintained repository fully covered', () => {
    const root = process.cwd();
    const catalogRoot = path.join(
      root,
      'apps',
      'website',
      'src',
      'component-catalog'
    );

    expect(
      getCatalogPreviewFindings({
        componentsRegistrySource: fs.readFileSync(
          path.join(catalogRoot, 'registry', 'components.ts'),
          'utf8'
        ),
        legacyPreviewSource: fs.readFileSync(
          path.join(
            catalogRoot,
            'shared',
            'ComponentsCatalog',
            'ComponentCatalogPreview.tsx'
          ),
          'utf8'
        ),
        generatedPreviewRegistrySource: fs.readFileSync(
          path.join(catalogRoot, 'registry', 'generatedCatalogPreviews.ts'),
          'utf8'
        ),
      })
    ).toEqual([]);
  });
});
