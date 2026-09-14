import type { ComponentMetadata } from '@vellira-ui/metadata';

import type {
  ComponentCatalogEntry,
  ComponentCatalogPresentationEntry,
} from '../types';

export function deriveComponentCatalogEntries(
  presentationEntries: readonly ComponentCatalogPresentationEntry[],
  metadataRegistry: readonly ComponentMetadata[]
): readonly ComponentCatalogEntry[] {
  const metadataByName = new Map(
    metadataRegistry.map((metadata) => [metadata.name, metadata])
  );
  const seenComponents = new Set<string>();

  return presentationEntries.map(({ component, ...presentation }) => {
    if (seenComponents.has(component)) {
      throw new Error(
        `Duplicate website catalog presentation for canonical component "${component}".`
      );
    }

    seenComponents.add(component);

    const metadata = metadataByName.get(component);

    if (!metadata) {
      throw new Error(
        `Website catalog component "${component}" has no canonical metadata.`
      );
    }

    return {
      ...presentation,
      status: metadata.status,
      platforms: metadata.platforms,
    };
  });
}
