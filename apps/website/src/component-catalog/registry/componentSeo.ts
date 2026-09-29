import type { ComponentCatalogEntry, ComponentPlatform } from '../types';
import { componentPages } from './componentPages';

/**
 * Internal quality floor for public search descriptions.
 *
 * Search engines do not publish a universal required character count. This
 * floor is deliberately conservative: it prevents placeholder-like snippets
 * while leaving the actual wording owned by Vellira product semantics.
 */
export const MIN_PUBLIC_META_DESCRIPTION_LENGTH = 72;

export const COMPONENTS_INDEX_META_DESCRIPTION =
  'Explore accessible, production-ready React and React Native components with Vellira, including examples, APIs, accessibility guidance, and cross-platform patterns.';

function getPlatformLabel(platforms: readonly ComponentPlatform[]) {
  const hasReact = platforms.includes('react');
  const hasNative = platforms.includes('react-native');

  if (hasReact && hasNative) return 'React and React Native';
  if (hasReact) return 'React';
  if (hasNative) return 'React Native';

  return 'supported platforms';
}

function getDiscoveryDescription(slug: string) {
  const pages = componentPages as Record<
    string,
    { discovery?: { description?: string } }
  >;

  return pages[slug]?.discovery?.description?.trim();
}

/**
 * Resolve the effective search description for a public component page.
 *
 * Discovery metadata is the stronger semantic authority when the component has
 * adopted Discovery Content V1. Legacy presentation copy remains a fallback
 * until #1136 migrates the whole catalog.
 */
export function getComponentMetaDescription(
  component: ComponentCatalogEntry
): string {
  const authoritative =
    getDiscoveryDescription(component.slug) ?? component.description.trim();

  if (authoritative.length >= MIN_PUBLIC_META_DESCRIPTION_LENGTH) {
    return authoritative;
  }

  return `${component.name} for ${getPlatformLabel(
    component.platforms
  )} with Vellira. ${authoritative}`;
}
