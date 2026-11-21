# Numeric series labels — Unicode 15.1 casefold implementation V1

**Scope:** Proposed Web Numeric data shape only. **No admission to Component Program Grammar or Factory execution.**

## Implemented

- Pinned, dependency-free Unicode 15.1.0 default full CaseFolding table (1530 unique source code points) in `packages/metadata/src/numericUnicodeCasefold151.ts`.
- Source: `unicode-org/icu`, `release-74-2`, `icu4c/source/data/unidata/CaseFolding.txt`, Git blob `69c5c64b4c6a124f4608722db723a9e32667f190` (`CaseFolding-15.1.0.txt`). Unicode data © 2023 Unicode, Inc. See https://www.unicode.org/terms_of_use.html.
- Default language-neutral full mappings: C + F, excluding simple-only S and Turkic-specific T. Unlisted characters map to themselves.
- Proposed comparison key: `NFC(fullCasefold151(NFC(label)))`. Compare identities without modifying the original user-visible label.
- Bounds: 1–120 Unicode code points; reject leading/trailing/doubled ASCII spaces, non-ASCII whitespace, and control/format categories `Cc` and `Cf`.
- Invalid labels return `invalid-series-label`; duplicate normalized identity keys return `duplicate-series-label`.
- The standalone `validateBoundedNumericSeries` enforces this stricter proposed policy. Component Intent, default Component Grammar, Program compiler and Factory generator are unchanged.
- Vitest covers the real public TypeScript validator: casefold expansions, canonical equivalence, accent differences, invisible characters, unchanged display labels, and existing admission boundaries.

## Still unproven / not authorized

1. JavaScript `String.prototype.normalize('NFC')` and Unicode-category regular expressions depend on the executing runtime. The pinned casefold table does not pin Node/browser ICU normalization or category data. Full Python 15.1 parity, including runtime-version mismatches, is not established.
2. The historical private Python reference is SHA-governed and unchanged. Any migration to the new private Unicode 15.1 reference requires separate review and preservation of #739/#740 holdouts.
3. Public Numeric Grammar, Numeric Binding Slots and Numeric modules remain rejected by `scripts/component-program/compile.ts`.
4. No real Factory LineChart candidate has been generated or certified in the exact-snapshot isolated renderer. All nine Numeric obligations remain `NOT_PROVEN`.
5. This PR authorizes no subscription, production binding, provider calls or spend, readiness, certification, or release.

## Next gate

Run local Prettier, ESLint, metadata typecheck and targeted Numeric validator/Grammar HOLD tests on the exact Draft HEAD. Independently review backward compatibility, then verify cross-runtime Unicode conformance using the actual TypeScript validator and Python 15.1 reference in controlled runtimes. Only then review Program/API fingerprints and the separate Numeric Grammar admission decision.
