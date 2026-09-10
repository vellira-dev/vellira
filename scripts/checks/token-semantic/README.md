# Token Semantic Architecture Audit

Implementation for #890 is in report-first rollout. This is not a completed
architecture gate and must not be used to declare component production ready.

## Commands

```bash
pnpm check:tokens-semantic
pnpm check:tokens-semantic:json
pnpm check:tokens-semantic:strict
```

The first two commands explicitly use report mode. The strict command fails on
error findings or incomplete coverage. Execution/configuration failures return
exit code 2 even in report mode. JSON goes to stdout without a human preamble.

## One authority per responsibility

The current adapters consume the existing #886 ownership/lifecycle checker and
`canonicalCssVariableNames` from the design-resource authority. Compatibility
names are accepted only when present in that generated registry; the audit has
no parallel token allowlist. The canonical serializer also rejects string-backed
unitless values, including dimensional strings such as a scale of `0.98px`.

The report includes the eleven #890 rule families plus the consumer-reference
rule required by the #909 header regression. An absent adapter is `not-run`,
not a successful check. Family ownership, namespace lifecycle, CSS consumer
references, value kinds, and platform boundary report `partial`. Value preservation
runs the complete existing #880 oracle; the remaining adapters stay `not-run`.

## Connected platform and preservation authorities

`packages/tokens/src/platform-output/component-token-boundary.ts` contains the
shared #884 scanner extracted from its package test. Both the original test
and the semantic audit now call it. Every component family in Light, Dark, and
High Contrast is visited. `checked` counts these theme/family pairs. This adapter
also rejects arbitrary `native*` and `reactNative*` keys, not just the original
`nativeMaxHeight` example. It remains partial because broader renderer-specific
representation and source-boundary coverage is not yet proven.
Findings identify the resolved token path and originating theme barrel; no
fictional authored line location is assigned to resolved runtime values.

The preservation adapter reads the immutable committed baseline and calls
`verifyTokenPreservation` with the canonical migration manifest and pinned source
revision. It does not create a replacement baseline or a second drift algorithm.
`checked: 1` means one full verification invocation, not a count of scalar tokens.
Canonical, Web, and React Native findings retain the original rule, theme,
platform, and token path. Missing/unreadable evidence remains a fatal execution
error even in report mode. A preservation `complete` status describes running
the #880 value oracle, not visual approval: screenshot regression is still a
separate mandatory CI gate, and the full #890 report remains incomplete.

## Connected value-kind authority

The value-kind adapter invokes the existing `resolveTokenValueKind` and
`serializeCssTokenValue` contracts for every scalar in all four theme layers:
colors, semantics, components, and base tokens. Shared `controlSizes` is checked
separately because it is not included in `theme.tokens`. There is no copied role
vocabulary, unit map, or generator-only validator.

Each invalid scalar produces a finding with the canonical token path, theme,
source identity, and original serializer diagnostic. The scan accumulates all
invalid leaves instead of stopping at the first one. Valid platform intents are
atomic; malformed or unknown tagged objects, unsupported scalar types, empty
branches, and cycles cannot produce an empty successful scan. Shared objects are
visited at each path; inputs are never modified. `checked` counts scalar/intent
leaves and invalid branches inspected, not files.

This adapter remains partial: the existing serializer does not validate the full
CSS string-expression grammar, and emitted CSS/artifact parity still requires
integration. Running the scalar authority is useful evidence, not permission to
mark those unproven requirements complete. The repository fixture exercises all
maintained themes and shared control sizes alongside positive/negative fixtures.

## Consumer scan boundary

Static CSS/SCSS `var()` references are scanned under both `apps` and `packages`.
Comments, quoted text, URLs, build/vendor directories, and the canonical generated
token stylesheet are not treated as authored token references. Merely adding an
AUTO-GENERATED-looking comment does not exclude an authored file.

Unknown names inside current token namespaces produce errors when no same-file
provider exists. A token-prefixed local override remains a warning requiring
ownership review; it is not a registered compatibility alias. Non-token local
variables are accepted only in their own source file. Other unresolved names and
unfollowed source symlinks remain visible warnings. No declaration in an unrelated
file can silently whitelist a missing token across the repository.

The scanner reads full variable arguments. Dynamic Sass interpolations and escaped
identifiers produce unresolved-expression warnings, not missing-token errors for
truncated prefixes such as `--select-`. Static missing references inside nested
fallbacks remain detectable. Expression expansion is not yet proven.

Provider/import resolution, dynamic/escaped CSS identifiers, removed namespace
classification from migration evidence, source-to-token replacement mapping,
registry freshness, and other public API checks are still required before this
rule can be complete or blocking. Unknown provider warnings are not proof that a
third-party custom property is invalid. The report's incomplete coverage prevents
these limitations from becoming a false strict pass.

## Remaining rollout

Connect the other #880-#889 canonical contracts; finish each partial adapter;
validate the maintained baseline without broad suppressions; add the shared
Generator V2 and production-readiness integration; then switch the normal CI
entrypoint to strict mode. Existing ownership and removed-variable regressions
remain in place during the rollout.

CI stores the report with checkout/head identity. Passing report-mode execution
means only that an audit ran successfully, not that #890 is done. The PR stays
Draft until the full accepted scope and exact-head validation are complete.
