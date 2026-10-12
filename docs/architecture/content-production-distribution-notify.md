# Verified production → private Content Distribution notification

Owner: [vellira-internal #839](https://github.com/vellira-dev/vellira-internal/issues/839).
Consumer: `vellira-dev/vellira-internal/.github/workflows/content-distribution.yml`.
Producer: `.github/workflows/content-production-distribution-notify.yml`.

## Boundary

The notifier is a **separate workflow** triggered by the successfully *completed*
`Deploy Website Cloudflare Production` run on main. It does **not** modify,
gate or redeploy Cloudflare. A green staging run, skipped deploy job, emergency
deployment, or unrelated workflow is not sufficient.

The job independently re-reads the public run and its exact-attempt deployment
job. It sends only run ID, attempt, source revision and build identity in a
`repository_dispatch` event, never article body, unpublished claims or
approval credentials. The private consumer independently re-fetches the run
and job, checks all required deploy smoke/identity steps and compares the
*current* production `/__vellira_runtime` build ID
`<sha>-<production-run-id>-<attempt>`. It then binds eligible published
articles to the source SHA and revalidates exact build response headers and
canonical HTML before creating **review-only** channel variants.

Any mismatch is a failed/no-op bridge, **never** an external publishing
authorization. Approved channel delivery and real provider writes retain
their own separate human and GitHub Environment gates. An unchanged
canonical article is deduplicated by the existing Distribution state.
The Thursday distribution schedule remains as fallback until a genuine
cross-repository live proof and durable state/replay audit succeed.

## Explicit production configuration (not supplied by this PR)

1. Merge the **private receiver** #839 implementation first, prove its focused
   and complete CI, and ensure the `repository_dispatch` trigger is active on
   private `main`.
2. Create and protect the public GitHub Actions Environment
   `content-production-notification`. Do not rely on GitHub implicitly creating
   an unprotected environment during the first run.
3. Use a dedicated GitHub App installed only where required, with the minimal
   `contents:write` permission for `vellira-dev/vellira-internal` to invoke
   `repository_dispatch`; do not reuse production Cloudflare or personal tokens.
   Configure `VELLIRA_CONTENT_BRIDGE_APP_CLIENT_ID` (Environment variable)
   and `VELLIRA_CONTENT_BRIDGE_APP_PRIVATE_KEY` (Environment secret) **only**
   in that notification environment. The short-lived token is scoped at mint
   time to the one private repository.
4. Keep repository variable
   `VELLIRA_CONTENT_PRODUCTION_BRIDGE_ENABLED=false` until both workflow
   PRs have green CI, owner review and credentials/environment constraints
   verified. There is no default-on network mutation.
5. Enable for one approved controlled production article deploy. Verify
   source workflow/attempt, private `verified_production` receipt, actual
   live canonical article on the same build, and final Distribution
   `needs_approval` status. There must be **no external publisher call**.
6. Replay the same source event, trigger an unrelated production build, and
   verify deduplication/no-op. On a notification failure after a successful
   website deploy, **do not redeploy the website**. Investigate/retry the
   notification workflow; maintain protected human approval.
7. Only after reliability is established remove the old Thursday cron in a
   separate controlled PR.

## Hard exclusions

The GitHub App is not an editorial agent and must not authorize article PR
merges, content approval or social publishing. The notifier has no
`contents:write` permission in the public repository, and must never
checkout PR-supplied code or accept arbitrary workflow/event URLs.
