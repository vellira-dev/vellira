import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { captureBrowserJson } from './cloudflare-browser-json.mjs';
import {
  destinationEdgeFailures,
  runRecoverableClientNavigation,
} from './cloudflare-client-navigation-recovery.mjs';

import {
  BLOG_METRICS_PUBLICATION_MODE_STAGING_CANDIDATE,
  buildBlogMetricsBatchPath,
  candidateOnlyBlogSlugs,
  classifyBlogMetricsAggregateResponse,
  isBrowserResource404ConsoleError,
  isExpectedStagingCandidateBlogMetricsRequest,
  isPotentialStagingCandidateBlogMetricsRequest,
  parseBlogMetricsErrorCode,
  parseBlogPublicationManifest,
  reconcileHandledBlogMetrics404ConsoleDiagnostics,
  resolveBlogMetricsPublicationMode,
} from './cloudflare-blog-metrics-smoke-policy.mjs';
import {
  cloudflareEdgeReplayHeaders,
  readCloudflareDiagnosticGet,
  recoverCloudflareEdgeFailure,
  isBrowserResource5xxConsoleError,
  isCloudflareEdgeGeneratedGet5xx,
  reconcileHandledCloudflareEdgeConsoleDiagnostics,
} from './cloudflare-edge-recovery.mjs';

const baseUrl = process.env.WEBSITE_URL;
const metricsApiBaseUrl = 'https://api.vellira.dev';
const productionBlogManifestUrl = 'https://vellira.dev/blog/manifest.json';
const blogMetricsPublicationMode = resolveBlogMetricsPublicationMode(
  process.env.BLOG_METRICS_PUBLICATION_MODE
);
const aggregateMetricsMaxAttempts = 8;
const aggregateMetricsRetryDelayMs = 12_000;
const edgeRecoveryMaxAttempts = 3;
const edgeRecoveryDelayMs = 1_500;
const expectedBuildId = process.env.VELLIRA_BUILD_ID?.trim();

if (!expectedBuildId) throw new Error('VELLIRA_BUILD_ID is required.');

if (!baseUrl) {
  throw new Error('WEBSITE_URL is required.');
}

const baseOrigin = new URL(baseUrl).origin;
const metricsApiOrigin = new URL(metricsApiBaseUrl).origin;
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const diagnostics = [];
const browserEvents = [];
const artifactDirectory = path.resolve('test-results/cloudflare-website-smoke');
await fs.mkdir(artifactDirectory, { recursive: true });
const criticalDiagnostics = [];
const vercelRuntimeRequests = [];
const directMetricRequests = [];
const blogMetrics404Responses = [];
const deferredResource404ConsoleDiagnostics = [];
const deferredResource5xxConsoleDiagnostics = [];
const cloudflareEdgeGetFailures = [];
let acceptedStagingCatalogLag = false;
let acceptedStagingCandidateOnlySlugs = [];

function sameOrigin(url) {
  return new URL(url).origin === baseOrigin;
}

function actorMetricsUrl(slug, suffix) {
  return `${baseUrl}/api/blog-metrics/articles/${slug}/${suffix}`;
}

function isDirectMetricRequest(url) {
  const parsedUrl = new URL(url);
  if (parsedUrl.origin !== metricsApiOrigin) {
    return false;
  }

  return /^\/v1\/blog\/(?:metrics(?:\/[^/]+)?|articles\/[^/]+\/(?:views|like))$/.test(
    parsedUrl.pathname
  );
}

function isObsoleteVercelRuntimeRequest(url) {
  const parsedUrl = new URL(url);
  return (
    parsedUrl.origin === baseOrigin &&
    parsedUrl.pathname.startsWith('/_vercel/')
  );
}

function isExpectedNavigationAbort(request) {
  return request.failure()?.errorText === 'net::ERR_ABORTED';
}

function isBlogAggregateMetricsResponse(response) {
  const parsedUrl = new URL(response.url());
  return (
    parsedUrl.origin === baseOrigin &&
    parsedUrl.pathname === '/api/blog-metrics/metrics' &&
    response.request().method() === 'GET'
  );
}

function markObservedAggregateMetrics404sHandled() {
  for (const response of blogMetrics404Responses) {
    if (response.aggregate) {
      response.handled = true;
    }
  }
}

