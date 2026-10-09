/* global document */
import { chromium } from '@playwright/test';
import {
  destinationEdgeFailures,
  runRecoverableClientNavigation,
} from './cloudflare-client-navigation-recovery.mjs';
import {
  isCloudflareEdgeGeneratedGet5xx,
  recoverCloudflareEdgeGet5xx,
  recoverCloudflareEdgeFailure,
  readCloudflareDiagnosticGet,
} from './cloudflare-edge-recovery.mjs';

const baseUrl = process.env.WEBSITE_URL;
const expectedBuildId = process.env.VELLIRA_BUILD_ID?.trim();

if (!expectedBuildId) throw new Error('VELLIRA_BUILD_ID is required.');

if (!baseUrl) {
  throw new Error('WEBSITE_URL is required.');
}

const origin = new URL(baseUrl).origin;
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const criticalDiagnostics = [];
const abortedChunkUrls = new Set();
const abortedRouterRequests = new Map();
const routerEdgeFailures = [];

function isSameOrigin(url) {
  return new URL(url).origin === origin;
}

function isNextStaticChunk(url) {
  if (!isSameOrigin(url)) {
    return false;
  }

  return new URL(url).pathname.startsWith('/_next/static/');
}

function isNextRouterDataRequest(request) {
  if (!isSameOrigin(request.url()) || request.method() !== 'GET') {
    return false;
  }

  const url = new URL(request.url());
  const headers = request.headers();

  return (
    url.searchParams.has('_rsc') ||
    headers.rsc === '1' ||
    headers['next-router-prefetch'] === '1' ||
    Boolean(headers['next-router-segment-prefetch'])
  );
}

function describeRouterRequest(request) {
  const headers = request.headers();

  return [
    `${request.method()} ${request.url()}`,
    `resourceType=${request.resourceType()}`,
    `rsc=${headers.rsc ?? ''}`,
    `next-router-prefetch=${headers['next-router-prefetch'] ?? ''}`,
    `next-router-segment-prefetch=${headers['next-router-segment-prefetch'] ?? ''}`,
  ].join(' ');
}

function recordCritical(diagnostic) {
  if (!criticalDiagnostics.includes(diagnostic)) {
    criticalDiagnostics.push(diagnostic);
  }
}

function routerEdgeFailuresSince(index) {
  return routerEdgeFailures.slice(index).filter((failure) => !failure.handled);
}

async function recoverRouterEdgeFailures(failures, stage) {
  if (failures.length === 0) return false;

  for (const failure of failures) {
    const result = await recoverCloudflareEdgeFailure(failure, {
      expectedBuildId,
    });
    console.log(
      `edge-recovery during ${stage}: ${failure.url} ${JSON.stringify(result)}`
    );

    if (!result.recovered) return false;
    failure.handled = true;
    console.log(
      `Recovered transient Cloudflare router GET during ${stage}: ${failure.url} (attempts ${result.attempts})`
    );
  }

  return true;
}

function reconcileRouterEdgeFailures() {
  for (const failure of routerEdgeFailures) {
    if (!failure.handled) recordCritical(failure.diagnostic);
  }
}

page.on('response', (response) => {
  if (isNextStaticChunk(response.url()) && response.status() >= 400) {
    recordCritical(
      `chunk response: ${response.status()} ${response.request().method()} ${response.url()}`
    );
  }

  if (isNextRouterDataRequest(response.request()) && response.status() >= 400) {
    const diagnostic = `router data response: ${response.status()} ${describeRouterRequest(response.request())}`;
    if (
      isCloudflareEdgeGeneratedGet5xx({
        status: response.status(),
        method: response.request().method(),
        headers: response.headers(),
      })
    ) {
      routerEdgeFailures.push({
        diagnostic,
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
        headers: response.headers(),
        requestHeaders: response.request().headers(),
        handled: false,
      });
    } else {
      recordCritical(diagnostic);
    }
  }
});

page.on('requestfailed', (request) => {
  if (isNextRouterDataRequest(request)) {
    if (request.failure()?.errorText === 'net::ERR_ABORTED') {
      const description = describeRouterRequest(request);
      abortedRouterRequests.set(description, {
        description,
        url: request.url(),
        headers: request.headers(),
      });
      return;
    }

    recordCritical(
      `router data requestfailed: ${describeRouterRequest(request)} ` +
        `${request.failure()?.errorText ?? ''}`
    );
    return;
  }

  if (!isNextStaticChunk(request.url())) {
    return;
  }

  if (request.failure()?.errorText === 'net::ERR_ABORTED') {
    abortedChunkUrls.add(request.url());
    return;
  }

  recordCritical(
    `chunk requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`
  );
});

