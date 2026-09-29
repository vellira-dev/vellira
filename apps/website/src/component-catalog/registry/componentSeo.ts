import type { ComponentCatalogEntry, ComponentPlatform } from '../types';
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

/**
 * Resolve the effective search description for a public component page.
 *
 * Component presentation is the runtime projection used by the public catalog.
 * Generator/discovery alignment is enforced statically so this resolver never
 * imports the heavyweight page registry (and therefore never pulls React Native
 * runtime modules into metadata-only tooling).
 */
export function getComponentMetaDescription(
  component: ComponentCatalogEntry
): string {
  const description = component.description.trim();

  if (description.length >= MIN_PUBLIC_META_DESCRIPTION_LENGTH) {
    return description;
  }

  return `${component.name} for ${getPlatformLabel(
    component.platforms
  )} with Vellira. ${description}`;
}
