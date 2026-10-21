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

`CI Performance Budget` is the final job of the existing pull-request `CI` workflow. Its `needs` list includes PR Impact and every measured correctness job, so GitHub schedules it only after those dependencies finish; waiting consumes no runner. The separate polling workflow is retired. The native PR check name, read-only token, numeric budgets, and correctness gates are preserved. No privileged `workflow_run` publisher is involved.

The observer checks out its tooling, tests, and policy from the exact `github.sha` revision that runs this pull-request workflow. For this event that is the [original PR merge commit](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request), and [reruns preserve the original SHA](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs); it is not a mutable branch reference. Existing correctness jobs continue to test the original candidate head. Keeping those identities separate lets an older unchanged PR use the updated observer without checking out its obsolete polling script and waiting for itself. This follows the existing quality-tooling checkout contract and grants no additional token permissions.

The checker reads its own `GITHUB_RUN_ID` and `GITHUB_RUN_ATTEMPT`, validates repository/workflow/original-head identity, and requests only that attempt's paginated job timestamps. Every returned job must carry the same run ID, attempt, and original head SHA. It does not discover a latest run by SHA or wait for its own workflow to complete. The running observer is explicitly non-critical and excluded from timing and correctness decisions. All other jobs must have completed; a partial rerun with missing jobs fails closed and requires a full CI rerun to produce complete timing evidence.

GitHub's jobs API can briefly lag behind completed native dependencies. Only for a recognized missing/nonterminal/null-result snapshot, the observer rereads that same run and attempt at most six times, five seconds apart (at most 25 seconds of delay). Run and job identity are checked on every read. Unknown conclusions, unregistered or duplicate jobs, identity mismatches, confirmed terminal failures, and invalid completed-job timestamps cannot retry into a passing result. A still-incomplete final snapshot is blocking; a complete snapshot proceeds through the same correctness, scope, timestamp, and numeric budget checks. Evidence includes the number of metadata reads.

PR Impact records the changed-file list in a separate workflow-owned step before running the candidate's classifier. The step diffs the original event's immutable base/head commits and exports its own output; it works when an older candidate classifier has no changed-file output, and later classifier outputs cannot replace it. The successful `CI performance shape: <shape>` step records the classification in immutable attempt metadata for historical comparisons, without looking up the PR's potentially newer head or changed files.

Each run records:

- repository, PR, head/base SHA and changed-file classification;
- exact CI run ID and attempt, tooling workflow SHA, and completed dependency results;
- required job inventory and per-job duration;
- required-check feedback wall clock from CI run creation to the last required job completion;
- declared shape target and effective budget;
- whether a narrow PR fell back to the conservative full path;
- comparable recent samples and the canonical #822/#1032 baseline;
- pass, tolerance, anomaly, sustained-failure, or contract-error result.

The JSON (schema version 2) and Markdown summary are retained as the `ci-performance-*` artifact, whose name includes head SHA, run ID, and attempt.

A run inside the target passes. A run above the target but inside the documented tolerance remains non-blocking and is recorded. A single run above the tolerance ceiling is treated as an anomaly. A sustained ceiling breach across the configured history window is blocking. This avoids random failures from one noisy hosted runner while still preventing a slower architecture from becoming the new normal.

If native `needs` results confirm a correctness failure or cancellation, timing evidence is preserved with a non-blocking `not-evaluated` result; the original failing correctness checks remain authoritative and that run does not redefine performance history. The observer runs with `always()` so ordinary dependency failures and deliberate affected-path skips still produce evidence. Inventory drift, unfinished dependencies, missing or unrecognized API conclusions, contradictory failure evidence, unexpected narrowing, invalid timestamps, and sustained regressions remain blocking failures. In particular, an API job marked `completed` with a null conclusion cannot turn an unevaluated budget into a passing check.

Historical samples also use an exact attempt and require successful or deliberately skipped correctness jobs. A slow run whose only failure is the performance observer remains eligible; otherwise budget failures would erase evidence of their own regression. Samples remain distinct across PRs, excluding the current PR's reruns. New samples use the recorded shape step. Older full-path samples retain their normal-budget comparison; older affected runs without an immutable shape are conservatively omitted. The canonical #822/#1032 baseline and history thresholds are unchanged.

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
