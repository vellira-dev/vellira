# Verified component demo media — permanent website hosting

## Authority and approved content

Five reviewed Vellira React Storybook scenarios: Dropdown, Button, Modal,
Select and Tabs. Approved binary media came from completed GitHub Actions
run `39277740730` on exact source commit
`260850f9e5f2fb51e9095b739e63952ce6a7e1cc`.

The [Stage Verified Component Demo Media](../.github/workflows/stage-verified-component-media.yml)
workflow is manually dispatched from `main` with confirmation
`STAGE_MEDIA_REVIEW_PR`. Its sole purpose is to download that immutable,
successful artifact, validate the five manifests and all 15 social media
SHA-256 digests, then open a **review-only PR** to add:

`apps/website/public/media/component-demos/v1/<scenario>-social.{mp4,gif,png}`

An `index.json` at the same location records source provenance, actual
hashes and content filenames. No raw proof assets enter the website build;
those remain in the exact-source Actions artifact.

## Controlled promotion

1. Merge this preparatory workflow PR only after CI/review.
2. On `main`, manually dispatch the staging workflow once. It creates an
   asset PR and does not deploy the assets directly.
3. Review the asset PR in GitHub, inspect its staging build and deployment
   size. Merge only after the site build and production promotion gates pass.
4. Confirm **public** direct URLs return their binary MIME types:

   - `https://vellira.dev/media/component-demos/v1/dropdown-keyboard-social.mp4`
   - `https://vellira.dev/media/component-demos/v1/button-confirmation-social.mp4`
   - `https://vellira.dev/media/component-demos/v1/modal-focus-social.mp4`
   - `https://vellira.dev/media/component-demos/v1/select-keyboard-social.mp4`
   - `https://vellira.dev/media/component-demos/v1/tabs-keyboard-social.mp4`

   Every scenario also has `.gif` and `.png` siblings. These are
   **planned** URLs, not live until approved asset PR merge and production
   deployment. Confirm they are downloadable by an unauthenticated client
   before using them with Buffer.

5. Attach **only verified live links** to the existing five Buffer Ideas
   and obtain owner's manual editorial approval before creating posts.

## Guardrails

- No social scheduling or automatic Buffer posting.
- No automatic merge, no extra domain, storage credentials or cloud vendor.
- The immutable source artifact must be successful and match the pinned SHA.
- SHA and byte-length verification rejects tampered media.
- Each git upload is reviewable through repository rulesets and CI.
- Do not treat short-lived GitHub Actions artifact links as permanent
  Buffer media sources.
