# Framework deployment-regression fixture

This is disposable infrastructure test UI, not maintained first-party product
UI or a component example. Native elements and Next Link deliberately isolate
the framework router, Flight transport, lazy chunks, and CSS from Vellira UI.
This is the narrow infrastructure exception to the Vellira-first consumption
policy; it must never be deployed as website content or used as a local product
component substitute.

The runner copies the fixture into a fresh build directory for each generation,
changes its JS/CSS/lazy-module bytes, and verifies the actual patched production
bootstrap. The test-only `__migrationTransport` entry calls the bundled Next
transport directly; it does not intercept fetch or implement `_rsc` itself.

The controlled origin uses real Next production servers and the production
Worker response/archive helper with a real local R2 runtime. This proves browser
and framework transitions, not live Cloudflare activation. A separate Workers
Assets integration test covers the platform's asset-first/miss-fallback routing;
live staging remains a required validation layer.
