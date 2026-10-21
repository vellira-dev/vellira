# Component Demo Social Media — Immutable Public Hosting V1

## Purpose

Retain the first five approved, real-Storybook social captures as ordinary static
assets of the existing Vellira website. This is **asset hosting only**:
it does not publish, schedule or approve any Buffer content.

## Approved source authority

- Repository: `vellira-dev/vellira`
- Exact source commit: `260850f9e5f2fb51e9095b739e63952ce6a7e1cc`
- Successful browser/media run: [39277740730](https://github.com/vellira-dev/vellira/actions/runs/39277740730)
- Artifact ID: `12199925799`
- Expected scenarios: `dropdown-keyboard`, `button-confirmation`,
  `modal-focus`, `select-keyboard`, `tabs-keyboard`.

The artifact originally contains 35 entries (5 manifests and 30 raw/social
media files). The isolated promotion step verifies **all 30 source media
SHA-256 digests**, byte lengths, all five manifests, source SHA, run ID,
scenario allowlist and static media headers. It refuses extra files,
symlinks and overwriting any existing version. Only the **15 social media
files** are copied to `apps/website/public/media/component-demos/v1/`.
The generated `catalog.json` retains exact provenance and public SHA-256
claims, with no sensitive tokens or private data.

The reviewed source artifact expires after seven days; once promoted, the
binary assets live in the Git source tree itself and can be rebuilt and
redeployed indefinitely without depending on that GitHub Actions artifact.

## Public URL contract (after merge and production website deployment)

For each scenario `<id>` the following URLs are fixed:

- `https://vellira.dev/media/component-demos/v1/<id>/<id>-social.mp4`
- `https://vellira.dev/media/component-demos/v1/<id>/<id>-social.gif`
- `https://vellira.dev/media/component-demos/v1/<id>/<id>-social.png`
- `https://vellira.dev/media/component-demos/v1/catalog.json`

These are Workers static assets, **not** R2's internal deployment archive.
The existing `/api/*` and `/_next/static/*` routing must not change.
The immutable `v1` URLs must never be overwritten after publication:
use a new versioned directory if a demo is revised. The scoped
`public/_headers` cache policy is one-year immutable.

## Promotion procedure

A one-time workflow on the isolated
`feat/component-demo-media-hosting-20261019` branch downloads the exact
successful artifact, checks every byte, and commits only the reviewed social
files to that staging branch. It needs branch-local `contents: write` for
that **single action**. Do not deploy production, create media URLs, or
publish Buffer posts before human review.

After the media commit is verified, **remove the one-time workflow from the
feature branch before opening or merging the final PR**. The permanent PR
contains only the static media, public cache header, deterministic provenance
generator/tests and this document, no privileged workflow.

The owner merges the reviewed PR manually. The normal, already-governed
Cloudflare staging/production website deployment must then activate the
updated static files. Confirm public HTTPS GET 200, correct image/video MIME,
exact SHA-256 and positive `Content-Length` for the catalog and each of the
15 assets. Do not claim hosting is active until this actual HTTP proof passes.

## Buffer editorial approval

The five Buffer Ideas are currently text-only, unscheduled, and contain no
media URLs. After verified production GETs, attach the public MP4 or GIF URLs
to the corresponding ideas (or create draft posts for the selected channel),
keeping manual editorial and posting approval. Never use short-lived GitHub
Actions artifact URLs, sandbox links or Cloudflare preview URLs as Buffer
media attachments. Existing scheduled Buffer posts remain untouched.

## Security/operating limits

No Cloudflare secrets, new Workers, additional buckets, CDN domain, extra
business-service account, scheduled automation, automatic Buffer posting or
change to production runtime routing. Promotion is create-only, exact-SHA
pinned and refuses any incomplete source evidence. Don't keep a write-token
workflow in main.
