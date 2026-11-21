import { describe, expect, it } from 'vitest';

import { reconcileLinkEvidence } from './link-evidence-reconciliation';
import { compositionReport } from './link-compositions';

describe('link evidence reconciliation (read-only)', () => {
  it('preserves the classifier verdict and inventories every pending entry', () => {
    const inventory = compositionReport();
    const report = reconcileLinkEvidence();
    expect(report.original).toEqual({
      total: inventory.total,
      confirmed: inventory.confirmed,
      needsReview: inventory.needsReview,
      complete: inventory.complete,
    });
    expect(report.rows).toHaveLength(inventory.needsReview);
    expect(report.referenced + report.unmapped).toBe(inventory.needsReview);
    expect(report.rows.every((row) => !row.runtimeVerified)).toBe(true);
  });

  it('links only existing, named source evidence without stale locations', () => {
    const report = reconcileLinkEvidence();
    expect(report.missingContracts).toEqual([]);
    expect(report.referenced).toBeGreaterThan(0);
    for (const row of report.rows) {
      if (row.status === 'evidence-referenced') {
        expect(row.evidence?.scope).toBe('source-contract');
        expect(row.evidence?.testTitle).toBeTruthy();
      } else {
        expect(row.evidence).toBeNull();
      }
    }
    expect(report.original.complete).toBe(false);
  });
});
