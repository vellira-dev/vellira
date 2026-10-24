import { describe, expect, it } from 'vitest';

import { inventoryLinks } from './link-inventory';
import { createClassificationReport } from './link-classification';

describe('website link classification evidence', () => {
  it('fails closed on unknown wrappers and raw text links', () => {
    const entries = inventoryLinks(
      `import { DesignSystemLink } from '@/components/navigation/DesignSystemLink';
      const X = () => <><DesignSystemLink href='/'>OK</DesignSystemLink><a href='/'>Raw</a><CustomLink href='/'>Unknown</CustomLink></>;`,
      'apps/website/src/example.tsx'
    );
    const report = createClassificationReport(entries);
    expect(report).toMatchObject({ total: 3, confirmed: 1, needsReview: 2, complete: false });
    expect(report.entries.map((entry) => entry.reviewStatus)).toEqual([
      'confirmed-canonical',
      'needs-review',
      'needs-review',
    ]);
  });

  it('does not incorrectly certify Button asChild=false as canonical', () => {
    const entries = inventoryLinks(
      `import { Button } from '@vellira-ui/react';
      const X = () => <Button asChild={false}><a href='/'>Bad</a></Button>;`,
      'apps/website/src/example.tsx'
    );
    const report = createClassificationReport(entries);
    expect(report.complete).toBe(false);
    expect(report.needsReview).toBeGreaterThan(0);
  });

  it('produces deterministic empty evidence', () => {
    expect(createClassificationReport([])).toMatchObject({
      schemaVersion: 1,
      policy: 'evidence-only',
      total: 0,
      needsReview: 0,
      complete: true,
    });
  });
});