page.on('pageerror', (error) => {
  const text = error.stack ?? error.message;
  if (/ChunkLoadError|Failed to load chunk/i.test(text)) {
    recordCritical(`chunk pageerror: ${text}`);
  }
});

page.on('console', (message) => {
  if (
    message.type() === 'error' &&
    /ChunkLoadError|Failed to load chunk|ERR_ABORTED\s+404/i.test(
      message.text()
    )
  ) {
    recordCritical(`chunk console.error: ${message.text()}`);
  }
});

async function describePage(response, path) {
  let title = '';
  let body = '';

  try {
    title = await page.title();
  } catch {
    // Page details are best-effort evidence after a navigation failure.
  }

  try {
    body = (await page.locator('body').innerText({ timeout: 2_000 }))
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  } catch {
    // Page details are best-effort evidence after a navigation failure.
  }

  return (
    `path=${path} status=${response?.status() ?? 'no-response'} ` +
    `url=${page.url()} title=${JSON.stringify(title)} body=${JSON.stringify(body)}`
  );
}

async function waitForRenderedBody(path, response = null) {
  try {
    await page.locator('body').waitFor({
      state: 'visible',
      timeout: 15_000,
    });
    await page.waitForFunction(
      () => Boolean(document.body?.innerText.trim()),
      null,
      { timeout: 15_000 }
    );
  } catch (error) {
    throw new Error(
      `Rendered body did not become available: ${await describePage(response, path)}`,
      { cause: error }
    );
  }
}

