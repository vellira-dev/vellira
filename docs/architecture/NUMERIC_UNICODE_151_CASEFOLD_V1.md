# Numeric series labels — Unicode 15.1 casefold implementation V1

**Scope:** proposed Web Numeric data shape only. **No admission to Component
Program Grammar or Factory execution.**

## Implemented

- A pinned, dependency-free full Unicode **15.1.0 CaseFolding C + F**
  mapping (1530 unique source code points) in
  `packages/metadata/src/numericUnicodeCasefold151.ts`.
- Source: `unicode-org/icu` branch/tag `release-74-2`,
  `icu4c/source/data/unidata/CaseFolding.txt`, Git blob
  `69c5c64b4c6a124f4608722db723a9e32667f190`;
  header `CaseFolding-15.1.0.txt`. Unicode data © 2023 Unicode,
  Inc. Terms: https://www.unicode.org/terms_of_use.html.
- Default full, language-neutral fold (C+F), not simple S and not Turkic
  locale-specific T. All unlisted code points map to themselves.
- Proposed label comparison key:
  `NFC(fullCasefold151(NFC(label)))`. The result is used **only for
  identity/duplicate detection**; original `label` bytes are retained.
- Label bounds: 1–120 Unicode code points. No leading/trailing or doubled
  ASCII spaces, no other whitespace, and no `Cc` or `Cf` controls/format
  characters. Noncanonical inputs fail closed with
  `invalid-series-label`; duplicate keys with
  `duplicate-series-label`.
- The standalone `validateBoundedNumericSeries` now enforces this
  proposed stricter policy. This does not modify the Component Intent
  registry, default Component Grammar, Program compiler or generator.
- The associated Vitest exercises **the actual public TypeScript validator**
  with fold-expansion, canonical-equivalence, accent, whitespace and
  preserved-display controls, plus the unchanged explicit Grammar HOLD.

## Still unproven / not authorized

1. JavaScript `String.prototype.normalize('NFC')` and Unicode-category
   regex are **runtime-provided**. This data file pins *casefold mappings*,
   not the browser/Node ICU normalization and property-data versions.
   Cross-runtime Python 15.1 full conformance (including unsupported
   runtime versions) is **not yet established**.
2. Legacy private Python reference is historic SHA-governed and **unchanged**.
   A separate approved successor must bridge current private `_valid_case`
   with the new Unicode 15.1 reference, without resetting #739/#740.
3. Public Numeric Grammar, Numeric Binding Slots and numeric modules are
   still rejected by `scripts/component-program/compile.ts`.
4. No real Factory LineChart candidate has been generated or validated in
   the exact-snapshot isolated renderer. All nine obligations remain
   `NOT_PROVEN`.
5. No subscription, production binding, model/provider execution, spend,
   readiness, certification or release authorization follows from this PR.

## Next gate

Run local Prettier, ESLint, public metadata/typecheck and the specific
numeric validator/Grammar HOLD tests on the exact Draft HEAD. Review any
canonicalization behavior changes for backward compatibility. After that,
independently verify cross-runtime Unicode conformance using the **actual**
TypeScript module and Python 15.1 reference in controlled runtimes. Only
then review Program/API fingerprints and the separate Numeric Grammar
admission decision.
