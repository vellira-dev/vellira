import fs from 'node:fs/promises';
import path from 'node:path';

import { isBrowserResource404ConsoleError } from './cloudflare-blog-metrics-smoke-policy.mjs';
import {
  isBrowserResource5xxConsoleError,
  isCloudflareEdgeGeneratedGet5xx,
  recoverCloudflareEdgeGet5xx,
} from './cloudflare-edge-recovery.mjs';

export function diagnosticHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) =>
        ![
          'cookie',
          'set-cookie',
          'authorization',
          'proxy-authorization',
        ].includes(name.toLowerCase())
    )
  );
}

export async function captureDiagnostics(
  page,
  context,
  baseUrl,
  directory,
  {
    isExpected404Response,
    expectedBuildId = process.env.VELLIRA_BUILD_ID?.trim(),
  } = {}
) {
  const origin = new URL(baseUrl).origin;
  const events = [];
  const staticFailures = [];
  const errors = [];
  const handled404ResponsesByUrl = new Map();
  const handledEdgeResponsesByUrl = new Map();
  const deferredResource404ConsoleErrors = [];
  const deferredResource5xxConsoleErrors = [];
  const edgeFailures = [];
  const pending = new Set();
  const started = Date.now();
  const record = (kind, data) => {
    const event = { ms: Date.now() - started, kind, page: page.url(), ...data };
    events.push(event);
    return event;
  };
  const sameOrigin = (url) => new URL(url).origin === origin;
  const isStatic = (url) =>
    sameOrigin(url) && new URL(url).pathname.startsWith('/_next/static/');
  const isRouterDataRequest = (request) => {
    const headers = request.headers();
    const url = new URL(request.url());
    return (
      request.method() === 'GET' &&
      (url.searchParams.has('_rsc') ||
        headers.rsc === '1' ||
        Object.hasOwn(headers, 'next-router-prefetch') ||
        Object.hasOwn(headers, 'next-router-segment-prefetch'))
    );
  };
  const track = (promise) => {
    pending.add(promise);
    promise.finally(() => pending.delete(promise));
  };
  await fs.mkdir(directory, { recursive: true });
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true,
  });
  const cdp = await context.newCDPSession(page).catch(() => null);
  if (cdp) await cdp.send('Network.enable');
  else
    record('capability', {
      cdpCacheAttribution: false,
      reason:
        'Non-Chromium engine; correlate with origin logs, not inferred cf-ray',
    });
  cdp?.on('Network.requestWillBeSent', (event) => {
    if (sameOrigin(event.request.url)) {
      record('initiator', {
        requestId: event.requestId,
        url: event.request.url,
        resourceType: event.type,
        initiator: event.initiator,
        documentURL: event.documentURL,
        requestHeaders: diagnosticHeaders(event.request.headers),
      });
    }
  });
  cdp?.on('Network.requestServedFromCache', (event) => {
    record('requestServedFromCache', { requestId: event.requestId });
  });
  cdp?.on('Network.responseReceived', (event) => {
    if (!sameOrigin(event.response.url)) return;
    record('network-source', {
      requestId: event.requestId,
      url: event.response.url,
      fromDiskCache: event.response.fromDiskCache ?? false,
      fromServiceWorker: event.response.fromServiceWorker ?? false,
      fromPrefetchCache: event.response.fromPrefetchCache ?? false,
      responseHeaders: diagnosticHeaders(event.response.headers),
      protocol: event.response.protocol,
    });
  });
  page.on('response', (response) => {
    const request = response.request();
    if (!sameOrigin(response.url())) return;
    const headers = response.headers();
    const event = record('response', {
      url: response.url(),
      status: response.status(),
      method: request.method(),
      resourceType: request.resourceType(),
      document: request.isNavigationRequest(),
      fromServiceWorker: response.fromServiceWorker(),
      requestHeaders: diagnosticHeaders(request.headers()),
      headers: Object.fromEntries(
        [
          'content-type',
          'cache-control',
          'age',
          'etag',
          'cf-ray',
          'cf-cache-status',
          'x-nextjs-cache',
          'x-nextjs-stale-time',
          'vary',
          'location',
          'cdn-cache-control',
          'cloudflare-cdn-cache-control',
          'x-vellira-build-id',
          'x-vellira-request-id',
          'x-vellira-worker-version',
          'x-vellira-asset-source',
          'x-vellira-asset-sha256',
          'x-deployment-id',
          'x-nextjs-deployment-id',
        ]
          .filter((name) => headers[name])
          .map((name) => [name, headers[name]])
      ),
    });
    if (response.status() >= 400) {
      if (
        !isStatic(response.url()) &&
        isRouterDataRequest(request) &&
        isCloudflareEdgeGeneratedGet5xx({
          status: response.status(),
          method: request.method(),
          headers,
        })
      ) {
        edgeFailures.push({
          event,
          url: response.url(),
          requestHeaders: request.headers(),
          handled: false,
        });
      } else if (
        response.status() === 404 &&
        isExpected404Response?.(event)
      ) {
        handled404ResponsesByUrl.set(
          event.url,
          (handled404ResponsesByUrl.get(event.url) ?? 0) + 1
        );
      } else {
        errors.push(event);
      }
      if (isStatic(response.url())) staticFailures.push(event);
    }
    if (headers['content-type']?.includes('text/x-component')) {
      track(
        response
          .text()
          .then((body) => record('rsc', { url: response.url(), body }))
          .catch((error) =>
            record('rsc-body-unavailable', {
              url: response.url(),
              error: String(error),
            })
          )
      );
    }
  });
  page.on('requestfailed', (request) => {
    if (!sameOrigin(request.url())) return;
    const event = record('requestfailed', {
      url: request.url(),
      resourceType: request.resourceType(),
      error: request.failure()?.errorText,
    });
    // Keep every static failure, including aborts. No failure is silently suppressed.
    if (isStatic(request.url())) staticFailures.push(event);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const event = record('console', {
        text: message.text(),
        location: message.location(),
      });
      if (
        isExpected404Response &&
        isBrowserResource404ConsoleError(message.text())
      ) {
        deferredResource404ConsoleErrors.push(event);
      } else if (isBrowserResource5xxConsoleError(message.text())) {
        deferredResource5xxConsoleErrors.push(event);
      } else {
        errors.push(event);
      }
    }
  });
  page.on('pageerror', (error) =>
    errors.push(record('pageerror', { error: error.stack ?? String(error) }))
  );

  const reconcileDeferredConsoleErrors = (
    deferred,
    handledByUrl
  ) => {
    const remainingByUrl = new Map(handledByUrl);
    const unresolved = [];

    for (const event of deferred) {
      const url = event.location?.url;
      const remaining = remainingByUrl.get(url) ?? 0;
      if (remaining > 0) {
        remainingByUrl.set(url, remaining - 1);
      } else {
        unresolved.push(event);
      }
    }

    return unresolved;
  };

  const unresolvedErrors = () => [
    ...errors,
    ...edgeFailures
      .filter((failure) => !failure.handled)
      .map((failure) => failure.event),
    ...reconcileDeferredConsoleErrors(
      deferredResource404ConsoleErrors,
      handled404ResponsesByUrl
    ),
    ...reconcileDeferredConsoleErrors(
      deferredResource5xxConsoleErrors,
      handledEdgeResponsesByUrl
    ),
  ];

  return {
    record,
    edgeFailureCursor() {
      return edgeFailures.length;
    },
    recoveredDestinationEdgeFailureSince(cursor, href) {
      const targetPath = new URL(href, baseUrl).pathname;
      const failures = edgeFailures
        .slice(cursor)
        .filter((failure) => new URL(failure.url).pathname === targetPath);
      return failures.length > 0 && failures.every((failure) => failure.handled);
    },
    async recoverEdgeFailures(stage) {
      for (const failure of edgeFailures.filter((item) => !item.handled)) {
        const result = await recoverCloudflareEdgeGet5xx({
          url: failure.url,
          requestHeaders: failure.requestHeaders,
          expectedBuildId,
          requestGet: (...args) => context.request.get(...args),
        });

        record('edge-recovery', {
          stage,
          url: failure.url,
          recovered: result.recovered,
          attempts: result.attempts,
          reason: result.reason ?? null,
        });

        if (result.recovered) {
          failure.handled = true;
          handledEdgeResponsesByUrl.set(
            failure.url,
            (handledEdgeResponsesByUrl.get(failure.url) ?? 0) + 1
          );
        }
      }
    },
    assertHealthy(stage) {
      const unresolved = unresolvedErrors();
      if (staticFailures.length || unresolved.length) {
        throw new Error(
          `Browser failure during ${stage}: ${JSON.stringify({ staticFailures, errors: unresolved })}`
        );
      }
    },
    async anchor(stage) {
      for (const pathname of [
        '/__vellira_runtime',
        '/__vellira_deploy.txt',
        '/BUILD_ID',
      ]) {
        try {
          const response = await context.request.get(
            new URL(pathname, baseUrl).href,
            {
              headers: { 'Cache-Control': 'no-cache' },
              timeout: 15_000,
            }
          );
          record('deployment', {
            stage,
            pathname,
            status: response.status(),
            body: await response.text(),
            evidenceSource:
              'independent API request; not the browser HTTP cache',
          });
        } catch (error) {
          record('deployment', { stage, pathname, error: String(error) });
        }
      }
    },
    async finish(error) {
      await this.recoverEdgeFailures('finish');
      await this.anchor('finish');
      // A broken streaming response must not prevent failure artifacts from
      // being written. Its status/URL is already recorded, even without a body.
      if (pending.size) record('rsc-bodies-pending', { count: pending.size });
      const state = {
        finalUrl: page.url(),
        title: await page.title().catch(() => null),
        mainCount: await page
          .locator('main')
          .count()
          .catch(() => null),
        error: error?.stack ?? (error ? String(error) : null),
        staticFailures,
        firstBadAsset: staticFailures[0] ?? null,
        firstBadAssetInitiator:
          events.find(
            (event) =>
              event.kind === 'initiator' && event.url === staticFailures[0]?.url
          ) ?? null,
        cacheAttributionCaveat:
          'A cached cf-ray or request ID is not proof of a Worker execution. Correlate network-source events with origin request logs.',
        errors: unresolvedErrors(),
        events,
      };
      await fs.writeFile(
        path.join(directory, 'page.html'),
        await page.content().catch(String)
      );
      await fs.writeFile(
        path.join(directory, 'diagnostics.json'),
        JSON.stringify(state, null, 2)
      );
      await page
        .screenshot({ path: path.join(directory, 'page.png') })
        .catch(() => {});
      await context.tracing.stop({ path: path.join(directory, 'trace.zip') });
      console.log(
        `Browser evidence: ${directory}; finalUrl=${state.finalUrl}; title=${JSON.stringify(state.title)}; mainCount=${state.mainCount}`
      );
      if (error)
        console.error(
          JSON.stringify(
            {
              staticFailures,
              errors,
              documents: events.filter((e) => e.document),
            },
            null,
            2
          )
        );
    },
  };
}

export async function waitForRoute(page, diagnostics, baseUrl, href, title) {
  try {
    await page.waitForURL(new URL(href, baseUrl).href, { timeout: 15_000 });
    await page
      .getByRole('heading', { level: 1, name: title, exact: true })
      .waitFor({ state: 'visible', timeout: 15_000 });
    await diagnostics.recoverEdgeFailures?.(`route readiness ${href}`);
    diagnostics.assertHealthy(href);
  } catch (error) {
    await diagnostics.recoverEdgeFailures?.(`route readiness failure ${href}`);
    diagnostics.assertHealthy(href);
    throw new Error(
      `Route readiness failed: expected ${href} heading ${JSON.stringify(title)}; final URL ${page.url()}`,
      { cause: error }
    );
  }
}
