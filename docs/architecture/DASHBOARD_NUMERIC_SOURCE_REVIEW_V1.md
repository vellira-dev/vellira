# Dashboard Numeric Source V1 — proposed review-only source

**Status:** public Draft source proposal for exercising authenticated Numeric Source + Receipt Proof. **Not** a LineChart, BarChart, Dashboard renderer, released API, owner approval, real-world dataset or Numeric Grammar admission.

The exact reviewed source is `scripts/component-production/specs/DashboardNumericSourceProbe.json`. Its separate immutable sample evidence is `scripts/component-production/numeric-evidence/DashboardNumericSourceProbe.json`. Both are tracked as regular Git files.

The proposed numeric-free Web Component Program contains only the existing `accessible-name` semantic module and a single Root. The `sample-series` numeric slot is attached to the **independently compiled numeric-free fingerprint** and exactly one recomputed authority receipt. Its three values (2, 4, 3) are **synthetic examples**, not Vellira financial, traffic, marketing or product metrics. The component is an identity probe; it does not choose chart geometry or override future Dashboard design/API reviews.

Run `pnpm exec vitest run --config vitest.tooling.config.ts scripts/component-program/dashboard-numeric-source-review.test.ts` to independently recompile the numeric-free baseline, verify the actual source/evidence pair and confirm Numeric Grammar remains explicitly blocked.

## Provenance gates (not satisfied by merge)

1. Review this still-OPEN public source PR at its **final exact HEAD**. Moving the branch invalidates any earlier review.
2. Owner may separately make an explicit **source-provenance-only** decision using the already-merged protected private GitHub workflow contract. No decision has been created or implied by this PR.
3. Only after an actual, authenticated private comment on a **merged private PR**, execute the private protected `numeric-combined-proof.yml` workflow on `main`, supplying that exact comment locator. The workflow must independently re-read the public PR and all committed bytes and recompute receipts.
4. `COMBINED_SOURCE_RECEIPTS_VERIFIED` would remain **read-only proof**, not a grant. Any future consumer must verify the protected GitHub run identity. Numeric Grammar, chart geometry, a11y/browser proof, Factory and provider/delivery remain separately gated.

Do not merge this source PR before the source-only owner review/proof sequence: the current protected V1 requires an **open exact-head** public source PR.
