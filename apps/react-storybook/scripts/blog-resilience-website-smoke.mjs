import assert from 'node:assert/strict';

import { expect } from '@playwright/test';

// Test-only transport: exercise the built UI without sending views or likes
// to a live backend. Actual pages, components, styles and theme tokens are used.
async function openProbePage(browser, catalog, candidate, fault = null, theme = 'light') {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.emulateMedia({ colorScheme: theme === 'dark' ? 'dark' : 'light' });
  await page.addInitScript(({ catalog, candidate, fault, theme }) => {
    localStorage.setItem('vellira-website-theme', theme);
    const originalFetch = window.fetch.bind(window);
    const probe = { fault, calls: [], aborted: 0, cancelled: 0 };
    window.__blogResilience = probe;
    const liked = new Set();
    const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }));
    const missing = () => json({ error: { code: 'article_not_found' } }, 404);

    window.fetch = (input, init = {}) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith('/api/blog-metrics/')) {
        return originalFetch(input, init);
      }
      const method = init.method ?? (input instanceof Request ? input.method : 'GET');
      probe.calls.push({ path: url.pathname, method });
      const failure = probe.fault;
      if (failure && method === failure.method && url.pathname.endsWith(failure.suffix)) {
        init.signal?.addEventListener('abort', () => { probe.aborted += 1; }, { once: true });
        if (failure.stage === 'headers') return new Promise(() => {});
        return Promise.resolve(new Response(new ReadableStream({
          start(controller) { controller.enqueue(new TextEncoder().encode('{"error":')); },
          cancel() { probe.cancelled += 1; },
        }), { status: failure.status }));
      }
      if (url.pathname === '/api/blog-metrics/metrics') {
        const slugs = url.searchParams.getAll('slug');
        return slugs.some((slug) => slug === candidate || !catalog[slug])
          ? missing()
          : json({ items: slugs.map((slug) => catalog[slug]) });
      }
      const parts = url.pathname.split('/');
      const slug = decodeURIComponent(parts[4] ?? '');
      if (slug === candidate || !catalog[slug]) return missing();
      if (parts[3] === 'metrics') return json(catalog[slug]);
      if (parts[5] === 'views' && method === 'POST') return json({ metrics: catalog[slug] });
      if (parts[5] === 'like') {
        if (method === 'GET') return json({ slug, liked: liked.has(slug) });
        const next = method === 'PUT';
        const changed = liked.has(slug) !== next;
        if (changed) catalog[slug].likes += next ? 1 : -1;
        if (next) liked.add(slug); else liked.delete(slug);
        return json({ metrics: catalog[slug], liked: next, changed });
      }
      throw new Error(`Unexpected metrics request: ${method} ${url.pathname}`);
    };
  }, { catalog, candidate, fault, theme });
  return page;
}

