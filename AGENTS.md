## Maintainer / AI technical passport

Before any Vellira **maintainer/AI-assisted** engineering investigation,
implementation, review or operational change, first read the current
[Technical Passport](https://github.com/vellira-dev/vellira-internal/issues/1020)
and latest dated comments **with authorized private access**. Then verify
the current commit SHAs of public `vellira`, private `vellira-internal`
and `vellira-backend`, and read relevant canonical contracts, active
issues/PRs, source and checks. Never trust chat memory or old green runs.
If private access is absent, disclose that limitation and **HOLD** work
requiring private architecture, security, Factory, CI spending or production
authority. This private prerequisite does **not** restrict external public
contributors without that access: they follow the public repository rules.

Before proposing a maintainer/AI change: identify the root issue and existing
change-intent PR; document relevant source/base/head revisions, accepted
scope, impact, rollback, required positive/negative tests, owner approvals,
and predicted *total* Actions/provider cost (including separate workflows
and retries). The 20,000-minute private CI target is **not an enforced cap**.
Do not silently initiate discretionary paid work when reliable remaining
budget or authorization is unknown.

Use the PR template's **Maintainer / AI technical passport** field when
applicable. Never copy confidential passport content into this public
repository or a public PR. A passing test/CI check is not proof of a deployed
site or approved Factory execution. For critical CI/CD, production, security,
budget, public API and economic changes require explicit owner approval and
appropriate independent review; do not self-approve merges or deployments.

After an authorized merge and any applicable runtime verification, append a
dated evidence comment in the private passport: repository, PR and merge
SHA, exact-head test/run IDs, observed production identity (if relevant),
cost measured/unknown, unresolved risk and next decision. Until verified
use `PENDING`, `BLOCKED` or `UNVERIFIED` rather than `COMPLETED`.
The passport is a continuity/evidence ledger, **not** a substitute for the
canonical architecture or the repository Definition of Done. This policy
adds no new workflow or automated CI gate.

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
