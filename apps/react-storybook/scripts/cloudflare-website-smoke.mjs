import { chromium } from '@playwright/test';

const baseUrl = process.env.WEBSITE_URL;
const metricsApiBaseUrl = 'https://api.vellira.dev';

if (!baseUrl) {
  throw new Error('WEBSITE_URL is required.');
}

const baseOrigin = new URL(baseUrl).origin;
const metricsApiOrigin = new URL(metricsApiBaseUrl).origin;
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const diagnostics = [];
const criticalDiagnostics = [];
const vercelRuntimeRequests = [];
const directActorMetricRequests = [];

function sameOrigin(url) {
  return new URL(url).origin === baseOrigin;
}

function actorMetricsUrl(slug, suffix) {
  return `${baseUrl}/api/blog-metrics/articles/${slug}/${suffix}`;
}

function isDirectActorMetricRequest(url) {
  const parsedUrl = new URL(url);
  if (parsedUrl.origin !== metricsApiOrigin) {
    return false;
  }

  return /^\/v1\/blog\/articles\/[^/]+\/(?:views|like)$/.test(
    parsedUrl.pathname
  );
}

function isObsoleteVercelRuntimeRequest(url) {
  const parsedUrl = new URL(url);
  return parsedUrl.origin === baseOrigin && parsedUrl.pathname.startsWith('/_vercel/');
}

function isExpectedNavigationAbort(request) {
  return request.failure()?.errorText === 'net::ERR_ABORTED';
}

page.on('request', (request) => {
  if (isObsoleteVercelRuntimeRequest(request.url())) {
    const diagnostic = `obsolete Vercel runtime request: ${request.url()}`;
    diagnostics.push(diagnostic);
    criticalDiagnostics.push(diagnostic);
    vercelRuntimeRequests.push(request.url());
  }

  if (isDirectActorMetricRequest(request.url())) {
    const diagnostic =
      `actor-specific metrics bypassed the first-party proxy: ` +
      `${request.method()} ${request.url()}`;
    diagnostics.push(diagnostic);
    criticalDiagnostics.push(diagnostic);
    directActorMetricRequests.push(request.url());
  }
});

page.on('console', (message) => {
  if (message.type() === 'error') {
    const diagnostic = `console.error: ${message.text()}`;
    diagnostics.push(diagnostic);
    criticalDiagnostics.push(diagnostic);
  }
});

page.on('pageerror', (error) => {
  const diagnostic = `pageerror: ${error.stack ?? error.message}`;
  diagnostics.push(diagnostic);
  criticalDiagnostics.push(diagnostic);
});

page.on('response', (response) => {
  if (sameOrigin(response.url()) && response.status() >= 500) {
    const diagnostic =
      `response: ${response.status()} ${response.request().method()} ` +
      response.url();
    diagnostics.push(diagnostic);
    criticalDiagnostics.push(diagnostic);
  }
});

page.on('requestfailed', (request) => {
  if (!sameOrigin(request.url()) || isExpectedNavigationAbort(request)) {
    return;
  }

  const diagnostic =
    `requestfailed: ${request.method()} ${request.url()} ` +
    `${request.failure()?.errorText ?? ''}`;
  diagnostics.push(diagnostic);
  criticalDiagnostics.push(diagnostic);
});

