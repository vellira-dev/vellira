# Component lifecycle and Stable graduation

`@vellira-ui/metadata` is the single authority for component lifecycle and
platform identity. Maintained catalogs, docs, generators, and checks derive
those values from canonical component metadata.

The lifecycle is ordered:

`experimental -> beta -> stable -> deprecated`

- `experimental` means scaffolded or incomplete and not yet ready for public
  production use. Generator V2 starts new components here.
- `beta` means public and production-reviewable, while one or more Stable
  graduation contracts may remain unsatisfied.
- `stable` means every applicable deterministic Stable gate passes and an
  explicit human approval record answers the release question affirmatively.
- `deprecated` is an explicit lifecycle decision. Failed quality checks never
  infer deprecation.

Stable graduation is conjunctive. A required failure, an unresolved production
warning, unexplained not-applicable result, platform blocker, missing declared
capability evidence, or missing human approval makes a component
`NOT_STABLE_ELIGIBLE`. Recommended findings are non-blocking only when the Stable
warning policy classifies the rule explicitly.

Use `pnpm check:component-stability <ComponentName>` for the human report and add
`--json` for the versioned machine-readable report. A new metadata transition to
`stable` is validated by `pnpm check:component-lifecycle`; CI compares the pull
request with its base revision and runs the Stable gate for every new promotion.
Existing Stable components keep their current public lifecycle without receiving
invented retroactive human approvals.

Human approval remains a version-controlled record under
`scripts/checks/component-stability/approvals`. It records the exact release
question, approver, decision, date, reviewed scope, and source pull request
revision. Missing or malformed records block Stable eligibility.
