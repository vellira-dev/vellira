# Numeric Series — binding pre-admission V1

**Status: isolated transport contract, not a numeric Component Program admission.**

The canonical public component compiler currently admits only scalar module parameters and two finite grammar parameter kinds: choice and bounded integer. Passing a numeric dataset directly into `modules[].parameters` would bypass that authority.

This PR proposes a separate, versioned `NumericSeriesBindingEnvelopeV1`: exact top-level fields `schemaVersion: '1'`, `kind: 'bounded-numeric-series'` and `data: BoundedNumericSeries`. Its standalone parser rejects unknown versions, unknown fields, arbitrary JSON, invalid datasets and reflection failures. It delegates numeric bounds and own-key alignment to the canonical runtime validator.

The parser deliberately does **not** add a binding field to `ComponentProgramDecisionsV1`, alter `parseComponentProgramDecisions`, register a numeric capability, create a Chart, or modify private Factory. The result retains the caller's data reference; it is not a frozen snapshot, a canonical serializer or a trust boundary against mutation after validation.

Before compiler admission, a separate review must specify placement and ownership of immutable data snapshots, exact serialization/canonical hashes, references versus inline datasets, error mapping, source authority, independent evidence, and full Unicode parity. Existing compiler rejection must remain in force until that review.
