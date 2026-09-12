# CI performance budget

Vellira treats pull-request feedback latency as an engineering contract. Correctness gates remain authoritative; the performance budget exists to prevent required validation from silently becoming serial or substantially slower over time.

## Canonical contract

`.github/ci-performance-budget.json` is the single source of truth for PR CI timing targets, hosted-runner tolerance, required job inventory, representative PR shapes, excluded external workflows, sustained-regression policy, and the #822/#1032 starting baseline.

Budget changes must be explicit repository changes reviewed like any other CI architecture change. Do not copy numeric thresholds into additional workflow files or scripts.

The maintained targets are:

- normal representative PR: 6 minutes;
- package-local PR: 5 minutes when affected execution can safely narrow the path;
- docs-only PR: 4 minutes when affected execution can safely narrow the path;
- shared token/type and unclassifiable cross-boundary changes: conservative full validation.

The full-path target includes a documented tolerance for GitHub-hosted-runner queue and startup variance. The target is not silently redefined by a slow runner.

## Evidence and enforcement

`CI Performance Budget` runs in parallel with the main `CI` workflow and waits for the exact PR-head CI run. It reads GitHub Actions job timestamps rather than estimating duration from log text.

Each run records:

- repository, PR, head/base SHA and changed-file classification;
- exact CI run identity;
- required job inventory and per-job duration;
- required-check feedback wall clock from CI run creation to the last required job completion;
- declared shape target and effective budget;
- whether a narrow PR fell back to the conservative full path;
- comparable recent samples and the canonical #822/#1032 baseline;
- pass, tolerance, anomaly, sustained-failure, or contract-error result.

The JSON and Markdown summary are retained as the `ci-performance-*` artifact.

A run inside the target passes. A run above the target but inside the documented tolerance remains non-blocking and is recorded. A single run above the tolerance ceiling is treated as an anomaly. A sustained ceiling breach across the configured history window is blocking. This avoids random failures from one noisy hosted runner while still preventing a slower architecture from becoming the new normal.

If the main CI run fails correctness validation, timing evidence is preserved but that incomplete run does not redefine performance history.

## Fail-safe PR shapes

Classification is deliberately conservative:

- documentation-only files may select `docs-only`;
- changes entirely inside one `packages/<name>/` package may select `package-local`;
- tokens, types, core and metadata are classified as shared;
- mixed, root-level, workflow, application or otherwise uncertain changes use `normal` full validation.

Until #822 affected execution safely narrows a docs/package-local path, the budget checker records the fallback and evaluates the actual conservative full path. Once affected execution exists, an accidental fallback remains visible in timing evidence instead of silently erasing the narrow target.

A shared or normal change unexpectedly receiving a narrowed path is a contract error: uncertainty expands validation rather than narrowing it.

## Rule for new required gates

Any new required PR gate must declare its expected critical-path impact in the implementing PR.

Before increasing the maintained budget, prefer in this order:

1. run independent work in parallel;
2. use deterministic affected scope or the package graph;
3. remove genuine duplicate execution;
4. improve safe cache reuse where the trust model allows it;
5. keep external or release-only work outside the required feedback path where correctness allows.

A new job inside the main `CI` workflow must be registered in `.github/ci-performance-budget.json` as required or explicitly non-critical. An unregistered CI job makes the budget contract fail closed so required work cannot silently appear outside timing evidence.

External workflows intentionally outside the measured critical path must be listed in `externalWorkflowsExcludedFromCriticalPath`. Moving a required correctness gate there merely to satisfy the timing budget is not allowed.

If a correctness gate still cannot fit, document the architectural reason and revise the canonical budget explicitly. Never skip, downgrade, hide, or make a correctness/security/accessibility gate optional solely to satisfy CI timing.
