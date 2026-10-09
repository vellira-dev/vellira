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

## Engineering change admission

Before opening any non-bot engineering pull request, read and follow
`docs/architecture/engineering-change-admission.md`.

Derive a stable change-intent ID from the root problem and violated contract, not
from the first proposed fix. Search open pull requests for the exact
`vellira-change-intent:v1:<id>` marker before creating a new PR. If a matching
PR exists, continue and expand that PR instead of creating a successor. A broader
fix, changed implementation approach, or merge conflict is not by itself a reason
to supersede an active PR.

When a GitHub token is available, use
`node scripts/ci/pr-change-intent.mjs preflight <intent-id>`; connector-based
sessions may perform the same exact-marker lookup through the GitHub connector.
Every admitted non-bot engineering PR must carry exactly one change-intent marker
in its body.

## Actions evidence and change delivery

Follow `.github/ACTIONS.md` when changing workflows or publishing patches.
Publish coherent multi-file changes atomically, validate before pushing, and use
the permanent diagnostics workflow instead of component-specific temporary files.
