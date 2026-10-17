# Numeric Binding Authority V1 — preflight identity receipt

**Status: review-only sidecar. No Numeric Grammar admission, Chart implementation, compiler modification, Factory call, or automatic production authorization.**

## Motivation and source of authority

Numeric Series now has validated types, a bounded runtime validator, a versioned envelope, detached immutable snapshots, canonical UTF-8 JSON and a content fingerprint. That identity must not be silently attached to an arbitrary Component Program by writing a dataset object into scalar `modules[].parameters`.

`prepareNumericBindingAuthorityV1(productionInput, requestInput)` is a **Node-only preflight**. It parses the supplied production spec using the existing `parseComponentProductionInput`, derives `componentProgramSource` from that validated spec, and invokes the existing `compileComponentProgram` on the same spec's `componentProgram`. It only proceeds if the existing compiler returns `compiled`, the program fingerprint matches the caller's independently pinned fingerprint, the declared owner name matches, and the production spec targets **Web only**. React Native and `both` are rejected.

The request is exactly `schemaVersion: '1'`, a bounded `ownerName`, a bounded `bindingId`, the previously pinned `expectedProgramFingerprint`, the previously pinned `expectedBindingFingerprint`, and a typed `NumericSeriesBindingEnvelopeV1`. Extra keys, symbols, accessors, invalid versions and unsupported fingerprint formats fail closed. The envelope is independently snapshotted and re-fingerprinted using the reviewed Numeric Series snapshot path; tampered or stale data is rejected.

## Result and identity semantics

A successful preflight returns the detached frozen numeric snapshot and its canonical JSON, plus a frozen receipt. The receipt includes the exact component name, Web platform, verified program root, binding ID, program-source digest, exact Component Program fingerprint and numeric-series SHA-256 fingerprint. The receipt itself has a `numeric-binding-authority-v1:sha256:` content digest over a fixed-order record of primitive fields.

**Success means only that these identities agree at this evaluation.** The receipt's `disposition` is always `review-required` and `grammarAdmitted` is always `false`. It is neither a trusted signature nor a grant to compile numeric geometry or render a Chart. Anyone able to supply a new spec and matching hashes can mint a new matching content receipt; independent source authenticity, repository revision and human authorization still require governed evidence.

Unknown/throwing JavaScript objects are not assumed to be safe: reflection errors return stable non-sensitive error codes. As with the earlier snapshot, a nonthrowing Proxy trap can have side effects and cannot be authenticated by these checks alone.

## Deliberate non-goals

- No changes to `componentProgramSource`, `ComponentProgramDecisionsV1`, `parseComponentProgramDecisions`, grammar registry or private Factory.
- No arbitrary JSON parameter, `numeric-data-geometry` module, rendering API, React Native authority, generated code, or chart library.
- A Web component with existing, non-numeric grammar can be used only as an **identity fixture** for this preflight. It is *not* evidence that numeric semantic obligations have been reviewed, accepted or satisfied.
- No release, billing, provider/model request, certification or proof of user consent.

## Next admission gate

A separate review must decide the finite numeric binding slot and versioning inside the Component Program, whether binding references or inline immutable receipts are appropriate, exactly who issues/verifies governed source revision authority, Unicode case-fold parity, and independent geometry, browser/SSR and accessibility proof. Only after those checks may numeric semantic capabilities be considered for registration.
