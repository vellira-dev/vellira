import type { ComponentCatalogEntry } from '../types';

export const CANONICAL_COMPONENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CANONICAL_RELATED_COMPONENT_CONSTRAINTS = {
  relatedMustUseCanonicalSlug: true,
  relatedMustNotReferenceSelf: true,
  relatedMustBeUnique: true,
  relatedMustUseExactCase: true,
  relatedSlugFormat: 'lowercase-kebab-case',
} as const;

export function assertCanonicalComponentSlug(
  slug: unknown,
  context = 'component registry'
) {
  if (
    typeof slug !== 'string' ||
    !CANONICAL_COMPONENT_SLUG_PATTERN.test(slug)
  ) {
    throw new Error(
      `Invalid canonical component slug in ${context}: ${String(slug)}.`
    );
  }
}

export function canonicalComponentSlugsFromEntries(
  entries: readonly Pick<ComponentCatalogEntry, 'slug'>[]
) {
  if (entries.length === 0) {
    throw new Error('Canonical component registry is empty.');
  }

  const seen = new Set<string>();

  for (const entry of entries) {
    assertCanonicalComponentSlug(entry.slug);

    if (seen.has(entry.slug)) {
      throw new Error(
        `Duplicate canonical component slug in component registry: "${entry.slug}".`
      );
    }

    seen.add(entry.slug);
  }

  return [...seen].sort();
}
