import { chromium } from '@playwright/test';

const baseUrl = process.env.WEBSITE_URL;

if (!baseUrl) {
  throw new Error('WEBSITE_URL is required.');
}

const origin = new URL(baseUrl).origin;
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const criticalDiagnostics = [];
const abortedChunkUrls = new Set();

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

page.on('response', (response) => {
  if (isNextStaticChunk(response.url()) && response.status() >= 400) {
    recordCritical(
      `chunk response: ${response.status()} ${response.request().method()} ${response.url()}`
    );
  }

  if (
    isNextRouterDataRequest(response.request()) &&
    response.status() >= 400
  ) {
    recordCritical(
      `router data response: ${response.status()} ${describeRouterRequest(response.request())}`
    );
  }
});

page.on('requestfailed', (request) => {
  if (isNextRouterDataRequest(request)) {
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
    /ChunkLoadError|Failed to load chunk|ERR_ABORTED\s+404/i.test(message.text())
  ) {
    recordCritical(`chunk console.error: ${message.text()}`);
  }
});

async function describePage(response, path) {
  let title = '';
  let body = '';

  try {
    title = await page.title();
  } catch {}

  try {
    body = (await page.locator('body').innerText({ timeout: 2_000 }))
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  } catch {}

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
  const response = await page.goto(`${baseUrl}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });

  if (!response || response.status() >= 400) {
    throw new Error(`Document load failed: ${await describePage(response, path)}`);
  }

  await waitForRenderedBody(path, response);
}

async function verifyAbortedChunkUrls(stage) {
  const urls = [...abortedChunkUrls];
  abortedChunkUrls.clear();

  for (const url of urls) {
    const response = await context.request.get(url, {
      failOnStatusCode: false,
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!response.ok()) {
      throw new Error(
        `Aborted static chunk is missing during ${stage}: ${response.status()} GET ${url}`
      );
    }

    console.log(`OK aborted navigation asset still exists: ${url}`);
  }
}

async function settleAndVerifyChunks(stage) {
  await page.waitForTimeout(700);
  await verifyAbortedChunkUrls(stage);

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

async function verifyGlobalHeaderNavigation() {
  await goto('/');
  await settleAndVerifyChunks('home load and header prefetch');

  const primaryNavigation = page.locator(
    'nav[aria-label="Primary navigation"]'
  );

  const blogLink = primaryNavigation.locator('a[href="/blog"]');
  await blogLink.waitFor({ state: 'visible', timeout: 15_000 });
  await blogLink.click();
  await page.waitForURL(`${baseUrl}/blog`, { timeout: 15_000 });
  await waitForRenderedBody('/blog');
  await settleAndVerifyChunks('primary navigation / -> /blog');

  const componentsLink = page
    .locator('nav[aria-label="Primary navigation"]')
    .locator('a[href="/components"]');
  await componentsLink.waitFor({ state: 'visible', timeout: 15_000 });
  await componentsLink.click();
  await page.waitForURL(`${baseUrl}/components`, { timeout: 15_000 });
  await waitForRenderedBody('/components');
  await settleAndVerifyChunks('primary navigation /blog -> /components');

  const brandLink = page.locator('header a[href="/"]').first();
  await brandLink.waitFor({ state: 'visible', timeout: 15_000 });
  await brandLink.click();
  await page.waitForURL(`${baseUrl}/`, { timeout: 15_000 });
  await waitForRenderedBody('/');
  await settleAndVerifyChunks('brand navigation /components -> /');

  console.log('OK global header navigation and router/static integrity');
}

async function verifyClientRoutes(indexPath, routes) {
  for (const href of routes) {
    await goto(indexPath);
    await settleAndVerifyChunks(`document load ${indexPath}`);

    const link = page.locator(`a[href="${href}"]`).first();
    await link.waitFor({ state: 'visible', timeout: 15_000 });
    await link.click();
    await page.waitForURL(`${baseUrl}${href}`, { timeout: 15_000 });
    await waitForRenderedBody(href);
    await settleAndVerifyChunks(`client navigation ${indexPath} -> ${href}`);

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
    throw new Error('No component routes were discovered for chunk validation.');
  }

  console.log(`Discovered ${blogRoutes.length} blog routes for chunk validation.`);
  console.log(
    `Discovered ${componentRoutes.length} component routes for chunk validation.`
  );

  await verifyClientRoutes('/blog', blogRoutes);
  await verifyClientRoutes('/components', componentRoutes);
  await verifyAbortedChunkUrls('final verification');

  if (criticalDiagnostics.length > 0) {
    throw new Error(
      `Cloudflare navigation/static failures detected:\n${criticalDiagnostics.join('\n')}`
    );
  }
} catch (error) {
  try {
    await verifyAbortedChunkUrls('failure cleanup');
  } catch (probeError) {
    recordCritical(`aborted chunk verification failed: ${probeError}`);
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
