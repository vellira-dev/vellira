# Numeric Series — Immutable Snapshot & Canonical Serialization V1

**Status: standalone pre-admission authority only.** No numeric Component Intent capability, Component Program grammar binding, Chart, renderer, model call or Factory admission is introduced.

## API boundaries

- `snapshotNumericSeriesBindingV1(input: unknown)` (browser-safe metadata): returns a frozen, detached `NumericSeriesBindingEnvelopeV1` and a compact `canonicalJson`, or a stable `{ ok: false, code: 'invalid-snapshot', path: '$' }`.
- `fingerprintNumericSeriesBindingV1(input: unknown)` (Node-only tooling): hashes the UTF-8 bytes of that exact canonical JSON with SHA-256 and prefixes the result `numeric-series-binding-v1:sha256:`. It does not import `node:crypto` into browser/shared metadata.
- The existing `parseNumericSeriesBindingV1` and `validateBoundedNumericSeries` remain unchanged. The clone is verified by the existing parser **after** detachment, rather than trusting earlier checks of a mutable source.

## Snapshot admission

The input envelope requires exactly `schemaVersion`, `kind` and `data`, with a plain Object prototype. Data, series, rows and values require exactly their declared own enumerable data fields, without getters, setters, inherited fields or symbols. Series and rows must be dense ordinary arrays with no extra keys, accessors or subclass prototypes. All structural and numeric limits still come from the canonical validator (1–4 series, 0–90 rows, finite increasing x, finite y or explicit null, exact series keys). Unknown or throwing reflection inputs fail closed; no partial result is returned.

The snapshot copies every record and array; observations use fresh null-prototype dictionaries. Each new nested object, dictionary, array, dataset and envelope is frozen. Caller-owned source objects are never frozen. Direct modifications after snapshot cannot affect the returned value or canonical JSON.

## Canonical wire bytes V1

The JSON serializer builds a fixed schema field order (`schemaVersion`, `kind`, `data`; `series` before `rows`; `id` before `label`; `x`, `xLabel`, `values`) using the detached primitive graph. Series and rows keep semantic input order. Each row's values keys follow declared series order, including integer-like IDs such as `10` and `2` (no host enumeration reordering). Numeric negative zero is normalized to positive zero before validating and freezing; JSON uses standard ECMAScript finite-number and string escaping with no insignificant whitespace. `null` and zero remain distinct.

The serializer **never** calls `JSON.stringify` on an input object, source array or source record, and rejects extra source `toJSON` properties. It JSON-encodes only captured primitive strings/numbers/null. Mutation of the source after snapshot does not change bytes or digest. The SHA-256 golden vector and reorder/mutation/adversarial tests establish an executable baseline.

## Explicit limitations and future admission gates

- The fingerprint is a content identity, **not** a signature, authentication mechanism or certification of the underlying semantic truth.
- JavaScript Proxy reflection can run arbitrary source-side traps; thrown traps are contained, but nonthrowing malicious traps may have side effects. No claim is made that all Proxies can be detected or made side-effect-free.
- Full Unicode whitespace and case-fold parity, immutable reference authority within a Component Program, source-to-binding provenance, cross-runtime rendering/a11y and Native behavior remain separately reviewed obligations.
- The Node SHA-256 adapter is tooling-only; no cross-platform digest implementation has been admitted for React Native.
- Compiler parameters remain scalar; numeric grammar and generation remain blocked. No direct serialization or hashing of arbitrary unvalidated data is authorized.
