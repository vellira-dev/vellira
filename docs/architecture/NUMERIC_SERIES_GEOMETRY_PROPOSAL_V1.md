# Proposed Numeric Series and Data Geometry Contracts

**Status: proposal.** The capabilities and types described here are under review; they are not currently implemented or available as Vellira components.

## Purpose and scope

This proposal introduces two reusable **Web/React** semantic capabilities:

- `bounded-numeric-series`: validated ordered numeric observations, stable series identities, explicit missing values and bounded numeric domains.
- `numeric-data-geometry`: renderer-independent relationships between numeric domains, positions, ticks, disconnected runs and an accessible data equivalent. It depends on `bounded-numeric-series`.

This is a proposal for public Component Intent/Component Program semantics, not a generic charting language or a shipped chart component. React Native and other visualization types require separate decisions.

## Proposed data types

```ts
export type NumericSeries = Readonly<{
  id: string;
  label: string;
}>;

export type NumericSeriesRow = Readonly<{
  x: number;
  xLabel: string;
  values: Readonly<Record<string, number | null>>;
}>;

export type BoundedNumericSeries = Readonly<{
  series: readonly NumericSeries[];
  rows: readonly NumericSeriesRow[];
}>;
```

These types do not replace runtime validation. The proposed bounded contract accepts **1–4 series** and **0–90 rows**. Series IDs must be unique ASCII strings of 1–64 characters matching `[A-Za-z0-9_-]`; `__proto__`, `prototype` and `constructor` are reserved. Series labels must be meaningful and distinct using reviewed whitespace and Unicode case-folding semantics, with at most 120 Unicode code points.

Every row has a finite numeric `x` within `[-1e9, 1e9]`, strictly increasing across rows, and a consumer-supplied `xLabel` with 1–120 Unicode code points including at least one non-whitespace character. A valid label is preserved, not silently trimmed. Every row's `values` object must have exactly the declared series IDs as own keys. Non-null `y` values must be finite numbers in `[-1e12, 1e12]`.

Only explicit `null` denotes a missing observation. Missing or extra series keys, `undefined`, non-finite data, reordered/repeated `x`, duplicate identities and numeric coercion are invalid; a consumer must not silently drop rows, fabricate values or draw a partial success plot. Labels are supplied by the consumer; no implicit locale, currency, timezone or date interpretation is proposed.

## Proposed numeric behavior

- For two or more rows with finite observations, the `x` domain is `[firstX, lastX]`, preserving irregular numeric spacing. For a single finite row, the domain is `[x-0.5, x+0.5]` with a point only, not a fabricated line.
- Include zero in the `y` domain: `[min(0, minY), max(0, maxY)]`. For all finite observations equal to zero, use `[-1, 1]`. Empty or all-null data has no numeric plot domain.
- Normalize finite positions as `u=(x-xMin)/(xMax-xMin)` and `v=(yMax-y)/(yMax-yMin)`. A `null` value breaks the corresponding series run; no line may connect over the gap.
- Propose five finite, strictly increasing `y` ticks including the domain endpoints, or a truthful unsupported-data state if numeric precision cannot represent distinct ticks.
- Choose at most five `x` tick labels from actual input rows. For up to five rows, select all. Otherwise sample indices nearest to `(n-1)*i/4` for `i=0..4`, with **ties to even**. For seven rows, indices are `[0,2,3,4,6]`; for eleven, `[0,2,5,8,10]`. Tick labels remain the supplied `xLabel` values, without automatic parsing.

Precise decimal formatting for displayed `y` ticks, Unicode cross-runtime equivalence and browser rendering tolerance still require reviewed implementation and tests. The proposal does not claim these have been proven.

## Web rendering and accessibility

A future component implementing these semantics may use native SVG, HTML and CSS without a third-party charting or scaling runtime. A static graphic must have a meaningful accessible name and description and an independently discoverable native HTML data table preserving every row, declared series label, raw numeric value and explicit missing-value marker. Hover or pointer interaction must not be the only way to read the data.

Series distinctions should use canonical semantic tokens and non-color visual identifiers, with adequate contrast in light, dark and high-contrast themes. Stable IDs for multiple instances, SSR/hydration behavior, zoom and responsive layouts require separate verification. A static SVG proposal does not imply interactive point selection, keyboard navigation between points or a tooltip API.

## Compatibility and status

The proposed numeric contracts do not change existing public Boolean, selection, size or other component semantics. Their public type and Component Program representation requires separate design, compiler tests and review.

**This document is a public-facing proposal, not an implemented API, a release announcement or a certification of production readiness.**
