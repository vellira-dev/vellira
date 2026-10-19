# Verified component demo capture (V1)

Capture **real interactions** from the exact source revision of Vellira's existing
React Storybook, without a second agent or a publishing integration. V1 supports
`dropdown-keyboard` only. It does **not** capture React Native, publish a post,
change components, approve content, or modify Buffer.

## Pre-merge proof

A separate `pull_request` trigger runs **only for changes to the capture scripts
or capture workflow**. It checks out the exact PR HEAD, builds Storybook and
runs the real Chromium scenario before any merge. This job is not a required CI
lane and is not triggered for ordinary component or website pull requests. It
uses no secrets, write permissions, or social credentials and accepts only
same-repository PRs. Inspect its media artifact on the *final HEAD* before Ready.

## Manual GitHub Actions run

After the workflow is merged, visit **Actions → Capture Component Demo → Run
workflow**, select the **main** branch and `dropdown-keyboard` scenario. The run
uses the dispatched immutable `main` commit in the pinned Linux Playwright image;
it does not accept a user URL or an unreviewed arbitrary script.

On success, download the `component-demo-dropdown-keyboard-*` artifact. It contains:

- `dropdown-keyboard.mp4` — video to prefer for social platforms when supported;
- `dropdown-keyboard.gif` — looping GIF, capped at 8 MiB;
- `dropdown-keyboard.png` — image of the verified menu-open state;
- `manifest.json` — source SHA, story ID, run identity and SHA-256 checksums.

The recording is assembled from four verified, **post-load** real Storybook
states: ready → opened → ArrowDown highlighted → Escape closed. Navigation,
font loading and startup frames are *never* captured. FFmpeg encodes this
post-load frame sequence, and the CLI validates resulting GIF/MP4 durations.
The first and last frames should also be visually inspected before publishing.

The workflow has read-only repository permissions, no social credentials, no
commits and no Buffer scheduling. Its runtime is bounded at 18 minutes and its
artifacts expire after seven days. It does not extend the required CI critical
path. Verify all generated media visually, confirm public claims, and approve
the final social copy **before** adding media to Buffer. Uploading GIF/MP4 into
social posts is a separate human-reviewed step.

## Local reproduction (optional)

Build Storybook from the intended local commit:

```sh
pnpm install --frozen-lockfile
node --test scripts/visual/component-demo-policy.test.mjs
pnpm --filter @vellira-ui/react-storybook build
python3 -m http.server 6006 --bind 127.0.0.1 --directory apps/react-storybook/storybook-static
```

In another terminal, with `ffmpeg` and `ffprobe` available:

```sh
node scripts/visual/capture-component-demo.mjs dropdown-keyboard
```

The CLI accepts only the reviewed allowlisted scenario and local Storybook
endpoint `127.0.0.1:6006`. It asserts the actual menu opens via Enter, responds
to ArrowDown, closes via Escape and restores focus. It fails rather than emitting
finished assets if these checks, clip duration, or GIF-size bounds fail.

Outputs remain in the ignored
`apps/react-storybook/test-results/component-demo/dropdown-keyboard/`
directory. No artifacts are committed. Extend the allowlist only with new
reviewed real-story scenarios and matching behavioral assertions.
