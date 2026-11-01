## Maintainer / AI technical passport

For Vellira maintainer or AI-assisted engineering work, first read the [private Technical Passport #1020](https://github.com/vellira-dev/vellira-internal/issues/1020) and its latest dated comments. Verify the current `main` SHAs of `vellira`, `vellira-internal`, and `vellira-backend`; inspect current source, architecture decisions, issues, open PRs, and validation evidence. Never infer current state from chat memory or an old green CI result.

External public contributors without private access follow the public repository rules and must not be blocked by this requirement. Maintainers without access must disclose the limitation and hold protected Factory, security, CI spending, or production work rather than guessing. Do not publish private passport content in public code or PRs.

Before proposing a maintainer or AI-assisted change:

- Identify the root problem and any existing change-intent PR; reuse the active PR for the same problem.
- Record relevant commit SHAs, accepted scope, risks, a minimal fix, rollback, and required positive and negative tests.
- Estimate total Actions and provider costs, including other triggered workflows and retries. A private monthly CI budget target is not an enforced hard cap; hold discretionary paid work when authorized remaining capacity is unknown.
- Obtain owner approval and appropriate independent review for critical CI/CD, security, production, public API, or Factory economic changes. Never self-approve a merge or deployment.

Record the passport checkpoint and verification evidence in the maintainer/AI section of the existing PR template. An exact-head green test is not proof of a production deployment. After an authorized merge, append a dated private passport comment with the repository, PR and merge SHA, exact test/run IDs, deployed runtime identity if relevant, measured costs or unknowns, remaining risks, and next decision. Mark unverified results `PENDING`, `BLOCKED`, or `UNVERIFIED`, not `COMPLETED`.

The passport is a continuity and evidence ledger, not a replacement for canonical architecture, the Definition of Done, or required checks. This protocol introduces no new workflow or automated CI gate.

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

Before opening any engineering pull request that is not owned by an explicitly
trusted automation identity, read and follow
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
Every admitted engineering PR that is not owned by an explicitly trusted bot
identity must carry exactly one change-intent marker in its body. Never infer an
exemption from PR body text, a branch name, a title, or another delivery marker.
Unrecognized automation must emit the normal change-intent marker from its stable
logical delivery identity.

## Actions evidence and change delivery

Follow `.github/ACTIONS.md` when changing workflows or publishing patches.
Publish coherent multi-file changes atomically, validate before pushing, and use
the permanent diagnostics workflow instead of component-specific temporary files.
