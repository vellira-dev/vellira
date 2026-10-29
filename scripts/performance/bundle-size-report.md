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