async function goto(path) {
  await page.goto(`${baseUrl}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
}

async function loadHomePage() {
  await goto('/');
  await page.locator('main').first().waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  console.log('OK browser load /');
}

async function navigateByLink(startPath, href, expectedText) {
  await goto(startPath);
  const link = page.locator(`a[href="${href}"]`).first();
  await link.waitFor({ state: 'visible', timeout: 15_000 });
  await link.click();
  await page.waitForURL(`${baseUrl}${href}`, { timeout: 15_000 });
  await page.getByText(expectedText, { exact: false }).first().waitFor({
    state: 'visible',
    timeout: 15_000,
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

function waitForMetricResponse(url, method) {
  return page.waitForResponse(
    (response) =>
      response.url() === url && response.request().method() === method,
    { timeout: 15_000 }
  );
}

async function loadArticleWithActorMetrics(articlePath, likeUrl, viewUrl) {
  const likeStatePromise = waitForMetricResponse(likeUrl, 'GET');
  const viewPromise = waitForMetricResponse(viewUrl, 'POST');

  await goto(articlePath);

  const [likeStateResponse, viewResponse] = await Promise.all([
    likeStatePromise,
    viewPromise,
  ]);

  if (!likeStateResponse.ok() || !viewResponse.ok()) {
    throw new Error(
      `Blog metrics bootstrap failed: like=${likeStateResponse.status()} ` +
        `view=${viewResponse.status()}`
    );
  }

  const likeState = await likeStateResponse.json();
  const viewWrite = await viewResponse.json();

  if (typeof likeState?.liked !== 'boolean' || !viewWrite?.metrics) {
    throw new Error('Blog metrics bootstrap returned an invalid payload.');
  }

  return { likeState, viewWrite };
}

async function verifyBlogActorContinuity() {
  const slug = 'two-runtimes';
  const articlePath = `/blog/${slug}`;
  const likeUrl = actorMetricsUrl(slug, 'like');
  const viewUrl = actorMetricsUrl(slug, 'views');

  await context.clearCookies();

  const first = await loadArticleWithActorMetrics(
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

  const firstLikeResponsePromise = waitForMetricResponse(likeUrl, 'PUT');
  await page.getByRole('button', { name: 'Like this article' }).click();
  const firstLikeResponse = await firstLikeResponsePromise;

  if (!firstLikeResponse.ok()) {
    throw new Error(`Blog like failed with ${firstLikeResponse.status()}.`);
  }

  const firstLikeWrite = await firstLikeResponse.json();
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

  const second = await loadArticleWithActorMetrics(
    articlePath,
    likeUrl,
    viewUrl
  );

  if (!second.likeState.liked) {
    throw new Error('Like state was lost after a page reload.');
  }

  if (second.viewWrite.metrics.views !== first.viewWrite.metrics.views) {
    throw new Error(
      'Repeated view from the same actor changed the count: ' +
        `first=${first.viewWrite.metrics.views} ` +
        `second=${second.viewWrite.metrics.views}`
    );
  }

  if (
    typeof second.viewWrite.counted === 'boolean' &&
    second.viewWrite.counted !== false
  ) {
    throw new Error(
      `Repeated same-day view was counted: ${JSON.stringify(second.viewWrite)}`
    );
  }

  await page.getByRole('button', { name: 'Unlike this article' }).waitFor({
    state: 'visible',
    timeout: 15_000,
  });

  const repeatedLikeResponse = await context.request.put(likeUrl, {
    failOnStatusCode: false,
  });
  if (!repeatedLikeResponse.ok()) {
    throw new Error(
      `Repeated like PUT failed with ${repeatedLikeResponse.status()}.`
    );
  }

  const repeatedLikeWrite = await repeatedLikeResponse.json();
  if (
    repeatedLikeWrite?.liked !== true ||
    repeatedLikeWrite?.changed !== false ||
    repeatedLikeWrite?.metrics?.likes !== firstLikeWrite.metrics.likes
  ) {
    throw new Error(
      `Repeated like was not idempotent: ${JSON.stringify(repeatedLikeWrite)}`
    );
  }

  const restoreResponse = await context.request.delete(likeUrl, {
    failOnStatusCode: false,
  });
  if (!restoreResponse.ok()) {
    throw new Error(`Blog like restore failed with ${restoreResponse.status()}.`);
  }

  const restored = await restoreResponse.json();
  if (restored?.liked !== false) {
    throw new Error(
      `Blog like restore returned invalid state: ${JSON.stringify(restored)}`
    );
  }

  console.log(
    'OK actor continuity: reload preserves like and repeated same-day view/like are no-ops'
  );
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
  const link = section.locator('a[href^="/blog/"]').first();
  await link.waitFor({ state: 'visible', timeout: 15_000 });

  const href = await link.getAttribute('href');
  const expectedTitle = (await link.locator('h3').innerText()).trim();
  if (!href || href === startPath || !expectedTitle) {
    throw new Error(
      `Invalid Continue reading target: href=${href} title=${expectedTitle}`
    );
  }

  await link.click();
  await page.waitForURL(`${baseUrl}${href}`, { timeout: 15_000 });
  await page
    .getByRole('heading', { level: 1, name: expectedTitle })
    .waitFor({ state: 'visible', timeout: 15_000 });
  console.log(`OK Continue reading navigation ${startPath} -> ${href}`);
}

async function navigateWithinComponentSidebar() {
  await page.setViewportSize({ width: 1280, height: 900 });
  await goto('/components/switch');
  const sidebar = page
    .locator('aside[aria-label="Component navigation"]')
    .first();
  await sidebar.waitFor({ state: 'visible', timeout: 15_000 });
  const checkboxLink = sidebar.locator('a[href="/components/checkbox"]');
  await checkboxLink.waitFor({ state: 'visible', timeout: 15_000 });
  await checkboxLink.click();
  await page.waitForURL(`${baseUrl}/components/checkbox`, {
    timeout: 15_000,
  });
  await page.getByRole('heading', { level: 1, name: 'Checkbox' }).waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  console.log(
    'OK desktop component sidebar navigation /components/switch -> /components/checkbox'
  );
}

async function navigateWithinMobileComponentSidebar() {
  await page.setViewportSize({ width: 670, height: 900 });
  await goto('/components/switch');
  const trigger = page.getByRole('button', {
    name: 'Open component navigation',
  });
  await trigger.waitFor({ state: 'visible', timeout: 15_000 });
  await trigger.click();
  const mobileSidebar = page.locator('#component-navigation');
  await mobileSidebar.waitFor({ state: 'visible', timeout: 15_000 });
  const checkboxLink = mobileSidebar.locator('a[href="/components/checkbox"]');
  await checkboxLink.waitFor({ state: 'visible', timeout: 15_000 });
  await checkboxLink.click();
  await page.waitForURL(`${baseUrl}/components/checkbox`, {
    timeout: 15_000,
  });
  await page.getByRole('heading', { level: 1, name: 'Checkbox' }).waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  await mobileSidebar.waitFor({ state: 'hidden', timeout: 15_000 });
  console.log(
    'OK mobile component navigation /components/switch -> /components/checkbox and overlay closed'
  );
}

try {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loadHomePage();
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
    'Switch component for Vellira applications.'
  );
  await navigateWithinComponentSidebar();
  await navigateWithinMobileComponentSidebar();

  if (vercelRuntimeRequests.length > 0) {
    throw new Error(
      `Cloudflare emitted obsolete Vercel requests:\n${vercelRuntimeRequests.join('\n')}`
    );
  }
  if (directActorMetricRequests.length > 0) {
    throw new Error(
      `Actor metrics bypassed same-origin proxy:\n${directActorMetricRequests.join('\n')}`
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
  await browser.close();
  process.exit(1);
}

for (const diagnostic of diagnostics) {
  console.log(diagnostic);
}

await browser.close();