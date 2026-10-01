# Local build tooling and runtime secrets

`BUTTONDOWN_API_KEY` is a Cloudflare Worker runtime secret. It must remain in
`secrets.required` in both `wrangler.jsonc` and `wrangler.production.jsonc`.
Provision it as described in [the migration runbook](CLOUDFLARE_MIGRATION.md#newsletter-runtime-secret).
Never commit a value, add a placeholder credential, or export the real key into a
GitHub Actions build just to silence a local warning.

## Next.js phases

`next.config.ts` initializes the OpenNext development proxy only during
`PHASE_DEVELOPMENT_SERVER`. Static production builds and `next start` do not
initialize it merely by loading the configuration. Actual Worker requests still
receive their runtime bindings through OpenNext. Development retains the canonical
configuration and its missing-secret warning; initialization errors are not hidden.

## Local cache preparation

Use the shared helper from the repository root:

```sh
node apps/website/scripts/cloudflare-populate-local-cache.mjs
node apps/website/scripts/cloudflare-populate-local-cache.mjs wrangler.production.jsonc
```

The helper still executes the installed OpenNext `populateCache local` command.
It first validates the canonical target using Wrangler's parser, then writes a
unique, temporary sibling JSONC file. This derived configuration keeps cache
bindings, compatibility settings and relative asset paths, but has an explicit
empty required-secret list, a non-production Worker name, and no public routes or
preview endpoints. Environment overlays and explicitly remote bindings are
rejected. Only the local command is exposed; arbitrary flags and remote commands
are rejected. The temporary file is removed on success and ordinary failure.

CI, staging, production and the identity-locked legacy tooling use this helper
before their existing runtime/archive gates. It does not modify the canonical
configuration or intercept logging. Missing-runtime-secret noise is absent from
local cache emulation; other warnings and process failures remain visible.

## Deployment boundary and validation

Real Wrangler dry-runs and deployments still receive the original target config,
not the local projection. The deployment-target validator rejects the projection's
Worker name. Both canonical configurations continue to declare the required
newsletter secret; Wrangler's remote required-secret validation remains enabled.
Approval, candidate identity, freshness, archive checks and postflight checks are
unchanged. The helper is not an alternative deployment entry point.

`pnpm test:cloudflare-cache` includes `cloudflare-local-tooling.test.mjs`. Tests
cover phase-dependent initialization, strict canonical configs, local projection
isolation, preserved paths and bindings, cleanup, command rejection, actual
installed Wrangler warning behavior, and the maintained invocation paths. The
existing CI OpenNext build then exercises real local cache preparation and runtime
validation. A source-level test is not proof of a successful live deployment.
