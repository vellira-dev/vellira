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

## Phase B — representative Web and opt-in Native Metro measurements

The existing clean Vite Release Candidate job now builds one extra **typed**
representative composition of 11 published components: Button, Input,
Checkbox, Switch, Textarea, Select, Tabs, Dropdown, Tooltip, Modal and Portal.
It measures emitted JS/CSS and compares within the same packed candidate against
Button+Input. This is **separate** from the versioned `bundleSize.scenarios`
baseline schema, and must not silently invalidate Phase A.

The Native proof is **opt-in** and has NO periodic or pull-request Actions job.
On a machine with Node and npm, from the repository root:

```sh
VELLIRA_NATIVE_VERSION=2.188.3 \
VELLIRA_METRO_PRODUCTION_ONLY=1 \
VELLIRA_METRO_EVIDENCE=consumer-evidence/native-metro-2.188.3.json \
node scripts/performance/native-metro-matrix.cjs
```

Use a separately verified immutable **published npm version**, not local workspace
builds. The diagnostic installs four isolated Expo/RN consumers using **normal
npm peer resolution** (not legacy-peer-deps) and checks that Picker is absent.
It records Node/npm versions, Git source SHA, pinned fixture dependencies,
per-case `package-lock.json` SHA-256, published native manifest peers and
production iOS/Android export measurements:

- baseline React Native without Vellira
- ThemeProvider only
- ThemeProvider + Button
- ThemeProvider + Button + Select

The relevant comparable byte metrics are `cases[*].platforms[ios|android]`
`scriptBytes`, `outputBytes` and `deltaFromBaseline`/`deltaFromButton`.
Production-only mode omits the additional development source-map exports,
reducing the cost of this **manual, one-off diagnostic**. Omitting dev maps
also means no development module inventory is claimed from this mode.
The fixture includes a real ThemeProvider, so the Button and Select examples
use a valid Vellira context.

Do not interpret npm tarball size, development source-map module counts,
Metro export bytes, Hermes execution, app startup time, HTTP transfer, or native
binary size as interchangeable metrics. A production Metro export is **not**
a runtime emulator check. Previous iOS/Android interaction proofs belong to
#1906 and do not need repetition for this measurement.

**Phase B completion:** capture and review one real JSON result from each
production platform plus the representative Web result; record source/tooling
identity and note any nonzero deltas. Keep #470 open until all required data,
warning calibration policy and owner review are documented. The old Phase A
baseline can correctly be `BASELINE_STALE` after releases, and must be
refreshed from independent source-equivalent evidence, not re-labelled.