function markProvenStagingCatalogLag404sHandled(candidateOnlySlugs) {
  for (const response of blogMetrics404Responses) {
    if (
      isExpectedStagingCandidateBlogMetricsRequest({
        requestUrl: response.url,
        method: response.method,
        baseOrigin,
        candidateOnlySlugs,
      })
    ) {
      response.handled = true;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function edgeFailuresSince(index) {
  return cloudflareEdgeGetFailures
    .slice(index)
    .filter((failure) => !failure.handled);
}

async function recoverCloudflareEdgeFailures(failures, stage) {
  if (failures.length === 0) return false;

  for (const failure of failures) {
    const result = await recoverCloudflareEdgeFailure(failure, {
      expectedBuildId,
    });
    diagnostics.push(
      `edge-recovery during ${stage}: ${failure.url} ${JSON.stringify(result)}`
    );
    if (!result.recovered) return false;
    console.log(
      `Recovered transient Cloudflare edge GET during ${stage}: ${failure.url} (attempts ${result.attempts})`
    );
  }

  return true;
}

function reconcileCloudflareEdgeDiagnostics() {
  for (const failure of cloudflareEdgeGetFailures) {
    if (!failure.handled && !criticalDiagnostics.includes(failure.diagnostic)) {
      criticalDiagnostics.push(failure.diagnostic);
    }
  }

  const consoleDiagnostics = reconcileHandledCloudflareEdgeConsoleDiagnostics(
    deferredResource5xxConsoleDiagnostics,
    cloudflareEdgeGetFailures.filter((failure) => failure.handled).length
  );
  criticalDiagnostics.push(...consoleDiagnostics.critical);
}

function attachPageDiagnostics(page) {
  page.on('request', (request) => {
    if (sameOrigin(request.url()))
      browserEvents.push({
        kind: 'request',
        at: Date.now(),
        page: page.url(),
        url: request.url(),
        method: request.method(),
      });
    if (isObsoleteVercelRuntimeRequest(request.url())) {
      const diagnostic = `obsolete Vercel runtime request: ${request.url()}`;
      diagnostics.push(diagnostic);
      criticalDiagnostics.push(diagnostic);
      vercelRuntimeRequests.push(request.url());
    }

    if (isDirectMetricRequest(request.url())) {
      const diagnostic =
        `blog metrics bypassed the first-party proxy: ` +
        `${request.method()} ${request.url()}`;
      diagnostics.push(diagnostic);
      criticalDiagnostics.push(diagnostic);
      directMetricRequests.push(request.url());
    }
  });

  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return;
    }

    const diagnostic = `console.error: ${message.text()}`;
    diagnostics.push(diagnostic);
    if (isBrowserResource404ConsoleError(message.text())) {
      deferredResource404ConsoleDiagnostics.push(diagnostic);
      return;
    }
    if (isBrowserResource5xxConsoleError(message.text())) {
      deferredResource5xxConsoleDiagnostics.push(diagnostic);
      return;
    }
    criticalDiagnostics.push(diagnostic);
  });

  page.on('pageerror', (error) => {
    const diagnostic = `pageerror: ${error.stack ?? error.message}`;
    diagnostics.push(diagnostic);
    criticalDiagnostics.push(diagnostic);
  });

  page.on('response', (response) => {
    if (sameOrigin(response.url()))
      browserEvents.push({
        kind: 'response',
        at: Date.now(),
        page: page.url(),
        url: response.url(),
        method: response.request().method(),
        status: response.status(),
      });
    if (response.status() < 400) {
      return;
    }

    const diagnostic =
      `response: ${response.status()} ${response.request().method()} ` +
      response.url();
    diagnostics.push(diagnostic);

    const responseHeaders = response.headers();
    if (
      sameOrigin(response.url()) &&
      !new URL(response.url()).pathname.startsWith('/_next/static/') &&
      isCloudflareEdgeGeneratedGet5xx({
        status: response.status(),
        method: response.request().method(),
        headers: responseHeaders,
      })
    ) {
      cloudflareEdgeGetFailures.push({
        diagnostic,
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
        headers: responseHeaders,
        requestHeaders: response.request().headers(),
        handled: false,
      });
      return;
    }

    if (response.status() === 404) {
      const method = response.request().method();
      const aggregate = isBlogAggregateMetricsResponse(response);
      const potentialCandidateBootstrap =
        isPotentialStagingCandidateBlogMetricsRequest({
          requestUrl: response.url(),
          method,
          baseOrigin,
        });
      const handled =
        acceptedStagingCatalogLag &&
        isExpectedStagingCandidateBlogMetricsRequest({
          requestUrl: response.url(),
          method,
          baseOrigin,
          candidateOnlySlugs: acceptedStagingCandidateOnlySlugs,
        });

      if (aggregate || potentialCandidateBootstrap) {
        blogMetrics404Responses.push({
          diagnostic,
          url: response.url(),
          method,
          aggregate,
          handled,
        });
        return;
      }
    }

    criticalDiagnostics.push(diagnostic);
  });

  page.on('requestfailed', (request) => {
    if (sameOrigin(request.url()))
      browserEvents.push({
        kind: 'requestfailed',
        at: Date.now(),
        page: page.url(),
        url: request.url(),
        method: request.method(),
        error: request.failure()?.errorText,
      });
    if (!sameOrigin(request.url()) || isExpectedNavigationAbort(request)) {
      return;
    }

    const diagnostic =
      `requestfailed: ${request.method()} ${request.url()} ` +
      `${request.failure()?.errorText ?? ''}`;
    diagnostics.push(diagnostic);
    criticalDiagnostics.push(diagnostic);
  });
}

