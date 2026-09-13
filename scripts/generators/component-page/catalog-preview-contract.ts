export type CatalogPreviewFindingCode =
  | 'catalog-preview.missing'
  | 'catalog-preview.duplicate'
  | 'catalog-preview.orphan';

export type CatalogPreviewFinding = {
  code: CatalogPreviewFindingCode;
  slug: string;
  message: string;
};

function collectMatches(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function collectGeneratedPreviewSlugs(source: string) {
  return [...
    source.matchAll(
      /^\s{2}(?:([A-Za-z_$][\w$]*)|'([^']+)'|"([^"]+)"):\s+[A-Za-z_$][\w$]*CatalogPreview,/gm
    ),
  ].map((match) => match[1] ?? match[2] ?? match[3]);
}

function countBySlug(slugs: readonly string[]) {
  const counts = new Map<string, number>();

  for (const slug of slugs) {
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  return counts;
}

export function getCatalogPreviewFindings(params: {
  componentsRegistrySource: string;
  legacyPreviewSource: string;
  generatedPreviewRegistrySource: string;
}): CatalogPreviewFinding[] {
  const catalogSlugs = collectMatches(
    params.componentsRegistrySource,
    /\bslug:\s*['"]([^'"]+)['"]/g
  );
  const legacyPreviewSlugs = collectMatches(
    params.legacyPreviewSource,
    /\bcase\s+['"]([^'"]+)['"]\s*:/g
  );
  const generatedPreviewSlugs = collectGeneratedPreviewSlugs(
    params.generatedPreviewRegistrySource
  );
  const catalogSlugSet = new Set(catalogSlugs);
  const previewCounts = countBySlug([
    ...legacyPreviewSlugs,
    ...generatedPreviewSlugs,
  ]);
  const findings: CatalogPreviewFinding[] = [];

  for (const slug of catalogSlugs) {
    const count = previewCounts.get(slug) ?? 0;

    if (count === 0) {
      findings.push({
        code: 'catalog-preview.missing',
        slug,
        message: `Catalog component "${slug}" has no signature preview.`,
      });
    } else if (count > 1) {
      findings.push({
        code: 'catalog-preview.duplicate',
        slug,
        message: `Catalog component "${slug}" has ${count} signature previews; expected exactly one.`,
      });
    }
  }

  for (const [slug, count] of previewCounts) {
    if (!catalogSlugSet.has(slug)) {
      findings.push({
        code: 'catalog-preview.orphan',
        slug,
        message: `Signature preview "${slug}" is not registered in the component catalog.`,
      });
    }

    if (count > 1 && !catalogSlugSet.has(slug)) {
      findings.push({
        code: 'catalog-preview.duplicate',
        slug,
        message: `Orphan signature preview "${slug}" is registered ${count} times.`,
      });
    }
  }

  return findings.sort(
    (left, right) =>
      left.slug.localeCompare(right.slug) || left.code.localeCompare(right.code)
  );
}
