# Finite Numeric Binding Slots V1 — review-only Component Program extension

**Status: typed and parsed, but not admitted to compilation.** Numeric geometry, Chart, React Native, Factory and automatic certification remain outside this PR.

## Why an explicit slot reference

Component Program V1 currently permits only scalar `string | number` module parameters and finite `choice` / `integer` grammar parameter domains. Numeric datasets must never be inserted into `modules[].parameters`, nor smuggled through arbitrary JSON. The previously reviewed Numeric Binding Authority receipt (#1727) is a content-identity record, not proof of issuer authenticity.

The optional top-level `ComponentProgramDecisionsV1.numericBindingSlots` is a **versioned proposal**. It uses an exact record with `schemaVersion: '1'`, `baseProgramFingerprint`, and an array containing **1–4 slots**. Each slot has exactly:

- `id`: unique ASCII lowercase/kebab identifier, 1–64 characters.
- `kind: 'bounded-numeric-series'` and `platform: 'react'`: the only proposed kind/platform.
- `ownerRootId`: an existing root anatomy ID; no orphan slots.
- `bindingFingerprint`: `numeric-series-binding-v1:sha256:` plus 64 lowercase hexadecimal characters.
- `authorityFingerprint`: `numeric-binding-authority-v1:sha256:` plus 64 lowercase hexadecimal characters.

The parser rejects duplicate slot IDs, duplicate authority fingerprint references, unsupported schema versions, wrong hash namespaces, arbitrary nested datasets, unknown/hidden/symbol fields, accessor records, sparse or decorated arrays and reflection failures. Accepted slot metadata is reallocated and frozen. This is a finite reference language, not a dataset API.

## Identity and the no-cycle rule

`baseProgramFingerprint` must refer to the previously **compiled numeric-free Component Program**. It is deliberately not a fingerprint of the proposed slot-bearing decisions: the authority receipt from #1727 already binds to that numeric-free program. Hashing a new slot-bearing program into the receipt would create a circular identity dependency.

Parsing establishes only the **shape** of this reference. It does not prove that the fingerprint belongs to a trusted issuer or equals a particular source revision. A future governed resolver must independently verify the pinned base program, issuing authority, signed/reviewed provenance and all corresponding dataset receipt identities before admitting a semantic capability.

## Critical compiler barrier

`parseComponentProgramDecisions` accepts and validates the optional slot proposal. **Any nonempty slot proposal causes `compileComponentProgram` to return `missing-grammar-capability` and `program: null` / `fingerprint: null`.** It cannot be silently dropped or compiled as an ordinary legacy program.

Decisions without `numericBindingSlots` use exactly the existing parser, scalar parameter validation, grammar, fingerprints and compilation behavior. Existing unsupported `bounded-numeric-series` and `numeric-data-geometry` modules remain blocked. The production parser may retain the review-only proposal but no production consumer is authorized to treat it as a compiled numeric contract.

## Evidence and next gate

Tests cover exact fields, slot limits, duplicate identity, reference namespaces, root matching, immutability, hostile arrays/proxies, unsupported Native scope and explicit compile denial with stable legacy compilation. This change does **not** register numeric Intent/Grammar capabilities, run a renderer or change Factory. Full Unicode case-fold parity and independent numerical geometry, SSR and accessibility proof remain separately gated.

**Next:** review a narrowly scoped resolver against previously verified Numeric Binding Authority receipts and a governed source revision. No chart production is authorized by this proposal.
