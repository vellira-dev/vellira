import { inventoryWebsite, type LinkInventoryEntry } from './link-inventory';

export type LinkReviewStatus = 'confirmed-canonical' | 'needs-review';

export interface ClassifiedLink extends LinkInventoryEntry {
  reviewStatus: LinkReviewStatus;
  reason: string;
}

export function classifyLink(entry: LinkInventoryEntry): ClassifiedLink {
  if (entry.kind === 'canonical-link') {
    return {
      ...entry,
      reviewStatus: 'confirmed-canonical',
      reason: 'Canonical DesignSystemLink import',
    };
  }
  // Button asChild requires validation of the actual JSX prop value and child.
  // Import-only recognition is insufficient evidence of a valid composition.
  return {
    ...entry,
    reviewStatus: 'needs-review',
    reason:
      entry.kind === 'raw-anchor'
        ? 'Review whether this anchor is textual, structural, or owned by Button asChild'
        : entry.kind === 'next-link'
          ? 'Review Next Link semantics and structural role'
          : entry.kind === 'canonical-button'
            ? 'Verify asChild is enabled and wraps an appropriate navigable child'
            : 'Resolve imported/re-exported or local link wrapper',
  };
}

export function createClassificationReport(
  entries: readonly LinkInventoryEntry[]
) {
  const classified = entries.map(classifyLink);
  const needsReview = classified.filter(
    (entry) => entry.reviewStatus === 'needs-review'
  );
  return {
    schemaVersion: 1,
    policy: 'evidence-only',
    total: classified.length,
    confirmed: classified.length - needsReview.length,
    needsReview: needsReview.length,
    complete: needsReview.length === 0,
    entries: classified,
  };
}

if (process.argv[1]?.endsWith('link-classification.ts')) {
  const report = createClassificationReport(inventoryWebsite());
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
