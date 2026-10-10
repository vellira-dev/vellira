/* global window, document, location, innerWidth, getComputedStyle */
// Isolated browser regression suite. Run against a local website started with
// NEXT_PUBLIC_VELLIRA_API_BASE_URL=http://127.0.0.1:41570. All API/provider proof
// is synthetic; PostgreSQL authority is exercised by backend integration tests.
import { chromium, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
const require = createRequire(import.meta.url);
const origin = process.env.AUTH_BROWSER_BASE_URL || 'http://127.0.0.1:31570';
const apiOrigin =
  process.env.AUTH_BROWSER_API_ORIGIN || 'http://127.0.0.1:41570';
if (
  [origin, apiOrigin].some(
    (value) => !['127.0.0.1', 'localhost'].includes(new URL(value).hostname)
  )
)
  throw new Error('Local test origin required');
const out = path.resolve(
  process.env.AUTH_BROWSER_OUTPUT || 'test-results/auth-remediation-browser'
);
await mkdir(out, { recursive: true });
const password = 'VELLIRA-CANARY-PASSWORD-DO-NOT-LEAK-9e34c2';
const email = 'security-canary@example.invalid';
const key = 'vellira-auth-login-preference';
const linkID = '00000000-0000-4000-8000-000000000123';
const connection = `/auth/connect?link=${linkID}&link_provider=github`;
// The only real local API response serves SSR presentation discovery. All auth
// requests remain intercepted synthetic fixtures; no production data is touched.
let discoveryProviders = ['google', 'apple', 'github'];
let discoveryAvailable = true;
const discovery = createServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  if (request.method !== 'GET' || request.url !== '/v1/auth/providers') {
    response.statusCode = 404;
    response.end('{}');
    return;
  }
  response.statusCode = discoveryAvailable ? 200 : 503;
  response.end(
    JSON.stringify(discoveryAvailable ? { providers: discoveryProviders } : {})
  );
});
await new Promise((resolve, reject) => {
  discovery.once('error', reject);
  discovery.listen(
    Number(new URL(apiOrigin).port),
    new URL(apiOrigin).hostname,
    resolve
  );
});
const browser = await chromium.launch({ headless: true }).catch((error) => {
  discovery.close();
  throw error;
});
const results = [];
async function fixture(width = 390, denied = false, deviceScaleFactor = 1) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    deviceScaleFactor,
  });
  if (denied)
    await context.addInitScript(() => {
      for (const key of ['localStorage', 'sessionStorage'])
        Object.defineProperty(window, key, {
          configurable: true,
          get() {
            throw new DOMException('Synthetic storage denial', 'SecurityError');
          },
        });
    });
  context.setDefaultTimeout(10000);
  const state = {
    authenticated: false,
    verified: false,
    mode: 'normal',
    oauth: 'cancel',
    ready: false,
    expired: false,
    calls: [],
    console: [],
    errors: [],
    external: [],
    requests: [],
  };
  await context.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === apiOrigin) {
      state.calls.push({
        path: url.pathname,
        method: request.method(),
        body: request.postData() || '',
        csrf: request.headers()['x-csrf-token'] || '',
        referrer: request.headers().referer || '',
      });
      const json = (body, status = 200) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
      const providerStart = url.pathname.match(
        /^\/v1\/auth\/oauth\/(github|google|apple)\/start$/
      );
      if (providerStart) {
        const provider = providerStart[1];
        const params = new URLSearchParams({ provider });
        if (url.searchParams.has('link')) {
          // A new GitHub identity cannot prove its own GitHub collision.
          expect(provider).not.toBe('github');
          state.authenticated = true;
          state.ready = true;
          params.set('link', linkID);
          params.set('link_provider', 'github');
        } else if (state.oauth === 'collision') {
          params.set('error', 'account_link_required');
          params.set('link', linkID);
          params.set('link_provider', 'github');
        } else if (state.oauth === 'success') state.authenticated = true;
        else
          params.set(
            'error',
            state.oauth === 'cancel' ? 'oauth_cancelled' : 'oauth_unavailable'
          );
        return route.fulfill({
          status: 303,
          headers: {
            location: origin + '/auth/callback?' + params,
            'referrer-policy': 'no-referrer',
          },
          body: '',
        });
      }
      if (
        url.pathname.endsWith('/login') ||
        url.pathname.endsWith('/register')
      ) {
        if (state.mode === 'offline')
          return route.abort('internetdisconnected');
        if (state.mode === 'bad-password')
          return json(
            {
              error: {
                code: 'invalid_credentials',
                message: '<script>CANARY-XSS</script>' + password,
              },
            },
            401
          );
        if (state.mode === 'exists')
          return json({ error: { code: 'account_exists' } }, 409);
        state.authenticated = true;
        state.ready = state.mode !== 'wrong-account';
        return json(
          url.pathname.endsWith('/register')
            ? { registered: true }
            : { authenticated: true },
          url.pathname.endsWith('/register') ? 201 : 200
        );
      }
      if (url.pathname === '/v1/me')
        return state.authenticated
          ? json({
              user: {
                id: 'canonical-canary-user',
                status: 'active',
                emailVerified: state.verified,
              },
            })
          : json({ error: { code: 'unauthenticated' } }, 401);
      if (url.pathname === '/v1/auth/csrf')
        return state.authenticated
          ? json({ csrfToken: 'VELLIRA-CANARY-CSRF' })
          : json({ error: { code: 'unauthenticated' } }, 401);
      if (url.pathname === '/v1/workspaces')
        return json({
          workspaces: [
            {
              id: 'canary-workspace',
              name: 'Canary workspace',
              status: 'active',
              membership: { role: 'owner' },
            },
          ],
        });
      if (url.pathname.includes('/link/')) {
        if (state.expired)
          return json({ error: { code: 'link_invalid' } }, 400);
        if (request.method() === 'GET')
          return json({ provider: 'github', readyToConnect: state.ready });
        if (
          !state.ready ||
          request.headers()['x-csrf-token'] !== 'VELLIRA-CANARY-CSRF'
        )
          return json({ error: { code: 'link_authentication_required' } }, 403);
        state.expired = true;
        return json({ connected: true });
      }
      if (url.pathname === '/v1/auth/password/reset')
        return json({ error: { code: 'invalid_challenge' } }, 400);
      if (url.pathname === '/v1/auth/email/verify') {
        state.verified = true;
        return json({ verified: true });
      }
      return json({ accepted: true });
    }
    if (url.origin !== origin && !['data:', 'blob:'].includes(url.protocol)) {
      state.external.push(url.origin + url.pathname);
      return route.abort();
    }
    state.requests.push({
      url: request.url(),
      body: request.postData() || '',
      referrer: request.headers().referer || '',
    });
    return route.continue();
  });
  const page = await context.newPage();
  page.on('console', (message) => state.console.push(message.text()));
  page.on('pageerror', (error) => state.errors.push(error.message));
  return { context, page, state };
}
async function audit(page) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const result = await page.evaluate(async () => {
    const axe = await window.axe.run('main', {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
    });
    const clipped = [...document.querySelectorAll('main button, main a')]
      .filter((node) => node.scrollWidth > node.clientWidth + 1)
      .map((node) => node.textContent);
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      clipped,
      violations: axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        targets: v.nodes.map((n) => n.target),
      })),
    };
  });
  expect(result).toEqual({ overflow: false, clipped: [], violations: [] });
  return result;
}
async function run(name, test) {
  if (
    process.env.AUTH_BROWSER_FILTER &&
    !new RegExp(process.env.AUTH_BROWSER_FILTER).test(name)
  )
    return;
  try {
    results.push({ name, status: 'PASS', ...(await test()) });
  } catch (error) {
    results.push({
      name,
      status: 'FAIL',
      error: String(error)
        .replaceAll(password, '[CANARY REDACTED]')
        .slice(0, 1800),
    });
  }
  console.log(results.at(-1).name + ': ' + results.at(-1).status);
  await writeFile(
    path.join(out, 'results.json'),
    JSON.stringify(results, null, 2)
  );
}
async function fill(page) {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await page.getByLabel(/^Password/).fill(password);
}
try {
  await run(
    'provider-discovery-failure-keeps-password-login-usable',
    async () => {
      const { context, page, state } = await fixture(320, true);
      try {
        discoveryProviders = ['github'];
        await page.goto(origin + '/login');
        await expect(
          page.getByRole('button', { name: 'Continue with GitHub' })
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Continue with Google' })
        ).toHaveCount(0);
        await expect(
          page.getByRole('button', { name: 'Continue with Apple' })
        ).toHaveCount(0);
        discoveryAvailable = false;
        await page.reload();
        await expect(
          page.getByRole('group', { name: 'Continue with a provider' })
        ).toHaveCount(0);
        await fill(page);
        await page
          .getByRole('button', { name: 'Sign in', exact: true })
          .click();
        await expect(page).toHaveURL(origin + '/app');
        expect(state.authenticated).toBe(true);
        return {
          availableProviderOnly: true,
          passwordWorksDuringDiscoveryFailure: true,
          storageDenied: true,
        };
      } finally {
        discoveryAvailable = true;
        discoveryProviders = ['google', 'apple', 'github'];
        await context.close();
      }
    }
  );
  await run('legal-destinations-and-local-social-artwork', async () => {
    const { context, page, state } = await fixture(390);
    try {
      for (const route of ['/terms', '/privacy', '/cookies']) {
        const response = await page.goto(origin + route);
        expect(response.status()).toBe(200);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      }
      await page.goto(origin + '/blog/two-runtimes');
      const article = page.getByRole('complementary', {
        name: 'Article actions',
      });
      for (const [name, slug] of [
        ['Facebook', 'facebook'],
        ['LinkedIn', 'linkedin'],
        ['Reddit', 'reddit'],
        ['X', 'x'],
      ]) {
        const link = article.getByRole('link', { name, exact: true });
        await expect(link).toBeVisible();
        const mask = await link
          .locator('[class*=socialBrand]')
          .evaluate((n) => getComputedStyle(n).maskImage);
        expect(mask).toContain(`/brand/social/${slug}.svg`);
        const resource = await page.request.get(
          origin + `/brand/social/${slug}.svg`
        );
        expect(resource.status()).toBe(200);
        await link.focus();
        // A real Tab establishes focus-visible semantics before supplementary tooltip proof.
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(
          page.getByRole('tooltip', { name, exact: true })
        ).toBeVisible();
      }
      expect(state.errors).toEqual([]);
      return {
        realLegalPages: true,
        localShareArtwork: true,
        focusTooltips: true,
      };
    } finally {
      await context.close();
    }
  });
  for (const width of [320, 375, 390, 768, 1440])
    for (const theme of ['Light', 'Dark']) {
      await run(`provider-artwork-${width}-${theme}`, async () => {
        const { context, page, state } = await fixture(width);
        const evidence = [];
        try {
          for (const route of ['/login', '/signup']) {
            await page.goto(origin + route);
            await page.getByRole('button', { name: /^Theme:/ }).click();
            await page
              .getByRole('menuitemradio', { name: theme, exact: true })
              .click();
            const group = page.getByRole('group', {
              name: 'Continue with a provider',
            });
            const buttons = group.getByRole('button');
            await expect(buttons).toHaveCount(3);
            expect(
              await buttons.evaluateAll((nodes) =>
                nodes.map((n) => n.getAttribute('aria-label'))
              )
            ).toEqual([
              'Continue with Google',
              'Continue with Apple',
              'Continue with GitHub',
            ]);
            const boxes = await buttons.evaluateAll((nodes) =>
              nodes.map((n) => {
                const r = n.getBoundingClientRect();
                return {
                  x: r.x,
                  y: r.y,
                  width: r.width,
                  height: r.height,
                  text: n.textContent,
                  radius: getComputedStyle(n).borderRadius,
                };
              })
            );
            for (const b of boxes) {
              expect(b.width).toBe(48);
              expect(b.height).toBe(48);
              expect(b.y).toBe(boxes[0].y);
              expect(b.text).toBe('');
              expect(b.radius).toBe('10%');
            }
            const images = await group
              .locator('img:visible')
              .evaluateAll((nodes) =>
                nodes.map((n) => ({
                  path: new URL(n.src).pathname,
                  loaded: n.complete && n.naturalWidth > 0,
                  transform: getComputedStyle(n).transform,
                  filter: getComputedStyle(n).filter,
                }))
              );
            expect(images.map((i) => i.path)).toEqual(
              theme === 'Light'
                ? [
                    '/brand/auth/google-light.svg',
                    '/brand/auth/apple-black.svg',
                  ]
                : ['/brand/auth/google-dark.svg', '/brand/auth/apple-white.svg']
            );
            for (const image of images) {
              expect(image.loaded).toBe(true);
              expect(image.transform).toBe('none');
              expect(image.filter).toBe('none');
            }
            for (let index = 0; index < 3; index++) {
              const button = buttons.nth(index);
              if (index === 0)
                await page.getByRole('button', { name: /^Theme:/ }).focus();
              await page.keyboard.press('Tab');
              await expect(button).toBeFocused();
              const label = await button.getAttribute('aria-label');
              await expect(
                page.getByRole('tooltip', { name: label, exact: true })
              ).toBeVisible();
              if (index > 0)
                await expect(
                  page.getByRole('tooltip', {
                    name: await buttons
                      .nth(index - 1)
                      .getAttribute('aria-label'),
                    exact: true,
                  })
                ).toBeHidden();
              const focus = await button.evaluate((n) => ({
                outline: getComputedStyle(n).outlineStyle,
                width: getComputedStyle(n).outlineWidth,
                offset: getComputedStyle(n).outlineOffset,
              }));
              expect(focus.outline).toBe('solid');
              expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(2);
              expect(parseFloat(focus.offset)).toBeGreaterThan(0);
            }
            await page.keyboard.press('Tab');
            await buttons.nth(0).hover();
            expect(
              await buttons
                .nth(0)
                .evaluate((n) => getComputedStyle(n).boxShadow)
            ).not.toBe('none');
            await page.mouse.down();
            await expect(buttons.nth(0)).toHaveCSS(
              'transform',
              'matrix(1, 0, 0, 1, 0, 1)'
            );
            await page.mouse.move(0, 0);
            await page.mouse.up();
            for (const label of [
              'Terms of Service',
              'Privacy Policy',
              'Cookie Policy',
            ])
              await expect(
                page.getByRole('link', {
                  name: `${label} (opens in a new tab)`,
                  exact: true,
                })
              ).toBeVisible();
            await audit(page);
            await page.screenshot({
              path: path.join(out, `${route.slice(1)}-${width}-${theme}.png`),
              fullPage: true,
            });
            evidence.push({ route, boxes, images });
          }
          expect(state.external).toEqual([]);
          expect(state.errors).toEqual([]);
          return { evidence };
        } finally {
          await context.close();
        }
      });
    }
  for (const width of [320, 375, 390, 768, 1440])
    await run('layout-a11y-' + width, async () => {
      const { context, page, state } = await fixture(width);
      const pages = [];
      try {
        for (const route of [
          '/login',
          '/signup',
          '/forgot-password',
          '/reset-password',
          '/auth/callback?error=account_link_required&provider=github',
          connection,
        ]) {
          await page.goto(origin + route);
          await expect(page.locator('main h1')).toBeVisible();
          if (route === connection)
            await expect(
              page.getByRole('button', {
                name: 'Sign in and continue',
                exact: true,
              })
            ).toBeVisible();
          if (route.startsWith('/auth/callback'))
            await expect(
              page.getByRole('main').getByRole('alert')
            ).toBeVisible();
          pages.push({ route, ...(await audit(page)) });
          await page.screenshot({
            path: path.join(
              out,
              `${route.split('?')[0].replaceAll('/', '_')}-${width}.png`
            ),
            fullPage: true,
          });
        }
        expect(state.errors).toEqual([]);
        return { pages };
      } finally {
        await context.close();
      }
    });
  await run('desktop-200-percent-equivalent-reflow', async () => {
    const { context, page } = await fixture(640, false, 2);
    try {
      await page.goto(origin + '/login');
      await expect(
        page.getByRole('button', { name: 'Sign in', exact: true })
      ).toBeVisible();
      await audit(page);
      return { physicalViewport: 1280, cssViewport: 640, scale: 2 };
    } finally {
      await context.close();
    }
  });
  await run(
    'rejected-password-keyboard-focus-and-secret-boundaries',
    async () => {
      const { context, page, state } = await fixture();
      try {
        state.mode = 'bad-password';
        await page.goto(origin + '/login');
        await fill(page);
        await page.getByLabel(/^Password/).press('Enter');
        await expect(page.getByRole('main').getByRole('alert')).toHaveText(
          'Invalid email or password.'
        );
        await expect(page.getByRole('main').getByRole('alert')).toBeFocused();
        await expect(page.getByLabel(/^Password/)).toHaveValue('');
        const snapshot = await page.evaluate(() => ({
          local: { ...localStorage },
          session: { ...sessionStorage },
          url: location.href,
          history: history.state,
          dom: document.documentElement.outerHTML,
        }));
        const cdp = await context.newCDPSession(page),
          history = await cdp.send('Page.getNavigationHistory');
        expect(
          JSON.stringify([
            snapshot,
            history,
            await context.cookies(),
            state.console,
            state.errors,
            state.requests,
          ])
        ).not.toContain(password);
        expect(await page.locator('main').innerText()).not.toContain(
          'CANARY-XSS'
        );
        expect(
          state.calls
            .filter((c) => c.body.includes(password))
            .map((c) => c.path)
        ).toEqual(['/v1/auth/login']);
        return { leakage: [], passwordCleared: true, errorFocused: true };
      } finally {
        await context.close();
      }
    }
  );
  await run(
    'fresh-email-signup-keeps-only-independent-preferences',
    async () => {
      const { context, page, state } = await fixture();
      try {
        await page.goto(origin + '/signup');
        await fill(page);
        await page
          .getByText('Save email and login method on this device', {
            exact: true,
          })
          .click();
        await expect(page.getByRole('checkbox')).toBeChecked();
        await page
          .getByRole('button', { name: 'Create account', exact: true })
          .click();
        await expect(page).toHaveURL(origin + '/app');
        await expect(
          page.getByText('Email not verified', { exact: true })
        ).toBeVisible();
        const snapshot = await page.evaluate(() => ({
          local: { ...localStorage },
          session: { ...sessionStorage },
          url: location.href,
          history: history.state,
          dom: document.documentElement.outerHTML,
        }));
        const cdp = await context.newCDPSession(page),
          history = await cdp.send('Page.getNavigationHistory');
        expect(
          JSON.stringify([
            snapshot,
            history,
            await context.cookies(),
            state.console,
            state.errors,
            state.requests,
          ])
        ).not.toContain(password);
        expect(JSON.parse(snapshot.local[key])).toEqual({
          version: 2,
          email,
          lastSuccessfulMethod: 'email',
        });
        expect(
          state.calls
            .filter((c) => c.body.includes(password))
            .map((c) => c.path)
        ).toEqual(['/v1/auth/register']);
        expect(state.calls.map((c) => c.referrer).join('')).not.toContain(
          password
        );
        return {
          immediateUnverifiedSession: true,
          leakage: [],
          persistedFields: ['version', 'email', 'lastSuccessfulMethod'],
        };
      } finally {
        await context.close();
      }
    }
  );
  await run('browser-script-cannot-read-HttpOnly-session-binding', async () => {
    const { context, page } = await fixture();
    // Synthetic cookie attributes mirror the reviewed backend session contract.
    // This probes browser exposure, not a live provider or production session.
    const token = 'VELLIRA-CANARY-SESSION-DO-NOT-LEAK';
    const csrf = 'VELLIRA-CANARY-CSRF-JS-READABLE';
    const cookieOrigin = origin.replace('http:', 'https:');
    try {
      await context.route(cookieOrigin + '/cookie-test', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<!doctype html><title>Synthetic cookie exposure</title><main>Local cookie test</main>',
        })
      );
      await context.addCookies([
        {
          name: '__Host-vellira_session',
          value: token,
          url: cookieOrigin,
          secure: true,
          httpOnly: true,
          sameSite: 'Lax',
        },
        {
          name: '__Host-vellira_session_csrf',
          value: csrf,
          url: cookieOrigin,
          secure: true,
          httpOnly: false,
          sameSite: 'Lax',
        },
      ]);
      await page.goto(cookieOrigin + '/cookie-test');
      const cookies = await context.cookies();
      expect(
        cookies.find((c) => c.name === '__Host-vellira_session')?.httpOnly
      ).toBe(true);
      const readable = await page.evaluate(() => document.cookie);
      expect(readable).not.toContain(token);
      expect(readable).toContain(csrf);
      expect(await page.locator('main').innerHTML()).not.toContain(token);
      return {
        sessionJSReadable: false,
        csrfIntentionallyReadable: true,
        scope: 'synthetic local browser cookie exposure',
      };
    } finally {
      await context.close();
    }
  });
  for (const outcome of ['cancel', 'error', 'success'])
    await run('last-successful-method-' + outcome, async () => {
      const { context, page, state } = await fixture(320);
      state.oauth = outcome;
      try {
        await page.goto(origin + '/login');
        await page.evaluate(
          ({ key, email }) =>
            localStorage.setItem(
              key,
              JSON.stringify({
                version: 2,
                email,
                lastSuccessfulMethod: 'email',
              })
            ),
          { key, email }
        );
        await page.reload();
        await expect(page.getByRole('checkbox')).toBeChecked();
        await page
          .getByRole('button', { name: 'Continue with GitHub', exact: true })
          .click();
        if (outcome === 'success')
          await expect(page).toHaveURL(origin + '/app');
        else
          await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
        const saved = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)),
          key
        );
        expect(saved).toEqual({
          version: 2,
          email,
          lastSuccessfulMethod: outcome === 'success' ? 'github' : 'email',
        });
        if (outcome === 'success') {
          await page.goto(origin + '/login');
          await expect(
            page.getByRole('button', {
              name: 'Continue with GitHub',
            })
          ).toBeVisible();
          await audit(page);
        }
        return {
          savedFields: Object.keys(saved),
          lastSuccessfulMethod: saved.lastSuccessfulMethod,
        };
      } finally {
        await context.close();
      }
    });
  for (const denied of [false, true])
    await run(
      'explicit-connection-with-storage-' + (denied ? 'denied' : 'available'),
      async () => {
        const { context, page, state } = await fixture(390, denied);
        state.oauth = 'collision';
        try {
          await page.goto(origin + '/login');
          await page
            .getByRole('button', { name: 'Continue with GitHub', exact: true })
            .click();
          await expect(page).toHaveURL(origin + connection);
          await expect(
            page.getByRole('heading', {
              name: 'Connect GitHub to your Vellira account',
            })
          ).toBeVisible();
          await fill(page);
          await page.getByLabel(/^Password/).press('Enter');
          const connect = page.getByRole('button', {
            name: 'Connect GitHub',
            exact: true,
          });
          await expect(connect).toBeVisible();
          expect(
            state.calls.filter((c) => c.method === 'POST').map((c) => c.path)
          ).toEqual(['/v1/auth/login']);
          await audit(page);
          await connect.click();
          await expect(
            page.getByText('GitHub is connected to your Vellira account.', {
              exact: true,
            })
          ).toBeVisible();
          const mutation = state.calls.find(
            (c) => c.path.endsWith('/link/' + linkID) && c.method === 'POST'
          );
          expect(mutation.body).toBe('{}');
          expect(mutation.csrf).toBe('VELLIRA-CANARY-CSRF');
          await page.getByRole('link', { name: 'Continue to Vellira' }).click();
          await expect(page).toHaveURL(origin + '/app');
          expect(state.errors).toEqual([]);
          return {
            explicitMutationCount: state.calls.filter(
              (c) => c.path.includes('/link/') && c.method === 'POST'
            ).length,
            authority: 'ordinary login then CSRF completion',
          };
        } finally {
          await context.close();
        }
      }
    );
  await run(
    'wrong-account-recovery-and-refresh-do-not-connect-implicitly',
    async () => {
      const { context, page, state } = await fixture();
      state.mode = 'wrong-account';
      try {
        await page.goto(origin + connection);
        await fill(page);
        await page
          .getByRole('button', { name: 'Sign in and continue', exact: true })
          .click();
        await expect(page.getByRole('main').getByRole('alert')).toContainText(
          'That sign-in did not confirm the account'
        );
        await expect(
          page.getByRole('button', { name: 'Connect GitHub', exact: true })
        ).toHaveCount(0);
        state.mode = 'normal';
        await fill(page);
        await page
          .getByRole('button', { name: 'Sign in and continue', exact: true })
          .click();
        await expect(
          page.getByRole('button', { name: 'Connect GitHub', exact: true })
        ).toBeVisible();
        await page.reload();
        await expect(
          page.getByRole('button', { name: 'Connect GitHub', exact: true })
        ).toBeVisible();
        expect(
          state.calls.filter(
            (c) => c.path.includes('/link/') && c.method === 'POST'
          )
        ).toEqual([]);
        return {
          wrongAccountRejected: true,
          refreshRetainsConfirmation: true,
          noImplicitLink: true,
        };
      } finally {
        await context.close();
      }
    }
  );
  await run('provider-ownership-proof-returns-to-confirmation', async () => {
    const { context, page, state } = await fixture(390, true);
    try {
      await page.goto(origin + connection);
      await expect(
        page.getByRole('button', { name: 'Continue with GitHub', exact: true })
      ).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Continue with Google', exact: true })
        .click();
      await expect(page).toHaveURL(origin + connection);
      await expect(
        page.getByRole('button', { name: 'Connect GitHub', exact: true })
      ).toBeVisible();
      expect(state.calls.filter((c) => c.method === 'POST')).toEqual([]);
      expect(state.errors).toEqual([]);
      return { noImplicitLink: true };
    } finally {
      await context.close();
    }
  });
  await run(
    'verification-in-another-tab-refreshes-canonical-state',
    async () => {
      const { context, page, state } = await fixture();
      state.authenticated = true;
      try {
        await page.goto(origin + '/app');
        await expect(
          page.getByText('Email not verified', { exact: true })
        ).toBeVisible();
        state.verified = true;
        await page
          .getByRole('button', {
            name: 'Resend verification email',
            exact: true,
          })
          .click();
        await expect(
          page.getByText('Email not verified', { exact: true })
        ).toHaveCount(0);
        expect(
          state.calls.filter((c) => c.path === '/v1/me').length
        ).toBeGreaterThan(1);
        expect(
          state.calls.find((c) => c.path.endsWith('/resend/current')).body
        ).toBe('');
        return { canonicalRefresh: true, arbitraryRecipient: false };
      } finally {
        await context.close();
      }
    }
  );
  await run('expired-reset-has-direct-recovery-and-scrubs-token', async () => {
    const { context, page, state } = await fixture();
    try {
      await page.goto(
        origin + '/reset-password#token=VELLIRA-CANARY-RESET-TOKEN'
      );
      await page.getByLabel(/^New password/).fill(password);
      await page
        .getByRole('button', { name: 'Reset password', exact: true })
        .click();
      await expect(
        page.getByRole('link', { name: 'Request another reset link' })
      ).toBeVisible();
      expect(page.url()).toBe(origin + '/reset-password');
      expect(await page.locator('main').innerHTML()).not.toContain(password);
      expect(state.console.join('\n')).not.toContain(password);
      return { recovery: '/forgot-password', secretURL: false };
    } finally {
      await context.close();
    }
  });
} finally {
  await browser.close();
  await new Promise((resolve) => discovery.close(resolve));
  await writeFile(
    path.join(out, 'results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log(
    JSON.stringify(
      results.map(({ name, status }) => ({ name, status })),
      null,
      2
    )
  );
  if (results.some((result) => result.status !== 'PASS')) process.exitCode = 1;
}
