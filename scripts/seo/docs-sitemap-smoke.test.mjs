import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import {
  DOCS_ORIGIN,
  inspectBuiltDocsDiscovery,
  inspectLiveDocsDiscovery,
  parseDocsSitemap,
  verifyDocsRobots,
  verifyLiveDocsDiscovery,
} from './docs-sitemap-smoke.mjs';

const routes = [
  '/',
  '/react/',
  '/react-native/',
  '/start/getting-started',
  '/react/checkbox',
  '/react/dropdown',
];
const robots = `User-agent: *\nAllow: /\n\nSitemap: ${DOCS_ORIGIN}/sitemap.xml\n`;
const xml = (paths = routes) =>
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths
    .map((path) => `<url><loc>${DOCS_ORIGIN}${path}</loc></url>`)
    .join('')}</urlset>`;

async function setupDist(t) {
  const root = await mkdtemp(join(tmpdir(), 'vellira-docs-discovery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const distDir = join(root, 'dist');
  const redirectFile = join(root, '_redirects');
  await mkdir(distDir);
  await writeFile(join(distDir, 'sitemap.xml'), xml());
  await writeFile(join(distDir, 'robots.txt'), robots);
  await writeFile(redirectFile, '/getting-started /start/getting-started 301\n');
  for (const path of routes) {
    const html = path.endsWith('/') ? `${path.slice(1)}index.html` : `${path.slice(1)}.html`;
    const target = join(distDir, html);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `<html><head><link rel="canonical" href="${DOCS_ORIGIN}${path}"></head></html>`);
  }
  return { distDir, redirectFile };
}

function mockFetch({ sitemap = xml(), robotsText = robots, sitemapStatus = 200 } = {}) {
  return async (input, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.cache, 'no-store');
    const { pathname } = new URL(input);
    if (pathname === '/sitemap.xml') return new Response(sitemap, { status: sitemapStatus });
    if (pathname === '/robots.txt') return new Response(robotsText);
    throw new Error('Unexpected URL ' + pathname);
  };
}

test('parses valid canonical sitemap, including required docs routes', () => {
  const urls = parseDocsSitemap(xml(), { requiredRoutes: routes });
  assert.equal(urls.length, routes.length);
  assert.deepEqual(urls, [...urls].sort());
  verifyDocsRobots(robots);
});

test('rejects foreign, noncanonical, duplicate and legacy sitemap entries', () => {
  for (const bad of [
    `${DOCS_ORIGIN}/react/checkbox.html`,
    `${DOCS_ORIGIN}/react/checkbox?utm_source=test`,
    'https://attacker.example/react/checkbox',
    `${DOCS_ORIGIN}/getting-started`,
  ]) {
    const value = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${bad.replaceAll('&', '&amp;')}</loc></url></urlset>`;
    assert.throws(
      () => parseDocsSitemap(value, { redirectSources: new Set(['/getting-started']) }),
      /Noncanonical documentation sitemap URL/
    );
  }
  assert.throws(() => parseDocsSitemap(xml(['/react/checkbox', '/react/checkbox'])), /Duplicate sitemap URL/);
  assert.throws(() => parseDocsSitemap(xml(['/'] ), { requiredRoutes: ['/react/'] }), /Missing required/);
  assert.throws(() => parseDocsSitemap('<html>not a sitemap</html>'), /urlset/);
});

test('robots.txt must point to the docs sitemap, not another site', () => {
  assert.throws(() => verifyDocsRobots('User-agent: *\nDisallow: /\nSitemap: https://docs.vellira.dev/sitemap.xml'), /crawled/);
  assert.throws(() => verifyDocsRobots('User-agent: *\nAllow: /\nSitemap: https://vellira.dev/sitemap.xml'), /canonical sitemap/);
  assert.throws(() => verifyDocsRobots(robots + '\nSitemap: https://docs.vellira.dev/sitemap.xml\n'), /exactly/);
});

test('build proof requires real HTML output and one matching canonical per sitemap URL', async (t) => {
  const fixture = await setupDist(t);
  const report = await inspectBuiltDocsDiscovery(fixture);
  assert.equal(report.urlCount, routes.length);
  assert.equal(report.redirectSources.has('/getting-started'), true);

  const path = join(fixture.distDir, 'react', 'checkbox.html');
  await writeFile(path, '<html><link rel="canonical" href="https://vellira.dev/components/checkbox"></html>');
  await assert.rejects(inspectBuiltDocsDiscovery(fixture), /Missing or conflicting canonical/);
  await rm(path);
  await assert.rejects(inspectBuiltDocsDiscovery(fixture), /ENOENT/);
});

test('live proof compares the actual published sitemap and robots with the built URLs', async (t) => {
  const fixture = await setupDist(t);
  const expected = await inspectBuiltDocsDiscovery(fixture);
  const result = await inspectLiveDocsDiscovery(expected, { fetchImpl: mockFetch() });
  assert.equal(result.urlCount, routes.length);

  await assert.rejects(
    inspectLiveDocsDiscovery(expected, {
      fetchImpl: mockFetch({ sitemap: xml(routes.slice(0, -1)) }),
    }),
    /sitemap differs from build/
  );
  await assert.rejects(
    inspectLiveDocsDiscovery(expected, {
      fetchImpl: mockFetch({ sitemapStatus: 404 }),
    }),
    /HTTP 200/
  );
  await assert.rejects(
    inspectLiveDocsDiscovery(expected, {
      fetchImpl: mockFetch({ robotsText: 'User-agent: *\nDisallow: /' }),
    }),
    /canonical sitemap/
  );
});

test('retries only bounded Cloudflare propagation failures', async (t) => {
  const fixture = await setupDist(t);
  const expected = await inspectBuiltDocsDiscovery(fixture);
  let sitemapReads = 0;
  let sleeps = 0;
  const fetchImpl = async (input, opts) => {
    if (new URL(input).pathname === '/sitemap.xml') {
      sitemapReads += 1;
      return new Response(sitemapReads === 1 ? xml(routes.slice(0, -1)) : xml());
    }
    return mockFetch()(input, opts);
  };
  const report = await verifyLiveDocsDiscovery(expected, {
    fetchImpl,
    sleep: async () => { sleeps += 1; },
    attempts: 3,
  });
  assert.equal(report.urlCount, routes.length);
  assert.equal(sitemapReads, 2);
  assert.equal(sleeps, 1);
  await assert.rejects(
    verifyLiveDocsDiscovery(expected, {
      fetchImpl: mockFetch({ sitemap: xml(routes.slice(0, -1)) }),
      sleep: async () => {},
      attempts: 2,
    }),
    /proof failed/
  );
});
