# Newsletter global budget — Cloudflare deployment admission

Status: **design only**. Tracking: #1728 and #1712.

No Durable Object namespace, binding, deployment, or provider quota enforcement is activated by this document.

## Current state

The newsletter handler has an optional global admission callback before the Buttondown subscriber-create request. Missing or `0` mode leaves this callback disabled.

The coordinator currently stores a monotonically increasing `spent` count with no quota window or reset. It is **not a daily budget implementation**. Neither production nor staging declares a global budget Durable Object binding.

## One authoritative namespace

A shared Buttondown account requires one authoritative budget namespace and object identity across every writer.

- Prefer a dedicated budget Worker owning a SQLite-backed Durable Object. The staging and production websites should reference the same owner through `script_name`, subject to security review.
- Confirm which environments and other clients share the Buttondown account. Different API keys do not necessarily imply separate account quotas.
- Stable object names are insufficient if the callers reference separate namespaces.
- Never create independent staging and production coordinator classes for a shared account budget.
- Review Durable Object naming, migration, permission scope, operational cost, and rollback before deployment.
- Use one Cloudflare-supported class lifecycle approach. Do not mix declarative exports with legacy migration configuration.

## Provider evidence required

Before runtime activation, verify the actual Buttondown account quota, request accounting, window and reset semantics, and any other subscriber-create writers. Do not assume a universal 100-request daily limit or a UTC reset boundary.

Conservative admission must account for ambiguous provider outcomes without refunding possibly consumed capacity. Reserve provider quota for legitimate engineering newsletter requests.

A single global counter cannot prevent malicious traffic from exhausting the budget. Review Cloudflare WAF coverage, including custom domains and Workers.dev.

If any required provider fact remains unverified, leave enforcement OFF.

## Separate rollout approvals

1. Inspect actual Cloudflare account WAF controls, Worker routes, telemetry, and deployment permissions.
2. Review a standalone namespace-owner infrastructure PR. It must not send Buttondown requests.
3. Prove remote Cloudflare storage persistence, concurrency, and namespace identity using synthetic traffic.
4. Review website bindings that reference the same authority and remain OFF by default.
5. Validate the provider quota and implement the required window/reset model in a separate reviewed PR.
6. With explicit owner approval, conduct a short staging-only ON test without provider writes and restore OFF immediately afterward.
7. Treat production activation as a separate decision. Public Pro and global budget modes remain OFF until then.

## Acceptance criteria

- Exact-head CI is green and no secrets or subscriber payloads enter logs.
- Tests reject independent namespace ownership for environments sharing the same provider account.
- Concurrent callers cannot admit more than the configured global maximum.
- Missing bindings and coordinator failures deny before Buttondown whenever enforcement is enabled.
- OFF preserves ordinary newsletter behavior without spending budget.
- Rollback instructions cover failures after deployment and require verified OFF restoration.

## References

- https://developers.cloudflare.com/workers/wrangler/configuration/#durable-objects
- https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
- https://github.com/vellira-dev/vellira/issues/1728