attachPageDiagnostics(page);

async function goto(path) {
  for (let attempt = 1; attempt <= edgeRecoveryMaxAttempts; attempt += 1) {
    const edgeStart = cloudflareEdgeGetFailures.length;
    const response = await page.goto(`${baseUrl}${path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    if (response && response.status() < 400) return response;

    const failures = edgeFailuresSince(edgeStart);
    if (
      attempt < edgeRecoveryMaxAttempts &&
      (await recoverCloudflareEdgeFailures(failures, `navigation ${path}`))
    ) {
      await sleep(edgeRecoveryDelayMs);
      continue;
    }

    throw new Error(
      `Document navigation failed for ${path}: HTTP ${response?.status() ?? 'no-response'}`
    );
  }

  throw new Error(`Document navigation did not recover for ${path}.`);
}

async function loadHomePage() {
  await goto('/');
  await page.locator('main').first().waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  console.log('OK browser load /');
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function probeBlogAggregateResponse(url) {
  // Do not read the Playwright page response body here. OpenNext/Cloudflare can
  // expose the non-2xx status before the streamed body finishes, which made the
  // deployment smoke wait until the job-level timeout. APIRequestContext gives
  // this diagnostic read an explicit bound instead.
  return readCloudflareDiagnosticGet(
    { url, expectedBuildId, retryEdge5xx: true },
    async (response) => ({
      status: response.status(),
      errorCode: parseBlogMetricsErrorCode(await readJsonResponse(response)),
    })
  );
}

async function fetchBlogPublicationSlugs(url, label) {
  return readCloudflareDiagnosticGet(
    {
      url,
      ...(sameOrigin(url) ? { expectedBuildId, retryEdge5xx: true } : {}),
    },
    async (response) => {
      if (!response.ok()) {
        throw new Error(
          `${label} request failed with ${response.status()} at ${url}.`
        );
      }
      return parseBlogPublicationManifest(await response.json(), label);
    }
  );
}

function isValidBlogMetricsItem(item) {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof item.slug === 'string' &&
    Number.isSafeInteger(item.views) &&
    item.views >= 0 &&
    Number.isSafeInteger(item.likes) &&
    item.likes >= 0
  );
}

async function verifyProductionCatalogAggregateProxy(productionSlugs) {
  if (productionSlugs.length === 0) {
    throw new Error(
      'Production blog publication manifest unexpectedly contains no slugs.'
    );
  }

  const url = new URL(buildBlogMetricsBatchPath(productionSlugs), baseUrl);
  const payload = await readCloudflareDiagnosticGet(
    { url: url.toString(), expectedBuildId, retryEdge5xx: true },
    async (response) => {
      if (!response.ok()) {
        throw new Error(
          `Production-catalog metrics proxy failed with ${response.status()}.`
        );
      }
      return response.json();
    }
  );
  if (!Array.isArray(payload?.items)) {
    throw new Error(
      'Production-catalog metrics proxy returned an invalid payload.'
    );
  }

  if (payload.items.length !== productionSlugs.length) {
    throw new Error(
      'Production-catalog metrics proxy returned an unexpected item count.'
    );
  }

  const metricsBySlug = new Map();
  for (const item of payload.items) {
    if (!isValidBlogMetricsItem(item)) {
      throw new Error(
        'Production-catalog metrics proxy returned an invalid metrics item.'
      );
    }
    metricsBySlug.set(item.slug, item);
  }

  for (const slug of productionSlugs) {
    if (!metricsBySlug.has(slug)) {
      throw new Error(
        `Production-catalog metrics proxy omitted published slug ${slug}.`
      );
    }
  }

  if (metricsBySlug.size !== productionSlugs.length) {
    throw new Error(
      'Production-catalog metrics proxy returned unexpected article metrics.'
    );
  }

  console.log(
    `OK production catalog aggregate metrics through same-origin proxy: ${productionSlugs.length} slugs`
  );
}

async function verifyExpectedStagingCatalogLag() {
  const [candidateSlugs, productionSlugs] = await Promise.all([
    fetchBlogPublicationSlugs(
      new URL('/blog/manifest.json', baseUrl).toString(),
      'Staging candidate blog publication manifest'
    ),
    fetchBlogPublicationSlugs(
      productionBlogManifestUrl,
      'Production blog publication manifest'
    ),
  ]);

  const candidateOnlySlugs = candidateOnlyBlogSlugs(
    candidateSlugs,
    productionSlugs
  );

  await verifyProductionCatalogAggregateProxy(productionSlugs);

  return candidateOnlySlugs;
}

async function waitForAggregateMetricsResponse() {
  const responsePromise = page.waitForResponse(
    (response) => {
      const parsedUrl = new URL(response.url());
      return (
        parsedUrl.origin === baseOrigin &&
        parsedUrl.pathname === '/api/blog-metrics/metrics' &&
        response.request().method() === 'GET'
      );
    },
    { timeout: 15_000 }
  );

  await goto('/blog');
  return responsePromise;
}

async function waitForRenderedBlogMetrics() {
  await page.locator('[aria-label$=" views"]').first().waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  await page.locator('[aria-label*=" likes"]').first().waitFor({
    state: 'visible',
    timeout: 15_000,
  });
}

async function verifyBlogIndexMetricsProxy() {
  for (let attempt = 1; attempt <= aggregateMetricsMaxAttempts; attempt += 1) {
    const response = await waitForAggregateMetricsResponse();

    if (response.ok()) {
      await waitForRenderedBlogMetrics();
      console.log(
        `OK blog aggregate metrics use same-origin proxy and render (attempt ${attempt})`
      );
      return;
    }

    const edgeFailures = destinationEdgeFailures(
      edgeFailuresSince(0),
      response.url()
    );
    if (
      edgeFailures.length > 0 &&
      isCloudflareEdgeGeneratedGet5xx({
        status: response.status(),
        method: response.request().method(),
        headers: response.headers(),
      })
    ) {
      if (
        attempt < aggregateMetricsMaxAttempts &&
        (await recoverCloudflareEdgeFailures(
          edgeFailures,
          'aggregate metrics browser render'
        ))
      ) {
        continue;
      }
      throw new Error('Blog aggregate metrics edge recovery failed.');
    }

    const probe = await probeBlogAggregateResponse(response.url());

    if (
      response.status() === 404 &&
      probe.status >= 200 &&
      probe.status < 300
    ) {
      markObservedAggregateMetrics404sHandled();
      console.log(
        'Blog aggregate metrics converged between browser response and bounded diagnostic probe; retrying browser render.'
      );
      continue;
    }

    if (probe.status !== response.status()) {
      throw new Error(
        `Blog aggregate metrics changed status during bounded diagnostic probe: browser=${response.status()} probe=${probe.status}.`
      );
    }

    const errorCode = probe.errorCode;
    let candidateOnlySlugs = [];

    if (
      blogMetricsPublicationMode ===
        BLOG_METRICS_PUBLICATION_MODE_STAGING_CANDIDATE &&
      response.status() === 404 &&
      errorCode === 'article_not_found'
    ) {
      candidateOnlySlugs = await verifyExpectedStagingCatalogLag();
    }

    const action = classifyBlogMetricsAggregateResponse({
      mode: blogMetricsPublicationMode,
      status: response.status(),
      errorCode,
      attempt,
      maxAttempts: aggregateMetricsMaxAttempts,
      candidateOnlySlugs,
    });

    if (action === 'expected-catalog-lag') {
      acceptedStagingCatalogLag = true;
      acceptedStagingCandidateOnlySlugs = candidateOnlySlugs;
      markProvenStagingCatalogLag404sHandled(candidateOnlySlugs);
      await page.locator('main').first().waitFor({
        state: 'visible',
        timeout: 15_000,
      });
      console.log(
        `OK expected staging publication catalog lag for candidate-only slugs: ${candidateOnlySlugs.join(', ')}`
      );
      return;
    }

    if (action === 'retry') {
      markObservedAggregateMetrics404sHandled();
      console.log(
        `Waiting for production blog publication catalog convergence after ${response.status()} ${errorCode ?? 'unknown_error'} (attempt ${attempt}/${aggregateMetricsMaxAttempts})`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, aggregateMetricsRetryDelayMs)
      );
      continue;
    }

    throw new Error(
      `Blog aggregate metrics proxy failed with ${response.status()} (${errorCode ?? 'unknown_error'}) in ${blogMetricsPublicationMode} mode.`
    );
  }

  throw new Error('Blog aggregate metrics proxy did not converge.');
}

async function performRecoverableClientNavigation({
  startPath,
  href,
  stage,
  prepare,
  click,
  assertReady,
}) {
  return runRecoverableClientNavigation({
    stage,
    maxAttempts: edgeRecoveryMaxAttempts,
    prepareAttempt: async () => {
      await goto(startPath);
      await prepare?.();
    },
    runAttempt: async () => {
      await click();
      await page.waitForURL(`${baseUrl}${href}`, { timeout: 15_000 });
      await assertReady();
    },
    failureCursor: () => cloudflareEdgeGetFailures.length,
    failuresSince: (cursor) =>
      destinationEdgeFailures(edgeFailuresSince(cursor), href),
    recoverFailures: recoverCloudflareEdgeFailures,
    beforeRetry: async (attempt) => {
      console.log(
        `Retrying client navigation after transient Cloudflare edge failure during ${stage} (attempt ${attempt}/${edgeRecoveryMaxAttempts})`
      );
      await sleep(edgeRecoveryDelayMs);
    },
  });
}

async function navigateByLink(startPath, href, expectedText) {
  await performRecoverableClientNavigation({
    startPath,
    href,
    stage: `client navigation ${startPath} -> ${href}`,
    prepare: async () => {
      const link = page.locator(`a[href="${href}"]`).first();
      await link.waitFor({ state: 'visible', timeout: 15_000 });
    },
    click: () => page.locator(`a[href="${href}"]`).first().click(),
    assertReady: () =>
      page.getByText(expectedText, { exact: false }).first().waitFor({
        state: 'visible',
        timeout: 15_000,
      }),
  });
  console.log(`OK client navigation ${startPath} -> ${href}`);
}

async function verifyHighlightedArticleCode() {
  await goto('/blog/two-runtimes');
  await page.locator('[data-language="ts"]').first().waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  console.log('OK highlighted MDX code /blog/two-runtimes');
}

async function loadArticleWithActorMetrics(
  page,
  observeActorJson,
  articlePath,
  likeUrl,
  viewUrl
) {
  for (let attempt = 1; attempt <= edgeRecoveryMaxAttempts; attempt += 1) {
    const edgeStart = cloudflareEdgeGetFailures.length;
    let mutationObserved = false;
    const observeMutation = (request) => {
      if (
        sameOrigin(request.url()) &&
        !['GET', 'HEAD', 'OPTIONS'].includes(request.method())
      )
        mutationObserved = true;
    };
    page.on('request', observeMutation);

    try {
      const [likeStateResponse, viewResponse] = await observeActorJson(
        [
          { url: likeUrl, method: 'GET' },
          { url: viewUrl, method: 'POST' },
        ],
        () =>
          page.goto(`${baseUrl}${articlePath}`, {
            waitUntil: 'domcontentloaded',
            timeout: 15_000,
          }),
        15_000,
        { document: 'next' }
      );

      if (
        likeStateResponse.status < 200 ||
        likeStateResponse.status >= 300 ||
        viewResponse.status < 200 ||
        viewResponse.status >= 300
      ) {
        throw new Error(
          `Blog metrics bootstrap failed: like=${likeStateResponse.status} ` +
            `view=${viewResponse.status}`
        );
      }

      const likeState = likeStateResponse.payload;
      const viewWrite = viewResponse.payload;

      if (typeof likeState?.liked !== 'boolean' || !viewWrite?.metrics) {
        throw new Error('Blog metrics bootstrap returned an invalid payload.');
      }

      return { likeState, viewWrite };
    } catch (error) {
      const failures = destinationEdgeFailures(
        edgeFailuresSince(edgeStart),
        articlePath
      );
      if (
        !mutationObserved &&
        attempt < edgeRecoveryMaxAttempts &&
        (await recoverCloudflareEdgeFailures(
          failures,
          `actor bootstrap ${articlePath}`
        ))
      ) {
        await sleep(edgeRecoveryDelayMs);
        continue;
      }

      throw error;
    } finally {
      page.off('request', observeMutation);
    }
  }

  throw new Error(`Blog actor bootstrap did not recover for ${articlePath}.`);
}

async function verifyBlogActorContinuity() {
  const slug = 'two-runtimes';
  const articlePath = `/blog/${slug}`;
  const likeUrl = actorMetricsUrl(slug, 'like');
  const viewUrl = actorMetricsUrl(slug, 'views');

  // Start the actor journey in an untouched context, not by clearing cookies
  // under a previous article's still-running hydration requests.
  const context = await browser.newContext();
  let actorPage;
  try {
    const page = await context.newPage();
    actorPage = page;
    attachPageDiagnostics(page);
    const observeActorJson = await captureBrowserJson(page, baseUrl);

    const first = await loadArticleWithActorMetrics(
      page,
      observeActorJson,
      articlePath,
      likeUrl,
      viewUrl
    );

    if (first.likeState.liked) {
      throw new Error('Fresh anonymous actor unexpectedly started liked.');
    }

    const formatCount = (value) => new Intl.NumberFormat('en-US').format(value);
    await page
      .getByLabel(`${formatCount(first.viewWrite.metrics.views)} views`)
      .waitFor({ state: 'visible', timeout: 15_000 });

    const [firstLikeResponse] = await observeActorJson(
      [{ url: likeUrl, method: 'PUT' }],
      () => page.getByRole('button', { name: 'Like this article' }).click()
    );

    if (firstLikeResponse.status < 200 || firstLikeResponse.status >= 300) {
      throw new Error(`Blog like failed with ${firstLikeResponse.status}.`);
    }

    const firstLikeWrite = firstLikeResponse.payload;
    if (
      firstLikeWrite?.liked !== true ||
      firstLikeWrite?.changed !== true ||
      !firstLikeWrite?.metrics
    ) {
      throw new Error(
        `First like did not create actor state: ${JSON.stringify(firstLikeWrite)}`
      );
    }

    await page.getByRole('button', { name: 'Unlike this article' }).waitFor({
      state: 'visible',
      timeout: 15_000,
    });

    for (let reloadAttempt = 1; reloadAttempt <= 3; reloadAttempt += 1) {
      const repeated = await loadArticleWithActorMetrics(
        page,
        observeActorJson,
        articlePath,
        likeUrl,
        viewUrl
      );

      if (!repeated.likeState.liked) {
        throw new Error(`Like state was lost after reload ${reloadAttempt}.`);
      }

      if (repeated.viewWrite.metrics.views !== first.viewWrite.metrics.views) {
        throw new Error(
          `Repeated view changed the count after reload ${reloadAttempt}: ` +
            `first=${first.viewWrite.metrics.views} ` +
            `repeated=${repeated.viewWrite.metrics.views}`
        );
      }

      if (
        typeof repeated.viewWrite.counted === 'boolean' &&
        repeated.viewWrite.counted !== false
      ) {
        throw new Error(
          `Repeated same-day view was counted after reload ${reloadAttempt}: ` +
            JSON.stringify(repeated.viewWrite)
        );
      }

      await page.getByRole('button', { name: 'Unlike this article' }).waitFor({
        state: 'visible',
        timeout: 15_000,
      });
    }

    for (let repeat = 1; repeat <= 3; repeat += 1) {
      const repeatedLikeResponse = await context.request.put(likeUrl, {
        failOnStatusCode: false,
      });
      if (!repeatedLikeResponse.ok()) {
        throw new Error(
          `Repeated like PUT ${repeat} failed with ${repeatedLikeResponse.status()}.`
        );
      }

      const repeatedLikeWrite = await repeatedLikeResponse.json();
      if (
        repeatedLikeWrite?.liked !== true ||
        repeatedLikeWrite?.changed !== false ||
        repeatedLikeWrite?.metrics?.likes !== firstLikeWrite.metrics.likes
      ) {
        throw new Error(
          `Repeated like ${repeat} was not idempotent: ${JSON.stringify(
            repeatedLikeWrite
          )}`
        );
      }
    }

    const restoreResponse = await context.request.delete(likeUrl, {
      failOnStatusCode: false,
    });
    if (!restoreResponse.ok()) {
      throw new Error(
        `Blog like restore failed with ${restoreResponse.status()}.`
      );
    }

    const restored = await restoreResponse.json();
    if (restored?.liked !== false) {
      throw new Error(
        `Blog like restore returned invalid state: ${JSON.stringify(restored)}`
      );
    }

    console.log(
      'OK actor continuity: repeated reloads preserve like and same-day view/like are no-ops'
    );
  } finally {
    try {
      if (actorPage)
        await fs.writeFile(
          path.join(artifactDirectory, 'actor-page.html'),
          await actorPage.content().catch(String)
        );
    } finally {
      await context.close();
    }
  }
}

async function verifyMetricsFailureDoesNotBreakArticleActions() {
  const fallbackContext = await browser.newContext();
  const fallbackPage = await fallbackContext.newPage();

  await fallbackPage.route('**/api/blog-metrics/**', (route) => route.abort());
  await fallbackPage.goto(`${baseUrl}/blog/two-runtimes`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await fallbackPage
    .getByRole('heading', {
      level: 1,
      name: 'One Design System, Two Runtimes',
    })
    .waitFor({ state: 'visible', timeout: 15_000 });
  await fallbackPage.getByRole('button', { name: 'Share' }).waitFor({
    state: 'visible',
    timeout: 15_000,
  });

  if ((await fallbackPage.getByLabel('0 views').count()) > 0) {
    throw new Error('Unavailable metrics were rendered as fake 0 views.');
  }
  if ((await fallbackPage.getByLabel('0 likes').count()) > 0) {
    throw new Error('Unavailable metrics were rendered as fake 0 likes.');
  }

  await fallbackContext.close();
  console.log(
    'OK metrics failure keeps article/share usable without fake zero state'
  );
}

async function navigateViaContinueReading() {
  const startPath = '/blog/two-runtimes';
  await goto(startPath);
  const section = page.locator(
    'section[aria-labelledby="blog-continue-reading-heading"]'
  );
  await section.waitFor({ state: 'visible', timeout: 15_000 });
  const initialLink = section.locator('a[href^="/blog/"]').first();
  await initialLink.waitFor({ state: 'visible', timeout: 15_000 });

  const href = await initialLink.getAttribute('href');
  const expectedTitle = (await initialLink.locator('h3').innerText()).trim();
  if (!href || href === startPath || !expectedTitle) {
    throw new Error(
      `Invalid Continue reading target: href=${href} title=${expectedTitle}`
    );
  }

  await performRecoverableClientNavigation({
    startPath,
    href,
    stage: `Continue reading ${startPath} -> ${href}`,
    prepare: async () => {
      const link = page
        .locator('section[aria-labelledby="blog-continue-reading-heading"]')
        .locator(`a[href="${href}"]`)
        .first();
      await link.waitFor({ state: 'visible', timeout: 15_000 });
    },
    click: () =>
      page
        .locator('section[aria-labelledby="blog-continue-reading-heading"]')
        .locator(`a[href="${href}"]`)
        .first()
        .click(),
    assertReady: () =>
      page
        .getByRole('heading', { level: 1, name: expectedTitle })
        .waitFor({ state: 'visible', timeout: 15_000 }),
  });
  console.log(`OK Continue reading navigation ${startPath} -> ${href}`);
}

async function navigateWithinComponentSidebar() {
  await page.setViewportSize({ width: 1280, height: 900 });
  const startPath = '/components/switch';
  const href = '/components/checkbox';

  await performRecoverableClientNavigation({
    startPath,
    href,
    stage: `desktop component navigation ${startPath} -> ${href}`,
    prepare: async () => {
      const sidebar = page
        .locator('aside[aria-label="Component navigation"]')
        .first();
      await sidebar.waitFor({ state: 'visible', timeout: 15_000 });
      await sidebar
        .locator(`a[href="${href}"]`)
        .waitFor({ state: 'visible', timeout: 15_000 });
    },
    click: () =>
      page
        .locator('aside[aria-label="Component navigation"]')
        .first()
        .locator(`a[href="${href}"]`)
        .click(),
    assertReady: () =>
      page.getByRole('heading', { level: 1, name: 'Checkbox' }).waitFor({
        state: 'visible',
        timeout: 15_000,
      }),
  });

  console.log(
    'OK desktop component sidebar navigation /components/switch -> /components/checkbox'
  );
}

async function navigateWithinMobileComponentSidebar() {
  await page.setViewportSize({ width: 670, height: 900 });
  const startPath = '/components/switch';
  const href = '/components/checkbox';

  await performRecoverableClientNavigation({
    startPath,
    href,
    stage: `mobile component navigation ${startPath} -> ${href}`,
    prepare: async () => {
      const trigger = page.getByRole('button', {
        name: 'Open component navigation',
      });
      await trigger.waitFor({ state: 'visible', timeout: 15_000 });
      await trigger.click();
      const mobileSidebar = page.locator('#component-navigation');
      await mobileSidebar.waitFor({ state: 'visible', timeout: 15_000 });
      await mobileSidebar
        .locator(`a[href="${href}"]`)
        .waitFor({ state: 'visible', timeout: 15_000 });
    },
    click: () =>
      page
        .locator('#component-navigation')
        .locator(`a[href="${href}"]`)
        .click(),
    assertReady: async () => {
      await page.getByRole('heading', { level: 1, name: 'Checkbox' }).waitFor({
        state: 'visible',
        timeout: 15_000,
      });
      await page
        .locator('#component-navigation')
        .waitFor({ state: 'hidden', timeout: 15_000 });
    },
  });

  console.log(
    'OK mobile component navigation /components/switch -> /components/checkbox and overlay closed'
  );
}

async function writeRecoveryEvidence() {
  await fs.writeFile(
    path.join(artifactDirectory, 'edge-recovery.json'),
    JSON.stringify(
      {
        expectedBuildId,
        finalUrl: page.url(),
        diagnostics,
        browserEvents,
        failures: cloudflareEdgeGetFailures.map((failure) => ({
          ...failure,
          requestHeaders: cloudflareEdgeReplayHeaders(failure.requestHeaders),
        })),
      },
      null,
      2
    )
  );
}

try {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loadHomePage();
  await verifyBlogIndexMetricsProxy();
  await navigateByLink(
    '/blog',
    '/blog/two-runtimes',
    'One Design System, Two Runtimes'
  );
  await verifyHighlightedArticleCode();
  await verifyBlogActorContinuity();
  await verifyMetricsFailureDoesNotBreakArticleActions();
  await navigateByLink(
    '/blog',
    '/blog/component-metadata-source-of-truth',
    'Component Metadata as a Source of Truth for a Design System'
  );
  await navigateByLink(
    '/blog',
    '/blog/controlled-uncontrolled-react-native',
    'Controlled and Uncontrolled State Across React and React Native'
  );
  await navigateViaContinueReading();
  await navigateByLink(
    '/components',
    '/components/switch',
    'Vellira Switch for React and React Native'
  );
  await navigateWithinComponentSidebar();
  await navigateWithinMobileComponentSidebar();

  for (const response of blogMetrics404Responses) {
    if (!response.handled) {
      criticalDiagnostics.push(response.diagnostic);
    }
  }

  const backgroundEdgeFailures = edgeFailuresSince(0);
  if (backgroundEdgeFailures.length > 0) {
    await recoverCloudflareEdgeFailures(
      backgroundEdgeFailures,
      'final background browser diagnostics'
    );
  }
  reconcileCloudflareEdgeDiagnostics();

  const reconciledResource404Diagnostics =
    reconcileHandledBlogMetrics404ConsoleDiagnostics(
      deferredResource404ConsoleDiagnostics,
      blogMetrics404Responses.filter((response) => response.handled).length
    );
  criticalDiagnostics.push(...reconciledResource404Diagnostics.critical);

  if (vercelRuntimeRequests.length > 0) {
    throw new Error(
      `Cloudflare emitted obsolete Vercel requests:\n${vercelRuntimeRequests.join('\n')}`
    );
  }
  if (directMetricRequests.length > 0) {
    throw new Error(
      `Blog metrics bypassed same-origin proxy:\n${directMetricRequests.join('\n')}`
    );
  }
  if (criticalDiagnostics.length > 0) {
    throw new Error(
      `Critical browser diagnostics detected:\n${criticalDiagnostics.join('\n')}`
    );
  }
} catch (error) {
  console.error(`Cloudflare website smoke failed at ${page.url()}`);
  console.error(error);
  for (const diagnostic of diagnostics) {
    console.error(diagnostic);
  }
  process.exitCode = 1;
}

if (!process.exitCode) {
  for (const diagnostic of diagnostics) console.log(diagnostic);
}
try {
  await writeRecoveryEvidence();
} finally {
  await browser.close();
}
