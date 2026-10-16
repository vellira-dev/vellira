# Numeric Series V1 — typed data contract admission

**Status: type-only pre-admission; no numeric Grammar or Chart implementation.**

This small follow-up to [the public Numeric Series and Data Geometry proposal](./NUMERIC_SERIES_GEOMETRY_PROPOSAL_V1.md) puts its three already-described TypeScript data shapes under the canonical metadata source. It is **not** an executable numeric validator, a compiled Component Program module, a released Chart API or a claim of production readiness.

## Canonical type ownership

`packages/metadata/src/numericSeries.ts` exports:

- `NumericSeries`: read-only `id` and `label` strings.
- `NumericSeriesRow`: read-only numeric `x`, supplied text `xLabel` and a read-only `Record<string, number | null>` of series observations.
- `BoundedNumericSeries`: read-only `series` and `rows` arrays.

These types use the **exact public proposed fields**. No new component names, graph archetypes, interactive props, dates or formatting policy have been inferred. TypeScript alone cannot establish cardinalities, finite bounds, distinct normalized Unicode labels, own-key alignment or the distinction between absent and explicitly null runtime fields.

## Existing Component Intent / Program authority

The current `ComponentProgramDecisionsV1.modules[].parameters` accepts only scalar `string | number`, and the public parser checks those values. It has **no** reviewed serializable numeric dataset parameter/domain. Placing arrays or records into that field without a typed parser and independently reviewed obligations would bypass the existing finite grammar.

Therefore:

- `bounded-numeric-series` and `numeric-data-geometry` are **proposed**, not present in `componentSemanticCapabilities` or `componentGrammarV1`.
- Selecting either unregistered numeric module must return `missing-grammar-capability`. Trying to put arrays or record-valued datasets into existing scalar module parameters must be `blocked`.
- Adding a TypeScript type **does not imply** Component Intent coverage, generated source authority, a passing numeric geometry check or any React Native equivalent.
- Existing V1 scalar grammar, metadata validation and component program outputs remain unchanged.

## Follow-up admission decisions

A separate reviewed compiler/API change must define a finite serializable representation for bound numeric data, its validation/errors and versioning, without introducing an arbitrary object/JSON escape hatch. Unicode whitespace and full case-fold parity, ties-to-even tick indexing, exact y-label formatting, semantic token roles, browser/SSR/a11y results and independent proof remain **open** until each has real evidence.

A future renderer may use Vellira-owned native SVG/HTML/CSS under those reviewed semantics. This document does not authorize a Chart candidate, external chart library, remote provider/model request, spending, certification or release.
