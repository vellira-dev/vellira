/* global window, document, addEventListener */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import {
  buildGenerations,
  startMigrationOrigin,
} from './cloudflare-migration-origin.mjs';
import { sha256 } from './cloudflare-static-asset-archive.mjs';

const directory = path.resolve(
  process.env.MIGRATION_RESULTS ??
    'apps/react-storybook/test-results/cloudflare-migration'
);
await fs.mkdir(directory, { recursive: true });
const generations = await buildGenerations(directory);
function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  assert.equal(
    result.status,
    0,
    `Cannot establish evidence provenance: ${result.stderr}`
  );
  return result.stdout.trim();
}
const provenance = {
  head: git('rev-parse', 'HEAD'),
  worktreeClean: git('status', '--porcelain') === '',
};
assert.match(provenance.head, /^[a-f0-9]{40}$/);
if (process.env.CI === 'true')
  assert.ok(
    provenance.worktreeClean,
    'Migration CI requires a clean exact-head checkout'
  );
const engines = { chromium, firefox, webkit };
const reports = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (const name of (
  process.env.MIGRATION_BROWSERS ?? 'chromium,firefox,webkit'
).split(',')) {
  assert.ok(engines[name], `Unknown browser ${name}`);
  const origin = await startMigrationOrigin(generations, directory);
  const browserDirectory = path.join(directory, name);
  await fs.mkdir(browserDirectory, { recursive: true });
  // Browser profiles contain generated executable-looking files (Firefox's
  // prefs.js). Keep them outside maintained source scans; evidence records the
  // exact persistent directory reused throughout this run and after reopening.
  const profile = await fs.mkdtemp(
    path.join(os.tmpdir(), `vellira-${name}-profile-`)
  );
  // Native browser preferences, not cookie/header interception. WebKit's
  // Playwright API does not expose its global cookie-accept policy.
  const cookiesDisabled = name === 'chromium' || name === 'firefox';
  if (name === 'chromium') {
    await fs.mkdir(path.join(profile, 'Default'), { recursive: true });
    await fs.writeFile(
      path.join(profile, 'Default/Preferences'),
      JSON.stringify({
        profile: { default_content_setting_values: { cookies: 2 } },
      })
    );
  }
  const report = {
    browser: name,
    provenance,
    profile,
    origin: origin.url,
    generations: Object.fromEntries(
      Object.entries(generations).map(([key, value]) => [
        key,
        { buildId: value.buildId, browserChunks: value.browserChunks },
      ])
    ),
    assertions: [],
    events: [],
    limitations: [],
  };
  const passed = (assertion, evidence = {}) => {
    report.assertions.push({ assertion, ...evidence });
    console.log(`${name}: PASS ${assertion}`);
  };
  const options = {
    headless: true,
    ...(name === 'chromium' ? { channel: 'chromium' } : {}),
    ignoreDefaultArgs: ['--disable-back-forward-cache'],
    firefoxUserPrefs: {
      'browser.cache.disk.enable': true,
      'network.cookie.cookieBehavior': 2,
    },
  };
  let context;
  const capture = async (page, label) => {
    page.on('pageerror', (error) =>
      report.events.push({ kind: 'pageerror', label, error: String(error) })
    );
    page.on('response', (response) => {
      report.events.push({
        kind: 'response',
        label,
        url: response.url(),
        status: response.status(),
        headers: response.headers(),
        document: response.request().isNavigationRequest(),
        requestHeaders: response.request().headers(),
        fromServiceWorker: response.fromServiceWorker(),
      });
    });
    const cdp = name === 'chromium' ? await context.newCDPSession(page) : null;
    if (cdp) {
      await cdp.send('Network.enable');
      await cdp.send('Page.enable');
      cdp.on('Page.backForwardCacheNotUsed', (data) =>
        report.events.push({ kind: 'bfcache-not-used', label, ...data })
      );
      for (const event of [
        'requestWillBeSent',
        'requestServedFromCache',
        'responseReceived',
      ]) {
        cdp.on(`Network.${event}`, (data) =>
          report.events.push({ kind: event, label, ...data })
        );
      }
    }
    await page.addInitScript(() => {
      window.__pageShow = [];
      addEventListener('pageshow', (event) =>
        window.__pageShow.push({ persisted: event.persisted, at: Date.now() })
      );
    });
  };
  const ready = async (page) => {
    await page.waitForFunction(
      () => typeof window.__migrationTransport === 'function'
    );
  };
  const transport = async (page, url) =>
    page.evaluate((url) => window.__migrationTransport(url), url);
  const plainFetch = async (page, url) =>
    page.evaluate(async (url) => {
      const response = await fetch(url, { headers: { RSC: '1' } });
      return {
        body: await response.text(),
        headers: Object.fromEntries(response.headers),
      };
    }, url);
  try {
    context = await engines[name].launchPersistentContext(profile, options);
    const page = context.pages()[0];
    await capture(page, 'main');
    await page.goto(origin.url);
    await ready(page);
    await expect(page.locator('h1')).toHaveText('Generation A');
    if (cookiesDisabled) {
      const probe = await page.evaluate(async () => {
        document.cookie = 'vellira_script_probe=1; Path=/';
        await fetch('/api/cookie-probe');
        return {
          script: document.cookie,
          server: await (await fetch('/api/cookie-probe')).text(),
        };
      });
      assert.deepEqual(
        probe,
        { script: '', server: '' },
        'Browser must reject both script and HTTP cookies'
      );
      assert.deepEqual(await context.cookies(), []);
      passed(
        'native cookie blocking verified; entire migration runs with cookies disabled'
      );
    } else
      report.limitations.push(
        'WebKit cookie-disabled setting is not exposed by Playwright; run real Safari with Block All Cookies. This run is cookie-independent, not native cookie-blocking proof.'
      );
    // Keep a separate old document alive through the full sequence. Its lazy
    // module has not been requested at the time A ceases to be active.
    const oldTab = await context.newPage();
    await capture(oldTab, 'old-A');
    await oldTab.goto(origin.url);
    await ready(oldTab);
    const lateTab = await context.newPage();
    await capture(lateTab, 'late-A');
    await lateTab.goto(origin.url);
    await ready(lateTab);

    origin.state.poison = true;
    await transport(page, '/target/fresh');
    const poisonedUrl = origin.requests.findLast(
      (request) => request.rsc && request.url.startsWith('/target/fresh')
    ).url;
    const cacheRequests = () =>
      origin.requests.filter((request) => request.url === poisonedUrl).length;
    const beforeSeed = cacheRequests();
    const seed = await plainFetch(page, poisonedUrl);
    assert.equal(
      cacheRequests(),
      beforeSeed + 1,
      'Request-side no-store must not store the previous public Flight response'
    );
    passed(
      'patched transport prevents new HTTP entries even with legacy public response headers'
    );
    assert.match(seed.body, /migration-A/);
    const afterSeed = cacheRequests();
    const cached = await plainFetch(page, poisonedUrl);
    assert.equal(cached.body, seed.body);
    assert.equal(
      cacheRequests(),
      afterSeed,
      'Seeded Flight response must really be served without a server request'
    );
    passed('real HTTP Flight cache populated', { poisonedUrl });
    origin.state.poison = false;

    // Validate same-build prefetch usefulness independently of seeded URLs.
    await page.locator('#prefetched').hover();
    await expect
      .poll(
        () =>
          origin.requests.filter(
            (request) =>
              request.rsc && request.url.startsWith('/target/prefetched')
          ).length
      )
      .toBeGreaterThan(0);
    await pause(250);
    const prefetchCount = origin.requests.filter(
      (request) => request.rsc && request.url.startsWith('/target/prefetched')
    ).length;
    await page.locator('#prefetched').click();
    await expect(page.locator('h1')).toHaveText('Target prefetched A');
    assert.equal(
      origin.requests.filter(
        (request) => request.rsc && request.url.startsWith('/target/prefetched')
      ).length,
      prefetchCount
    );
    passed('valid in-memory prefetch reused without RSC refetch');

    await origin.activate('B');
    const beforeBaseline = origin.requests.length;
    const beforeBaselineCacheRequests = cacheRequests();
    const stale = await plainFetch(page, poisonedUrl);
    assert.equal(stale.body, seed.body);
    assert.equal(cacheRequests(), beforeBaselineCacheRequests);
    passed(
      'baseline default fetch returns A after B without contacting origin'
    );
    const corrected = await transport(page, '/target/fresh');
    assert.match(corrected.body, /migration-B/);
    assert.equal(corrected.headers['x-vellira-build-id'], 'migration-B');
    assert.match(corrected.headers['cache-control'], /no-store/);
    assert.ok(
      origin.requests
        .slice(beforeBaseline)
        .some((request) => request.rsc && request.generation === 'B')
    );
    passed(
      'actual patched Next createFetch bypasses existing stale HTTP entry'
    );

    // An old prefetched route may validly render A. Its original asset URLs
    // must still resolve; the next uncached request must safely converge to B.
    await oldTab.locator('#prefetched').click();
    await expect(oldTab.locator('h1')).toHaveText(/Target prefetched [AB]/);
    await oldTab.locator('#lazy').click();
    await expect(oldTab.locator('#lazy-result')).toHaveText(/Lazy [AB]:/);
    passed('old tab and prefetched-not-visited route survive B', {
      heading: await oldTab.locator('h1').textContent(),
      lazy: await oldTab.locator('#lazy-result').textContent(),
    });

    for (const generation of ['B', 'C', 'A']) {
      if (generation !== 'B') await origin.activate(generation);
      if (generation === 'C') {
        await lateTab.locator('#lazy-later').click();
        await expect(lateTab.locator('#later-result')).toHaveText(
          'Later lazy A: first requested after C'
        );
        await expect(lateTab.locator('#client-generation')).toHaveText(
          'Client A'
        );
        passed(
          'unreloaded A document requests its previously unused lazy chunk after C'
        );
      }
      const documentsBefore = report.events.filter(
        (event) =>
          event.kind === 'response' && event.label === 'main' && event.document
      ).length;
      await page.locator('#fresh').click();
      await expect(page.locator('h1')).toHaveText(`Target fresh ${generation}`);
      passed(`navigation converges to ${generation}`, {
        documentsBefore,
        documentsAfter: report.events.filter(
          (event) =>
            event.kind === 'response' &&
            event.label === 'main' &&
            event.document
        ).length,
      });
      await page.locator('#home').click();
      await expect(page.locator('h1')).toHaveText(`Generation ${generation}`);
      // Real wall time, not a mocked clock: expired router entries need new RSC.
      // Next 16.3 clamps server segment stale times to at least 30 seconds.
      await pause(31_500);
      const beforeExpired = origin.requests.length;
      await page.locator('#expired').click();
      await expect(page.locator('h1')).toHaveText(
        `Target expired ${generation}`
      );
      assert.ok(
        origin.requests.slice(beforeExpired).some((request) => request.rsc)
      );
      passed(`expired router entry revalidates at ${generation}`);
      for (const build of Object.values(generations).filter(
        (build) =>
          generation === 'A' ||
          build.buildId !== 'migration-C' ||
          generation === 'C'
      )) {
        for (const asset of build.assets) {
          const response = await fetch(
            `${origin.url}${asset.pathname.split('/').map(encodeURIComponent).join('/')}`
          );
          assert.equal(response.status, 200, asset.pathname);
          assert.equal(
            sha256(Buffer.from(await response.arrayBuffer())),
            asset.sha256
          );
          assert.equal(response.headers.get('content-type'), asset.contentType);
          assert.match(
            response.headers.get('cache-control'),
            /max-age=31536000, immutable/
          );
        }
      }
      passed(`retained asset byte/MIME/immutable closure at ${generation}`);
      const document = await fetch(origin.url);
      assert.equal(
        document.headers.get('cache-control'),
        'no-cache, max-age=0, must-revalidate'
      );
      assert.equal(
        document.headers.get('cloudflare-cdn-cache-control'),
        'no-store'
      );
      for (const header of ['clear-site-data', 'set-cookie', 'location'])
        assert.equal(document.headers.get(header), null);
      const api = await fetch(`${origin.url}/api/cache-contract`);
      assert.equal(api.headers.get('cache-control'), 'private, max-age=120');
    }
    passed('A→B→C→rollback uses one browser profile and retains old tabs');

    await page.goto(origin.url);
    await ready(page);
    await page.goto(`${origin.url}/outside`);
    await origin.activate('B');
    await page.goBack({ waitUntil: 'commit' });
    await ready(page);
    const pageShows = await page.evaluate(() => window.__pageShow);
    passed('back/forward restores a working page', { pageShows });
    if (name === 'chromium')
      assert.ok(
        pageShows.some((show) => show.persisted),
        'Chromium must actually restore from bfcache'
      );
    await page.locator('#lazy').click();
    await expect(page.locator('#lazy-result')).toHaveText(/Lazy [AB]:/);
    await page.locator('#fresh').click();
    await expect(page.locator('h1')).toHaveText('Target fresh B');
    passed(
      'restored document can load a lazy module and converge after another activation'
    );
    if (!pageShows.some((show) => show.persisted))
      report.limitations.push(
        'No actual bfcache restoration observed in this engine/run; back/forward alone is not bfcache proof.'
      );

    // Repopulate a real disk cache entry before orderly close. The same disk
    // profile, not storageState or a fresh context, must retain it on reopen.
    await origin.activate('A');
    origin.state.poison = true;
    const persisted = await plainFetch(page, poisonedUrl);
    assert.match(persisted.body, /migration-A/);
    await context.close();
    context = null;
    origin.state.poison = false;
    await origin.activate('B');
    context = await engines[name].launchPersistentContext(profile, options);
    const reopened = context.pages()[0];
    await capture(reopened, 'reopened');
    await reopened.goto(origin.url);
    await ready(reopened);
    const beforeReopenFetch = cacheRequests();
    const reopenedCached = await plainFetch(reopened, poisonedUrl);
    assert.match(reopenedCached.body, /migration-A/);
    assert.equal(cacheRequests(), beforeReopenFetch);
    assert.match(
      (await transport(reopened, '/target/fresh')).body,
      /migration-B/
    );
    passed(
      'disk-cache poison survives close/reopen; patched transport bypasses it'
    );
    assert.deepEqual(
      report.events.filter((event) => event.kind === 'pageerror'),
      []
    );
    assert.deepEqual(
      report.events.filter(
        (event) =>
          event.kind === 'response' &&
          event.url.includes('/_next/static/') &&
          event.status >= 400
      ),
      []
    );
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = error.stack ?? String(error);
    console.error(`${name}: ${report.error}`);
  } finally {
    await context?.close();
    report.originRequests = origin.requests;
    await fs.writeFile(
      path.join(browserDirectory, 'evidence.json'),
      JSON.stringify(report, null, 2)
    );
    reports.push({
      browser: name,
      status: report.status,
      limitations: report.limitations,
    });
    await origin.close();
  }
}
await fs.writeFile(
  path.join(directory, 'summary.json'),
  JSON.stringify(reports, null, 2)
);
assert.ok(
  reports.every((report) => report.status === 'passed'),
  'Migration browser matrix failed; inspect per-engine evidence.json'
);
