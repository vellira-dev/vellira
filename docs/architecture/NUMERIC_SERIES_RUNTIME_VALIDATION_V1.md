# Numeric Series V1 — standalone runtime validation

**Status: proposed data validator only.** This does not register `bounded-numeric-series` or `numeric-data-geometry` in Component Intent / Grammar, authorize chart generation, or change the Component Program compiler.

`validateBoundedNumericSeries(input: unknown)` exposes a fail-closed discriminated result (`ok: true` with the validated data reference or `ok: false` with stable `code` and `path`). Invalid input is not partially accepted or coerced. No consumer formatting, inference, plotting or external library is involved.

## Enforced checks

- Exactly `series` and `rows` own fields on the dataset; 1–4 series, 0–90 rows.
- Series IDs 1–64 ASCII `[A-Za-z0-9_-]`, no reserved prototype names, no duplicate IDs.
- Label non-whitespace and no more than 120 Unicode code points; NFC plus Unicode lowercase collisions rejected. Full cross-runtime Unicode case-fold semantics remain **unproven**.
- Strictly increasing finite `x` in `[-1e9,1e9]`; supplied `xLabel` preserved.
- Exactly one own value key for each declared series ID, no extras; `null` denotes gaps; non-null `y` must be a finite number in `[-1e12,1e12]`.
- Plain record inputs only, no inherited properties or object getters for defined fields. The validator makes no deep immutable copy; users must not mutate accepted data before consuming it.

## Not yet admitted

Full Unicode whitespace and case-fold parity, platform-independent numeric formatting, discrete ticks / ties-to-even, stable SSR and DOM proof, a11y HTML table, and the serializable typed Component Program binding/grammar are separately reviewable obligations. Do not treat this validator as numeric Component Program admission or Chart production readiness.
