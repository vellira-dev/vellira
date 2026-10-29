# Vite consumer bundle size observations — #470 (report-only V1)

This is a **within-candidate size measurement**, not a shipping-size assertion for every
application, a cross-commit regression delta, or an authorization to change public exports.

The existing Release Candidate Proof `vite-consumer` job installs the exact packed
web packages once. The same locked fixture then builds:

- **bare:** React and ReactDOM, no Vellira runtime or styles import
- **button:** adds Vellira Button plus the documented `@vellira-ui/tokens/css` and `@vellira-ui/react/styles` imports
- **buttonInput:** the existing representative Button + Input production fixture using the same styles

The script sums production `.js` and `.css` assets under `dist/assets`,
excluding source maps and unrelated build artifacts. It also reports gzip level 9
bytes **per asset**. Variant deltas are **Button - bare** and
**Button+Input - Button**, within the same pinned tooling/runtime and package graph.

Evidence is retained in the existing `vite-consumer-evidence-<SHA>` artifact
under `bundleSize`, printed to the job log and GitHub Job Summary.
No additional `npm install`, GitHub Actions job or publication is triggered.

Limitations: This is not the entire component catalog; a full-stylesheet
import can make CSS identical across Button and Button+Input. Gzip asset totals
are not necessarily downloaded bytes for a specific route, or actual runtime
memory. The result does not measure Hermes/Metro, Lottie dynamic assets,
shared-host caching, browser CSS coverage, or incremental PR-vs-main size.

**Remaining #470 acceptance:** capture released baseline numbers; add accurate
cross-commit PR deltas, expand representative/full UI fixtures, obtain opt-in
bare/Button/Button+Select native iOS/Android measurements via the existing
`scripts/performance/native-metro-matrix.cjs`, and set evidence-based warning
thresholds. Keep this mode report-only until these measurements are reviewed.

## Phase A: exact main versus PR report

The baseline snapshot is in scripts/performance/baselines/vite-main-2.188.3.json.
It comes from immutable Vite evidence artifact 12919319480, workflow
40925105070, measured source 9312d68f643b595532acd352eaab77c3f1fb85a5.
The source has the **identical Git tree** to its canonical post-squash main
commit 6a861bb6d09cfd4e518c80f240b28156e5e32bfd, tree 199fbf64.
This is an exact source-equivalence argument, **not** a claim that the
main build was separately rerun.

The existing Clean Vite Release Candidate job already builds and packs
the PR candidate. Its report now reads the immutable main snapshot and
the exact base SHA from the pull-request event. It accepts comparisons
only after independently verifying the recorded main Git tree, ancestry,
unchanged package and toolchain inputs between main snapshots, unchanged
fixture construction and size methodology, identical Node/npm/Vite/TypeScript
versions, and the identical scenario/metric schema.

For comparable results the existing GitHub job summary and retained JSON
report signed PR-minus-main bytes and percentages for JS/CSS, raw and gzip,
for each fixture. A zero denominator becomes NEW or —, never infinity.
Missing or stale main, changed fixture, missing Git proof, and changed
toolchain each produce an explicit **non-comparable** status with **no deltas**.
No new Actions job, npm installation or second pack is introduced.

**Refresh procedure:** Obtain a verified clean Vite consumer artifact from an
exact immutable main source, or prove the measured candidate tree is exactly
identical to that main tree. In a reviewed snapshot commit, update source SHA,
main/tree SHA, source run/artifact, exact toolchain versions, measured scenario
numbers and release candidate manifest digest. Verify the new main commit
and tree in GitHub before editing. Never merely change the SHA on old data;
stale comparisons should remain visibly stale until the new evidence exists.

**Threshold policy:** one baseline measurement does not reveal normal run
variance. Observed increases are shown in report-only mode with the explicit
NOT_CALIBRATED threshold state, with no blocking size limit. Establish
data-driven warning thresholds after independently repeating identical
source/toolchain builds; calibrate by scenario and measured metric. Promote
warnings to a required blocking check only with reviewed evidence and owner
approval.

**Out of scope for Phase A:** measuring the entire UI catalog, HTTP transfer,
Lottie assets, and production Metro/Hermes. Native measurement is an opt-in
Phase B follow-up using the existing native-metro-matrix.cjs harness.