async function goto(path) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await page.goto(`${baseUrl}${path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    if (response && response.status() < 400) {
      await waitForRenderedBody(path, response);
      return response;
    }

    if (
      response &&
      attempt < 3 &&
      isCloudflareEdgeGeneratedGet5xx({
        status: response.status(),
        method: response.request().method(),
        headers: response.headers(),
      })
    ) {
      const recovery = await recoverCloudflareEdgeGet5xx({
        url: response.url(),
        requestHeaders: response.request().headers(),
        expectedBuildId,
      });
      if (recovery.recovered) {
        console.log(
          `Retrying document load after transient Cloudflare edge failure: ${path} (attempt ${attempt + 1}/3)`
        );
        await page.waitForTimeout(1_500);
        continue;
      }
    }

    throw new Error(
      `Document load failed: ${await describePage(response, path)}`
    );
  }

  throw new Error(`Document load did not recover: ${path}`);
}

async function verifyAbortedChunkUrls(stage) {
  const urls = [...abortedChunkUrls];
  abortedChunkUrls.clear();

  for (const url of urls) {
    await readCloudflareDiagnosticGet({ url }, async (response) => {
      if (!response.ok()) {
        throw new Error(
          `Aborted static chunk is missing during ${stage}: ${response.status()} GET ${url}`
        );
      }
    });

    console.log(`OK aborted navigation asset still exists: ${url}`);
  }
}

async function verifyAbortedRouterRequests(stage) {
  const requests = [...abortedRouterRequests.values()];
  abortedRouterRequests.clear();

  for (const request of requests) {
    const result = await recoverCloudflareEdgeGet5xx({
      url: request.url,
      requestHeaders: request.headers,
      expectedBuildId,
    });
    if (!result.recovered) {
      throw new Error(
        `Aborted router prefetch is not serviceable during ${stage}: ${request.description} ${JSON.stringify(result)}`
      );
    }
    console.log(
      `OK aborted router prefetch remains serviceable: ${request.description} ${JSON.stringify(result)}`
    );
  }
}

async function settleAndVerifyChunks(stage) {
  await page.waitForTimeout(700);
  await verifyAbortedChunkUrls(stage);
  await verifyAbortedRouterRequests(stage);
  await recoverRouterEdgeFailures(routerEdgeFailuresSince(0), stage);
  reconcileRouterEdgeFailures();

  if (criticalDiagnostics.length > 0) {
    throw new Error(
      `Cloudflare navigation/static failures detected during ${stage}:\n${criticalDiagnostics.join('\n')}`
    );
  }
}

async function collectRoutes(indexPath, prefix) {
  await goto(indexPath);
  await settleAndVerifyChunks(`route discovery ${indexPath}`);

  const hrefs = await page
    .locator(`a[href^="${prefix}"]`)
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));

  return [...new Set(hrefs)]
    .filter((href) => typeof href === 'string')
    .filter((href) => href !== indexPath)
    .filter((href) => !href.includes('#'))
    .sort();
}

async function performRecoverableClientNavigation({
  startPath,
  href,
  stage,
  prepare,
  click,
}) {
  return runRecoverableClientNavigation({
    stage,
    maxAttempts: 3,
    prepareAttempt: async () => {
      await goto(startPath);
      await settleAndVerifyChunks(`document load ${startPath}`);
      await prepare();
    },
    runAttempt: async () => {
      await click();
      await page.waitForURL(`${baseUrl}${href}`, { timeout: 15_000 });
      await waitForRenderedBody(href);
      await settleAndVerifyChunks(stage);
    },
    failureCursor: () => routerEdgeFailures.length,
    failuresSince: (cursor) =>
      destinationEdgeFailures(routerEdgeFailuresSince(cursor), href),
    recoverFailures: recoverRouterEdgeFailures,
    beforeRetry: async () => {
      await page.waitForTimeout(1_500);
    },
  });
}

async function verifyGlobalHeaderNavigation() {
  await performRecoverableClientNavigation({
    startPath: '/',
    href: '/blog',
    stage: 'primary navigation / -> /blog',
    prepare: async () => {
      await page
        .locator('nav[aria-label="Primary navigation"] a[href="/blog"]')
        .waitFor({ state: 'visible', timeout: 15_000 });
    },
    click: () =>
      page
        .locator('nav[aria-label="Primary navigation"] a[href="/blog"]')
        .click(),
  });

  await performRecoverableClientNavigation({
    startPath: '/blog',
    href: '/components',
    stage: 'primary navigation /blog -> /components',
    prepare: async () => {
      await page
        .locator('nav[aria-label="Primary navigation"] a[href="/components"]')
        .waitFor({ state: 'visible', timeout: 15_000 });
    },
    click: () =>
      page
        .locator('nav[aria-label="Primary navigation"] a[href="/components"]')
        .click(),
  });

  await performRecoverableClientNavigation({
    startPath: '/components',
    href: '/',
    stage: 'brand navigation /components -> /',
    prepare: async () => {
      await page
        .locator('header a[href="/"]')
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 });
    },
    click: () => page.locator('header a[href="/"]').first().click(),
  });

  console.log('OK global header navigation and router/static integrity');
}

async function verifyClientRoutes(indexPath, routes) {
  for (const href of routes) {
    await performRecoverableClientNavigation({
      startPath: indexPath,
      href,
      stage: `client navigation ${indexPath} -> ${href}`,
      prepare: async () => {
        await page
          .locator(`a[href="${href}"]`)
          .first()
          .waitFor({ state: 'visible', timeout: 15_000 });
      },
      click: () => page.locator(`a[href="${href}"]`).first().click(),
    });

    console.log(`OK chunk navigation ${indexPath} -> ${href}`);
  }
}

try {
  await verifyGlobalHeaderNavigation();

  const blogRoutes = await collectRoutes('/blog', '/blog/');
  const componentRoutes = await collectRoutes('/components', '/components/');

  if (blogRoutes.length === 0) {
    throw new Error('No blog routes were discovered for chunk validation.');
  }
  if (componentRoutes.length === 0) {
    throw new Error(
      'No component routes were discovered for chunk validation.'
    );
  }

  console.log(
    `Discovered ${blogRoutes.length} blog routes for chunk validation.`
  );
  console.log(
    `Discovered ${componentRoutes.length} component routes for chunk validation.`
  );

  await verifyClientRoutes('/blog', blogRoutes);
  await verifyClientRoutes('/components', componentRoutes);
  await verifyAbortedChunkUrls('final verification');
  await verifyAbortedRouterRequests('final verification');
  await recoverRouterEdgeFailures(
    routerEdgeFailuresSince(0),
    'final verification'
  );
  reconcileRouterEdgeFailures();

  if (criticalDiagnostics.length > 0) {
    throw new Error(
      `Cloudflare navigation/static failures detected:\n${criticalDiagnostics.join('\n')}`
    );
  }
} catch (error) {
  try {
    await verifyAbortedChunkUrls('failure cleanup');
    await verifyAbortedRouterRequests('failure cleanup');
  } catch (probeError) {
    recordCritical(`aborted request verification failed: ${probeError}`);
  }

  console.error(`Cloudflare static chunk smoke failed at ${page.url()}`);
  console.error(error);
  for (const diagnostic of criticalDiagnostics) {
    console.error(diagnostic);
  }
  await browser.close();
  process.exit(1);
}

await browser.close();
console.log(
  'OK Cloudflare router prefetch and static chunk integrity across discovered client routes'
);
