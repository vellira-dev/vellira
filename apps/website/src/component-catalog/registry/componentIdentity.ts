import { canonicalComponentSlugsFromEntries } from './canonicalComponentSlugs';
import { webComponents } from './components';

export {
  CANONICAL_COMPONENT_SLUG_PATTERN,
  CANONICAL_RELATED_COMPONENT_CONSTRAINTS,
} from './canonicalComponentSlugs';
export {
  assertCanonicalComponentSlug,
  canonicalComponentSlugsFromEntries,
} from './canonicalComponentSlugs';

export const canonicalComponentSlugs =
  canonicalComponentSlugsFromEntries(webComponents);

export const canonicalComponentSlugSet = new Set<string>(
  canonicalComponentSlugs
);

export function isCanonicalComponentSlug(slug: string) {
  return canonicalComponentSlugSet.has(slug);
}
