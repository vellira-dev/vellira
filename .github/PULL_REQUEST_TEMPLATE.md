## Summary

<!-- Briefly explain what this pull request changes and why. -->

## Change intent

<!--
For PRs not owned by a trusted automation identity, replace "replace-me" with
one stable lowercase kebab-case ID for the root problem, not the proposed patch. Search open PRs for
the exact marker before opening this PR; continue an existing matching PR instead
of creating a superseding PR.
-->
<!-- vellira-change-intent:v1:replace-me -->

## Changes

<!-- List the main changes. -->

-
-
-

## Related issue

<!-- Use "Closes #123" when applicable. -->

Closes #

## Testing

<!-- Describe the checks and tests you ran. -->

- [ ] `pnpm ci:quality`
- [ ] `pnpm ci:build`
- [ ] `pnpm ci:typecheck`
- [ ] Relevant tests
- [ ] Storybook examples reviewed
- [ ] Documentation reviewed

## Definition of Done

<!--
Read docs/architecture/definition-of-done.md before marking this PR merge-ready.
The repository Definition of Done applies to every task, not only launch-critical work.
-->

- [ ] Every accepted in-scope requirement and acceptance criterion is complete or explicitly resolved.
- [ ] Relevant existing baseline and positive/negative regression coverage were checked when applicable.
- [ ] Required validation evidence belongs to this exact final HEAD.
- [ ] No known in-scope correctness gap, temporary bypass, or silently deferred work remains.
- [ ] Final diff review found no unrelated changes or weakened tests/checks/contracts.

## Checklist

- [ ] The pull request focuses on a single change.
- [ ] The title follows Conventional Commits.
- [ ] Tests were added or updated when behavior changed.
- [ ] Documentation was updated when public APIs changed.
- [ ] Accessibility was considered.
- [ ] Public API snapshots were updated when required.
- [ ] No unrelated changes are included.

## Screenshots or recordings

<!-- Add visuals for UI changes when applicable. -->

## Additional context

<!-- Add migration notes, limitations, or implementation details. -->

## Maintainer / AI technical passport

<!-- Maintainer/AI-assisted work only. External contributors without private
access are NOT required to access the private passport and may mark N/A.
Do not include private technical, strategy or security details in this public PR.
This is a human review requirement, not an enforced GitHub status check. -->

- [ ] Maintainer/AI: read [private passport #1020](https://github.com/vellira-dev/vellira-internal/issues/1020) and the latest dated comment; or **N/A** (independent external contribution).
- [ ] Verified current relevant repository SHAs and existing issues/change-intent PR.
- [ ] Documented total expected Actions/provider costs and operational risk; missing quota/approval means HOLD discretionary spending.
- [ ] Required owner/independent review, exact-final-HEAD proof and rollout/rollback checks are planned/completed as applicable.

Passport link (maintainer/AI only): https://github.com/vellira-dev/vellira-internal/issues/1020

Last passport checkpoint read, base/head SHAs, risk/cost and test evidence: **PENDING / N/A**

After an authorized merge, record exact merge SHA, CI runs, runtime identity (if
applicable), costs and unresolved risk in the private passport. Until then the
outcome remains **PENDING**; do not claim successful production delivery from CI.
