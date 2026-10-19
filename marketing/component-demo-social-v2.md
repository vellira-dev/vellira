# Component Demo Social V2 — Technical Specification

## Goal

Render publication-ready, square assets from already verified Vellira Storybook
interactions. V1 proof assets remain authoritative and separate. No new agent,
component implementation, CI-wide job, or social publishing integration.

## Admission and ownership

- V2 introduced the **Dropdown keyboard** demo on React web. Reviewed Button
  confirmation and Modal focus/Escape scenarios now reuse the same proof/social
  renderer and have separate allowlisted Storybook scenarios. Select/Tabs
  remain outside this version.
- The source story is the allowlisted `components-dropdown--default`.
- Raw proof capture remains the existing V1 path and filenames.
- Input must be an exact Git SHA and local Storybook on `127.0.0.1:6006`.
- The canonical Vellira wordmark and WOFF2 fonts are read from existing assets.
- The social composition only arranges real screenshot pixels and static text.
  It must not redraw, simulate, or modify the component's UI or behavior.

## Output contract

The existing root files are unchanged:

- `dropdown-keyboard.mp4`, `dropdown-keyboard.gif` and `dropdown-keyboard.png`.
- `manifest.json` with their sizes and SHA-256 checksums.

Add a separate `social/` directory containing:

- `dropdown-keyboard-social.mp4` — 1200 × 1200, H.264, 24 fps.
- `dropdown-keyboard-social.gif` — 1200 × 1200, 12 fps, at most 8 MiB.
- `dropdown-keyboard-social.png` — 1200 × 1200, menu-open poster.

The manifest adds a versioned `social` record: profile, provenance, bounded crop,
phase names, dimensions, and hashes for all three new files. Social failure
removes the whole local output, never silently emits a partial success.

## Composition

- Square 1200 × 1200, dark Vellira backdrop, canonical lavender wordmark.
- Title: `Dropdown`; subtitle: `Keyboard navigation and Escape handling`.
- A large light screenshot panel crops the real trigger and portaled menu.
- Crop is derived from the trigger/menu bounding boxes, padded and validated.
- Four proof-backed states: Ready, Enter/Open, ArrowDown/Navigate, Esc/Close.
- Short **crossfades between verified stills**, not fabricated UI motion.
- Footer: `Built with Vellira` and `storybook.vellira.dev`.
- The Vellira Sans font files are embedded only in rendered pixels; no font files
  are included in downloadable artifacts.

## Validation and delivery gates

- Positive/negative unit tests: allowlist, crop bounds, phase indices,
  stage text, invalid geometry and invalid source images.
- Runtime test on the exact PR HEAD in the existing path-filtered, isolated
  `Capture Component Demo` workflow. It builds Storybook once, then executes
  proof and social capture without privileged credentials.
- FFmpeg and ffprobe check positive output, dimensions, duration, GIF cap.
- Human visual review of first/open/highlight/last frames and 1200px poster.
- Quality/format checks, normal CI and performance budget on exact final HEAD.
- Do not merge on a stale or failed check; do not upload to Buffer automatically.

## Out of scope

- React Native capture, Select/Tabs and unreviewed components, generative
  media, new packages.
- Auto-merging, social scheduling, external URLs, AI writers, persistent storage.
- Replacing actual component animation with fake motion or marketing claims.

## Follow-up after V2 acceptance

Add independently verified scenarios for Select and Tabs through new
allowlist entries and targeted behavior assertions. Keep a single social
renderer, one capture pipeline, and existing manual publication controls.

## Reviewed Button extension

Use `button-confirmation` to demonstrate keyboard activation of the canonical
Vellira Button, real confirmation state, loading with `aria-busy=true` and
disabled interaction, and automatic return to ready. The underlying maintained
Storybook story simulates the action with a local timer; it does not delete any
real workspace or call a backend. Real screenshot frames are captured only
after visual and behavioral assertions pass.

The social renderer receives per-demo phase captions, subtitle and poster phase,
but keeps the same 1200 × 1200 profile and honest short crossfades. Both
Dropdown and Button must pass exact-head pre-merge capture whenever this
capture infrastructure changes. Manual runs stay opt-in and capture only the
selected scenario. No changes to V1 Dropdown output contracts are permitted.

## Reviewed Modal focus extension

Use `modal-focus` to demonstrate the canonical `Components/Modal/Default`
story. The real Playwright session confirms portal ownership, dialog semantics,
keyboard opening, initial focus, Tab navigation, Escape dismissal and final
focus restoration. The source component and its public API are untouched.

The social renderer reuses the four existing proof-backed screenshot phases and
square layout, with Modal-specific captions and a poster showing the open
Dialog. A capture-tooling PR runs all three reviewed scenarios sequentially in
one read-only job; manual runs generate only the owner's chosen scenario.
Artifacts require independent visual inspection before any publication.