async function linkState(link) {
  return link.evaluate((element) => {
    const style = getComputedStyle(element);
    const resolveColor = (token) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${token})`;
      element.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    return {
      color: style.color,
      hovered: element.matches(':hover'),
      focused: element.matches(':focus-visible'),
      href: element.getAttribute('href'),
      underline: style.textDecorationLine,
      thickness: style.textDecorationThickness,
      outline: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
      transition: style.transitionDuration,
      normal: resolveColor('--text-brand'),
      hover: resolveColor('--text-interactive-hover'),
      pressed: resolveColor('--text-interactive-pressed'),
    };
  });
}

async function verifyLinkStates(page, link, theme) {
  await expect(page.locator('html')).toHaveAttribute('data-vellira-theme', theme);
  for (const reducedMotion of ['no-preference', 'reduce']) {
    try {
      await page.emulateMedia({ reducedMotion });
      await link.evaluate((element) => element.blur());
      await page.mouse.move(0, 0);
      const normal = await linkState(link);
      await expect.poll(async () => (await linkState(link)).color).toBe(normal.normal);
      await expect(link).toHaveCSS('text-decoration-line', 'none');
      await expect(link).toHaveCSS('text-decoration-thickness', '1px');
      assert.notEqual(normal.normal, normal.hover, `${theme}: distinct hover color required`);
      assert.notEqual(normal.hover, normal.pressed, `${theme}: distinct pressed color required`);
      if (reducedMotion === 'reduce') await expect(link).toHaveCSS('transition-duration', '0s');
      await link.hover();
      await expect.poll(async () => (await linkState(link)).hovered, { message: `${theme}: pointer must remain over the prose link` }).toBe(true);
      await expect(link).toHaveCSS('color', normal.hover);
      await expect(link).toHaveCSS('text-decoration-line', 'underline');
      await expect(link).toHaveCSS('text-decoration-thickness', '2px');
      await page.mouse.down();
      try {
        await expect(link).toHaveCSS('color', normal.pressed);
      } finally {
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }
      // Enter the actual tab sequence instead of forcing :focus-visible CSS.
      await link.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
      await expect(link).toHaveCSS('color', normal.hover);
      await expect(link).toHaveCSS('text-decoration-line', 'underline');
      const focus = await linkState(link);
      assert.ok(focus.focused && focus.outline !== 'none' && focus.outlineWidth > 0);
      // Pointer exit and focus exit must restore the undecorated brand state.
      await link.evaluate((element) => element.blur());
      await page.mouse.move(0, 0);
      await expect(link).toHaveCSS('color', normal.normal);
      await expect(link).toHaveCSS('text-decoration-line', 'none');
      console.log(`Blog prose states: ${theme} / ${reducedMotion}: OK`);
    } catch (error) {
      console.error(`Blog prose failure: ${theme} / ${reducedMotion}`, await linkState(link));
      throw error;
    }
  }
}

async function verifyMutationRecovery(page, metrics) {
  const actions = page.getByRole('complementary', { name: 'Article actions' });
  for (const failure of [
    { status: 404, stage: 'body' },
    { status: 503, stage: 'body' },
    { status: 200, stage: 'body' },
    { status: 200, stage: 'headers' },
  ]) {
    for (const method of ['PUT', 'DELETE']) {
      const wasLiked = method === 'DELETE';
      const count = metrics.likes + (wasLiked ? 1 : 0);
      const button = actions.getByRole('button', { name: wasLiked ? 'Unlike this article' : 'Like this article' });
      await page.evaluate((fault) => {
        const probe = window.__blogResilience;
        probe.calls = [];
        probe.aborted = 0;
        probe.cancelled = 0;
        probe.fault = fault;
      }, { ...failure, method, suffix: '/like' });
      await button.click();
      if (failure.status !== 503) await expect(button).toBeDisabled();
      await expect(button).toBeEnabled({ timeout: 12_000 });
      await expect(button).toHaveAttribute('aria-pressed', String(wasLiked));
      await expect(actions.getByLabel(`${count} likes`, { exact: true })).toBeVisible();
      const probe = await page.evaluate(() => window.__blogResilience);
      assert.equal(probe.calls.filter((call) => call.method === method).length, 1);
      assert.ok(probe.aborted > 0);
      if (failure.stage === 'body') assert.ok(probe.cancelled > 0);
      await expect(actions.getByRole('button', { name: 'Share', exact: true })).toBeEnabled();
      await page.evaluate(() => { window.__blogResilience.fault = null; });
      await button.click();
      await expect(actions.getByRole('button', { name: wasLiked ? 'Like this article' : 'Unlike this article' })).toHaveAttribute('aria-pressed', String(!wasLiked));
      console.log(`Blog ${method} recovery: ${failure.status} / ${failure.stage}: OK`);
    }
  }
}

export async function verifyBlogResilience(browser, baseUrl) {
  const manifestPage = await browser.newPage();
  let slugs;
  try {
    const response = await manifestPage.request.get(`${baseUrl}/blog/manifest.json`);
    assert.ok(response.ok(), 'Published blog manifest must load');
    const manifest = await response.json();
    assert.equal(manifest.schemaVersion, 1);
    slugs = manifest.slugs;
    assert.ok(Array.isArray(slugs) && slugs.length >= 2, 'Need two actual published pages');
  } finally {
    await manifestPage.close();
  }
  const candidate = slugs.at(-1);
  const catalog = Object.fromEntries(slugs.filter((slug) => slug !== candidate).map((slug, index) => [slug, { slug, views: 200 + index, likes: 20 + index }]));
  const page = await openProbePage(browser, catalog, candidate);
  let articleSlug;
  try {
    await page.goto(`${baseUrl}/blog`, { waitUntil: 'domcontentloaded' });
    for (const metrics of Object.values(catalog)) {
      const card = page.locator(`a[href="/blog/${metrics.slug}"]`).locator('xpath=ancestor::article[1]');
      await expect(card.getByLabel(`${metrics.views} views`, { exact: true })).toBeVisible();
      await expect(card.getByLabel(`${metrics.likes} likes`, { exact: true })).toBeVisible();
    }
    const candidateCard = page.locator(`a[href="/blog/${candidate}"]`).locator('xpath=ancestor::article[1]');
    await expect(candidateCard).toBeVisible();
    await expect(candidateCard.getByLabel('Article metrics', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('0 views', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('0 likes', { exact: true })).toHaveCount(0);
    console.log('Blog mixed catalog: real card counts retained, candidate omitted: OK');

    // Use real content with a prose link; do not inject a substitute link fixture.
    for (const slug of Object.keys(catalog)) {
      await page.goto(`${baseUrl}/blog/${slug}`, { waitUntil: 'domcontentloaded' });
      if (await page.locator('[class*="articleBody"] a[href]').count()) {
        articleSlug = slug;
        break;
      }
    }
    assert.ok(articleSlug, 'A published article with an actual prose link is required');
    const actions = page.getByRole('complementary', { name: 'Article actions' });
    await expect(actions.getByLabel(`${catalog[articleSlug].views} views`, { exact: true })).toBeVisible();
    // Use the same isolated persisted-theme setup as the maintained website
    // consumer smoke, so menu focus/scroll restoration cannot affect pointer tests.
    for (const theme of ['light', 'dark', 'high-contrast']) {
      const themed = await openProbePage(browser, catalog, candidate, null, theme);
      try {
        await themed.goto(`${baseUrl}/blog/${articleSlug}`, { waitUntil: 'domcontentloaded' });
        await expect(themed.locator('html')).toHaveAttribute('data-vellira-theme', theme);
        // The generated arrow participates in the accessible name: assert the
        // real navigation target and visible text without assuming its absence.
        const back = themed.locator('main article header a[href="/blog"]');
        await expect(back).toHaveText('Back to blog');
        // Theme hydration can transition from the SSR color. Compare against
        // the resolved semantic role, not a transient in-flight color sample.
        const backColor = await back.evaluate((element) => {
          const probe = document.createElement('span');
          probe.style.color = 'var(--text-secondary)';
          element.append(probe);
          const color = getComputedStyle(probe).color;
          probe.remove();
          return color;
        });
        await expect(back).toHaveCSS('color', backColor);
        await verifyLinkStates(themed, themed.locator('[class*="articleBody"] a[href]').first(), theme);
        await expect(back).toHaveCSS('color', backColor);
      } finally {
        await themed.close();
      }
    }
    await verifyMutationRecovery(page, catalog[articleSlug]);
  } finally {
    await page.close();
  }

  for (const status of [404, 503]) {
    const bootstrap = await openProbePage(browser, catalog, candidate, { method: 'GET', suffix: '/like', status, stage: 'body' });
    try {
      await bootstrap.goto(`${baseUrl}/blog/${articleSlug}`, { waitUntil: 'domcontentloaded' });
      const actions = bootstrap.getByRole('complementary', { name: 'Article actions' });
      await expect(actions.getByLabel(`${catalog[articleSlug].views} views`, { exact: true })).toBeVisible({ timeout: 12_000 });
      await expect(actions.getByRole('button', { name: 'Like this article' })).toBeEnabled();
      const probe = await bootstrap.evaluate(() => window.__blogResilience);
      assert.ok(probe.cancelled > 0);
      assert.equal(probe.calls.filter((call) => ['PUT', 'DELETE'].includes(call.method)).length, 0);
      console.log(`Blog actor bootstrap ${status}: article counts recovered: OK`);
    } finally {
      await bootstrap.close();
    }
  }
}
