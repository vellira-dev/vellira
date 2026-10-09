# Engineering Change Admission V1

## Status

Canonical repository contract for admitting engineering pull requests that are not owned by an explicitly trusted automation identity.

This contract prevents one root engineering problem from producing multiple
overlapping implementation pull requests that later have to be closed as
superseded. It complements, rather than replaces, the repository Definition of
Done and agent-specific proposal/candidate/delivery identities.

## Core rule

**One root engineering problem has at most one active implementation PR.**

A pull request is identified by a stable **change-intent ID** derived from the
root problem and violated contract, not from the first proposed fix. If deeper
analysis expands the implementation while the root problem remains the same, the
existing PR expands with it.

A new PR is justified only when the new work has a materially different root
problem or an authority boundary that cannot safely share the existing branch,
such as an immutable certified-candidate boundary or explicitly isolated security
authority.

## Change-intent identity

Use a lowercase kebab-case ID that remains stable while the root problem remains
stable.

Good examples:

- `generated-consumer-readiness-gap`
- `cloudflare-rsc-soak-recovery`
- `dependabot-remediation-authority-gap`

Bad examples describe a proposed patch rather than the root problem:

- `add-required-props`
- `fix-avatar-preview`
- `update-validator-file`

The PR body carries exactly one machine-readable marker:

```text
<!-- vellira-change-intent:v1:generated-consumer-readiness-gap -->
```

The ID is not a release/version identity and does not replace issue, proposal,
candidate, certification, or delivery IDs.

## Creator-side preflight

Before opening an engineering PR that is not owned by an explicitly trusted automation identity:

1. perform enough root-cause and impact analysis to name the violated contract,
   not only the first symptom;
2. derive the stable change-intent ID;
3. search open PRs in the target repository for the exact marker;
4. if a matching PR exists, continue that PR: update its branch, title, body,
   tests, and accepted scope as needed;
5. open a new PR only when no open PR owns that intent.

When a GitHub token is available, the repository helper performs the exact
lookup:

```bash
GITHUB_REPOSITORY=vellira-dev/vellira \
GITHUB_TOKEN="$GITHUB_TOKEN" \
node scripts/ci/pr-change-intent.mjs preflight generated-consumer-readiness-gap
```

A coding agent using a GitHub connector may perform the same exact-marker
open-PR lookup through the connector instead of exposing a token to the working
tree.

## Scope expansion

An implementation may discover additional failures after it is opened. Do not
create a successor PR merely because the correct fix is broader than the initial
hypothesis.

Keep the same PR when all of the following remain true:

- the root problem is the same;
- the same repository and human merge boundary own the result;
- the expanded files and tests are necessary to close that root problem;
- the final PR can still be reviewed as one coherent change.

Update the PR description so its accepted scope describes the actual canonical
solution. The Definition of Done then applies to that complete scope on the exact
final HEAD.

## Distinct work and exceptional supersession

Separate PRs are appropriate when the work has a different root cause or when a
reviewed authority boundary requires independent immutable identity. Examples
include a generated certified candidate that must remain byte-identical while a
separate validator fix changes tooling, or a security remediation that must stay
isolated from unrelated product behavior.

Closing an implementation PR as `superseded` is therefore an exception. When it
is unavoidable, the closing record must identify the authority/root-cause reason
that prevented continuing the original PR and link the successor. Convenience, a
broader fix, merge conflicts, or a changed implementation approach are not
sufficient by themselves.

## CI backstop

Creator-side preflight is the mechanism that keeps history clean because it acts
before PR creation. CI is a backstop for bypasses and races.

The existing trusted `PR Title` workflow also validates Engineering Change
Admission without adding another workflow card. It:

- checks out the trusted PR base revision;
- runs the repository-owned change-intent validator from that trusted base;
- uses only `contents: read` and `pull-requests: read` permissions;
- rejects a required missing or invalid marker;
- rejects a second open PR carrying the same valid intent ID;
- never creates, edits, closes, merges, or retargets a PR.

The first adoption PR may run against a base revision that predates this
validator; the workflow records that bootstrap state instead of executing
candidate validator code. Once the validator exists on `main`, the trusted-base
check is mandatory on subsequent PRs.

PRs not owned by an explicitly trusted automation identity and created on or after **2026-10-08T20:00:00Z** require the marker.
Earlier open PRs are grandfathered so adoption does not break historical work.
Only explicitly trusted GitHub automation identities are exempt from the marker:
`dependabot[bot]`, `github-actions[bot]`, `vellira-content-agent[bot]`, and
`vellira-release-sync[bot]`. PR body text, branch names, titles, and
repository-owned delivery markers are author-controlled metadata and never grant
an exemption by themselves.

A managed delivery attributed to any other identity must carry the same
`vellira-change-intent:v1` marker. Its producer should derive that marker from
its existing stable logical delivery identity. An unrecognized automation actor
therefore fails closed instead of silently bypassing admission.

## Relationship to repository governance

- `docs/architecture/definition-of-done.md` decides when the accepted change is
  complete; this contract decides whether a new implementation PR may exist.
- Agent-specific immutable proposal/candidate/certification identities remain
  authoritative inside their own lifecycles.
- A change-intent ID must not be used to merge independent root causes into one
  oversized PR.
- A green duplicate-admission check does not prove correctness, merge readiness,
  or completion.
