# Numeric Binding Receipt Resolver V1 — content-only preflight

**Status: standalone identity consistency check. No Numeric Grammar, renderer, Factory, authenticated issuer or production authorization is admitted.**

## Purpose and inputs

After #1727 (Numeric Binding Authority preflight) and #1731 (Finite Numeric Binding Slots), the resolver must prove that a proposed slot does not merely contain _plausible-looking hashes_. A caller-supplied receipt is untrusted until its fields match an independently recomputed receipt for the current source, numeric-free program and immutable dataset.

`resolveNumericBindingReceiptsV1(productionInput: unknown, evidenceInput: unknown)` is a Node-only, pure, review-required sidecar. It accepts a canonical production spec containing `componentProgram.numericBindingSlots` and a separate exact evidence envelope:

```ts
{
  schemaVersion: '1',
  entries: [{
    slotId: 'revenue',
    receipt: numericBindingAuthorityReceiptV1,
    binding: numericSeriesBindingEnvelopeV1,
  }],
}
```

The finite slot proposal contains 1–4 Web/React references, each of which must have one and only one corresponding evidence entry. The evidence envelope must have exactly `schemaVersion` and `entries`; each entry exactly `slotId`, `receipt`, and `binding`. The full authority receipt must contain exactly its eleven declared primitive fields. No extra state, callbacks, nested arbitrary object parameters, unknown platforms or approvals are admitted.

## Independent verification sequence

1. Descriptor-only capture and revalidation of the caller-supplied production spec occurs **before** any serialization or source parsing. Throwing reflection traps, accessors, hidden/symbol fields, non-plain records, cycles and `toJSON` functions fail closed.
2. The existing `parseComponentProductionInput` and `componentProgramSource` establish the normalized component identity, Web target, root and capabilities. The resolver requires a real, nonempty finite slot proposal.
3. The proposed `numericBindingSlots` field is removed only from a **detached copy** used to recompile the numeric-free base. Its exact `component-program-v1` fingerprint must match `baseProgramFingerprint`. The original slot-bearing program is also compiled independently to verify that `missing-grammar-capability` still returns null program and null fingerprint.
4. Evidence is safely detached before interpretation, bounded to 512 KiB and the exact number of slots; there can be no missing, extra or repeated `slotId`. Input evidence order may differ from slot declaration order.
5. For every slot, the existing `prepareNumericBindingAuthorityV1` is rerun on the normalized **numeric-free** production spec, exact owner, pinned program fingerprint and evidence dataset. This preflight re-snapshots and rehashes the dataset and reconstructs its own immutable authority receipt.
6. Every field of the supplied receipt is checked against the independently recomputed receipt, including source digest, program identity, component name, root, platform, slot ID, dataset hash, `disposition`, `grammarAdmitted` and the authority SHA-256 digest. The reconstructed authority hash must also match the reference in the slot. Any disagreement returns a stable fail-closed error without partial output.

The successful output is an immutable, slot-ordered list of revalidated receipts, detached numeric snapshots and canonical JSON. Its disposition is always `review-required`; `grammarAdmitted` is always `false`. The output contains no newly minted approval, certificate, or content hash that could be mistaken for source authentication.

## Explicit limits

Content identity is **not** provenance. A party able to author a valid spec, calculate its fingerprints and synthesize matching evidence can still produce a matching content receipt; this V1 cannot prove GitHub revision ownership, trusted issuer keys, approval, review authority, consent, or external data truthfulness. The finite-slot parser and compiler still reject numeric grammar admission. Nonthrowing Proxy traps may perform side effects during reflection; the resolver provides no arbitrary Proxy execution sandbox.

The current step does not modify `ComponentProgramV1` output, grammar registry, Factory, build generation, packages or Chart renderers. It does not admit React Native, data-dependent geometry, SSR/a11y proofs, or an arbitrary JSON API.

**Future admission gate:** independently verify governed production source revision and trusted issuer provenance, establish fixed canonical receipt golden vectors for persistent interchange, and review numeric semantic, geometry and accessibility obligations. Only that separate governed work can consider admitting Numeric Grammar.
