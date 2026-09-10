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
not a successful check. The three initial adapters explicitly report `partial`:
family ownership, namespace lifecycle, and CSS consumer references. They expose
useful evidence without claiming the rest of their accepted scope is complete.

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
