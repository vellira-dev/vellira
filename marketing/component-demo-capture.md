# Verified component demo capture (V1)

Creates GIF, MP4, PNG, and SHA-256 evidence from **real React Storybook**.

V1 permits only `dropdown-keyboard`. No React Native or auto-publishing.

## Proof before merge

A dedicated PR workflow runs only when demo tooling changes.

It checks out the exact PR HEAD with read-only repository permissions.

It builds Storybook and captures the real Dropdown in Chromium.

No secrets, arbitrary URLs, or write permissions are supplied.

The PR check is separate from the required CI critical path.

Review its uploaded GIF, MP4, PNG, and manifest before merging.

## Manual capture

After merge, open **Actions → Capture Component Demo → Run workflow**.

Choose `main` and `dropdown-keyboard`.

The workflow uses reviewed source and never publishes to Buffer.

Its timeout is 18 minutes. Artifacts expire after seven days.

The artifact contains four files:

- `dropdown-keyboard.mp4`: social video.
- `dropdown-keyboard.gif`: looping GIF, under 8 MiB.
- `dropdown-keyboard.png`: menu-open preview.
- `manifest.json`: source SHA, run ID, and SHA-256 checksums.

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
