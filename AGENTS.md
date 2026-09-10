## Repository Definition of Done

Before calling any Vellira task Done, merge-ready, or safe to close, read and
follow `docs/architecture/definition-of-done.md`.

This applies to all implementation, review, remediation, generator, tooling,
documentation, and CI work. Green CI alone does not override an unproven
acceptance criterion or a known in-scope correctness gap. Validation evidence
must belong to the exact final HEAD. Launch-critical work uses the same contract
with stricter evidence requirements.

## Vellira-first UI policy

When implementing or reviewing maintained first-party UI, read and follow
`docs/architecture/vellira-first-ui-consumption.md`.

Reuse canonical Vellira components and resources when they exist. If a reusable
component or design resource is genuinely missing, follow the policy's fail-closed
component/resource path instead of inventing a permanent local substitute.

## Component token dependency policy

When implementing, reviewing, generating, or repairing component tokens, follow
`packages/tokens/src/component-token-dependencies.ts` as the canonical dependency
policy and audit authority.

Choose semantic roles by meaning, never by resolved color equality. Primitive
colors are allowed only for explicit intent/palette construction or documented
component-owned presentation. Another component token family is prohibited as a
dependency unless the edge is explicitly registered by that authority. Preserve
resolved theme values when repairing ownership unless the task explicitly calls
for a visual change.

## Package-specific instructions

When working in `packages/react-native`, always read and follow
`packages/react-native/AGENTS.md` before making changes.
