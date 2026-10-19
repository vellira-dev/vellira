# Verified component demo capture (V1)

Creates GIF, MP4, PNG, and SHA-256 evidence from **real React Storybook**.

V1 originally proved `dropdown-keyboard`. The same reviewed pipeline now also
supports `button-confirmation`, `modal-focus`, and `select-keyboard` using existing
Button, Modal, and Select Storybook interactions.
No React Native or auto-publishing.

## Proof before merge

A dedicated PR workflow runs only when demo tooling changes.

It checks out the exact PR HEAD with read-only repository permissions.

It builds Storybook once and captures **all reviewed** Dropdown, Button, Modal,
and Select stories in Chromium. Ordinary manual runs capture only the selected
scenario.

No secrets, arbitrary URLs, or write permissions are supplied.

The PR check is separate from the required CI critical path.

Review its uploaded GIF, MP4, PNG, and manifest before merging.

## Manual capture

After merge, open **Actions → Capture Component Demo → Run workflow**.

Choose `main` and one of `dropdown-keyboard`, `button-confirmation`,
`modal-focus`, or `select-keyboard`.

The workflow uses reviewed source and never publishes to Buffer.

Its timeout is 18 minutes. Artifacts expire after seven days.

Each selected scenario produces seven review-only files:

- `<scenario>.mp4`, `<scenario>.gif`, `<scenario>.png`: raw proof media.
- `social/<scenario>-social.mp4`, `.gif`, `.png`: 1200 × 1200 branded media.
- `manifest.json`: source SHA, run ID, and all six SHA-256 checksums.

The animation uses four verified Storybook states:

Ready → Enter/open → ArrowDown highlight → Escape/close.

Capture starts only after Storybook, fonts, and trigger are ready.

Loading and navigation frames are never included.

FFmpeg verifies duration. Review the first and last frames visually.

## Local reproduction

From the Vellira repository root:

```sh
pnpm install --frozen-lockfile
node --test scripts/visual/component-demo-policy.test.mjs
pnpm exec turbo run build --filter='@vellira-ui/react-storybook^...'
pnpm --dir apps/react-storybook exec storybook build
python3 -m http.server 6006 --bind 127.0.0.1 --directory apps/react-storybook/storybook-static
```

In another terminal, with `ffmpeg` and `ffprobe` available:

```sh
node scripts/visual/capture-component-demo.mjs dropdown-keyboard
```

The CLI checks Enter, ArrowDown, Escape, and restored keyboard focus.

The CLI rejects unknown scenarios, invalid output, and oversized GIFs.

Output is ignored under `apps/react-storybook/test-results/component-demo/`.

No generated media is committed. Publishing remains a separate review step.

## Branded social output (V2)

V2 adds a publication-oriented version without replacing the raw V1 proof.

The same archive includes the following three files under `social/`:

- `dropdown-keyboard-social.mp4`: 1200 × 1200 H.264 video.
- `dropdown-keyboard-social.gif`: square looping animation, at most 8 MiB.
- `dropdown-keyboard-social.png`: branded menu-open poster.

The existing `manifest.json` retains raw file hashes and adds versioned
`social` evidence, including the proof-derived crop, phase names, dimensions,
and individual SHA-256 hashes.

Social media is rendered only from real, verified Storybook screenshots. Short
crossfades connect the four captured states; they are not fabricated component
motion. The workflow remains read-only and does not publish to Buffer.

Review [the V2 technical specification](./component-demo-social-v2.md) and
inspect the downloaded frames before approving publication.

## Button confirmation scenario (extension)

The allowlisted `button-confirmation` scenario uses the maintained
`Primitives/Button/DestructiveConfirmation` Storybook story. It verifies
keyboard activation, the confirmation panel and its enabled actions,
`aria-busy` plus disabled state while loading, and return to the enabled state.
It performs **no actual workspace deletion**. The four evidence-backed phases
are `ready`, `confirming`, `loading`, and `closed`.

The output follows the existing contract under the selected scenario directory:
`button-confirmation.mp4`, `.gif`, `.png`, plus
`social/button-confirmation-social.mp4`, `.gif`, `.png` and a SHA-256 manifest.
All reviewed scenarios reuse the single square 1200 × 1200 renderer,
official Vellira logo/fonts, read-only workflow permissions, exact-head checks
and 7-day artifact retention. A demo-tooling PR runs all scenarios sequentially
within **one** existing path-filtered job. No second agent, scheduled job or
Buffer publication is introduced.

## Modal focus and Escape scenario

The allowlisted `modal-focus` scenario uses the existing
`Components/Modal/Default` Storybook story. It captures real browser behavior:
Enter opens the dialog, focus moves inside the portal, Tab moves to Cancel,
and Escape closes it and restores focus to the trigger. The browser also checks
`aria-modal=true` and verifies that the dialog is rendered outside Storybook's
root. No account settings are saved or remote services called.

Four reviewed phases (`ready`, `opened`, `focused`, `closed`) produce
`modal-focus.mp4`, `modal-focus.gif`, `modal-focus.png` and their
branded `social/modal-focus-social.*` counterparts with SHA-256 evidence.
The focused story and real dialog geometry determine the crop. The existing
manual workflow now offers four choices; pre-merge demo-tooling validation
runs Dropdown, Button, Modal and Select in the same isolated proof job.

## Select keyboard choice scenario

The allowlisted `select-keyboard` scenario uses the real
`Components/Select/SimpleUsage` Storybook story. Chromium verifies a collapsed
combobox showing `Country`, Enter opening the portaled listbox, ArrowDown
highlighting Germany, and Enter selecting Germany while retaining focus.
No form submission or backend write occurs.

The four source-verified phases are `ready`, `opened`, `highlighted`, and
`selected`; the poster uses the highlighted listbox screenshot. Outputs
include raw `select-keyboard.{mp4,gif,png}` and
`social/select-keyboard-social.{mp4,gif,png}` plus SHA-256 manifest.

The existing path-filtered PR workflow runs all four scenarios sequentially
in one Storybook build. Manual captures still select one specific demo.
No new agent, package, auto-merge, scheduler, or Buffer publisher is added.
