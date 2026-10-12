# Verified production content notification

Owner: vellira-internal #839.

The public notification workflow does not alter Cloudflare deployment.
It only sends immutable workflow run identity after verified production.

GitHub's production workflow `head_sha` can differ from the immutable
staging commit actually deployed. The notifier therefore reads the active
`https://vellira.dev/__vellira_runtime` build identity and requires it to
end with the exact production run ID and attempt. It derives the deployed
candidate SHA from that verified build ID, **not** from the workflow checkout.

The private Content Distribution workflow independently verifies the public
production run, successful deployment job, active build identity and live
canonical article before preparing reviewable channel variants.

## Read-only canary before configuration

Run the **Content Production Bridge Preflight** workflow manually from public
`main` after its PR is merged. The workflow only reads existing GitHub Actions
records and public `vellira.dev` responses; it cannot send
`repository_dispatch`, create an App token, run Cloudflare deployment or
publish to an external channel.

A confirmed successful production deployment from 2026-10-12 is
[run 38251246967](https://github.com/vellira-dev/vellira/actions/runs/38251246967),
**attempt 2**, with actual `Deploy and verify approved production candidate`
job `success`. Use it as the first candidate with `article_slug=two-runtimes`.
It passes only while its build is **still** the active production build; a
newer deployment must use its own successful run ID and attempt. A successful
`release-sync no-op` is *not* a valid candidate.

The preflight displays the repository enable flag's boolean state without
reading or exposing secrets. It cannot determine protected Environment/App
configuration, so read-only GREEN is not activation.

## Controlled activation

- Merge private receiver #841 after all required checks pass.
- Create and protect environment `content-production-notification`.
- Install a dedicated GitHub App with `contents:write` on `vellira-internal`.
- Provide `VELLIRA_CONTENT_BRIDGE_APP_CLIENT_ID` as an environment variable.
- Provide `VELLIRA_CONTENT_BRIDGE_APP_PRIVATE_KEY` as an environment secret.
- Keep `VELLIRA_CONTENT_PRODUCTION_BRIDGE_ENABLED=false` until a pilot.
- Enable one approved pilot and verify that no external publisher is called.
- Keep the Thursday Distribution fallback until the bridge is proven.

A notification is never content approval, publication authorization or
permission to bypass the existing human review and protected publisher.
