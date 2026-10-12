# Verified production content notification

Owner: vellira-internal #839.

The public notification workflow does not alter Cloudflare deployment.
It only sends immutable workflow run identity after verified production.

The private Content Distribution workflow independently verifies the public
production run, successful deployment job, active build identity and live
canonical article before preparing reviewable channel variants.

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
