import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOCS_ORIGIN = 'https://docs.vellira.dev';
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const DOCS_DIST = join(REPO_ROOT, 'apps/docs/src/.vitepress/dist');
const REQUIRED_ROUTES = [
  '/',
  '/react/',
  '/react-native/',
  '/start/getting-started',
  '/react/checkbox',
  '/react/dropdown',
  '/react/radio',
  '/react-native/radio',
];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function parseDocsSitemap(
  xml,
  { origin = DOCS_ORIGIN, redirectSources = new Set(), requiredRoutes = [] } = {}
) {
  requireCondition(
    /<urlset\b[^>]*\bxmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["'][^>]*>/.test(
      xml
    ) && /<\/urlset>\s*$/.test(xml),
    'Documentation sitemap must be a valid sitemap urlset'
  );

  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)];
  const openingTags = [...xml.matchAll(/<url>/g)];
  requireCondition(
    entries.length > 0 && entries.length === openingTags.length,
    'Documentation sitemap has malformed url entries'
  );

  const urls = new Set();
  for (const [, body] of entries) {
    const locations = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)];
    requireCondition(locations.length === 1, 'Documentation sitemap must have exactly one loc per url');
    const encoded = locations[0][1];
    const raw = encoded.replaceAll('&amp;', '&');
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error('Invalid documentation sitemap URL: ' + raw);
    }
    requireCondition(
      parsed.origin === origin &&
        parsed.protocol === 'https:' &&
        parsed.href === raw &&
        !parsed.search &&
        !parsed.hash &&
        /^\/(?:[a-z0-9-]+\/)*[a-z0-9-]*\/?$/.test(parsed.pathname) &&
        !parsed.pathname.endsWith('/index') &&
        !redirectSources.has(parsed.pathname),
      'Noncanonical documentation sitemap URL: ' + raw
    );
    requireCondition(!urls.has(parsed.href), 'Duplicate sitemap URL: ' + raw);
    urls.add(parsed.href);
  }

  for (const path of requiredRoutes) {
    requireCondition(
      urls.has(new URL(path, origin).href),
      'Missing required documentation sitemap URL: ' + path
    );
  }
  return [...urls].sort();
}

export function verifyDocsRobots(text, { origin = DOCS_ORIGIN } = {}) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const sitemaps = lines
    .filter((line) => /^sitemap\s*:/i.test(line))
    .map((line) => line.replace(/^sitemap\s*:\s*/i, ''));
  requireCondition(
    sitemaps.length === 1 && sitemaps[0] === new URL('/sitemap.xml', origin).href,
    'Documentation robots.txt must declare exactly the canonical sitemap'
  );
  requireCondition(
    lines.some((line) => /^user-agent:\s*\*$/i.test(line)) &&
      !lines.some((line) => /^disallow:\s*\/$/i.test(line)),
    'Documentation robots.txt must allow the site to be crawled'
  );
}

function outputHtmlPath(distDir, pageUrl) {
  const path = new URL(pageUrl).pathname;
  const htmlPath = path.endsWith('/') ? path.slice(1) + 'index.html' : path.slice(1) + '.html';
  return join(distDir, htmlPath);
}

export async function inspectBuiltDocsDiscovery({
  distDir = DOCS_DIST,
  readFileImpl = readFile,
  origin = DOCS_ORIGIN,
  requiredRoutes = REQUIRED_ROUTES,
  redirectFile = join(REPO_ROOT, 'apps/docs/src/public/_redirects'),
} = {}) {
  const [sitemap, robots, redirects] = await Promise.all([
    readFileImpl(join(distDir, 'sitemap.xml'), 'utf8'),
    readFileImpl(join(distDir, 'robots.txt'), 'utf8'),
    readFileImpl(redirectFile, 'utf8'),
  ]);
  const redirectSources = new Set(
    redirects
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split(/\s+/)[0])
  );
  verifyDocsRobots(robots, { origin });
  const urls = parseDocsSitemap(sitemap, {
    origin,
    redirectSources,
    requiredRoutes,
  });

  // Every loc must have its actual static HTML output, with a self-canonical URL.
  // This proves sitemap discoverability without requiring a browser or network.
  for (const url of urls) {
    const html = await readFileImpl(outputHtmlPath(distDir, url), 'utf8');
    const canonicals = [...html.matchAll(/<link\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => /\brel=["']canonical["']/.test(tag));
    requireCondition(
      canonicals.length === 1 &&
        canonicals[0].includes(`href="${url}"`),
      'Missing or conflicting canonical in documentation HTML: ' + url
    );
  }
  return { urls, urlCount: urls.length, redirectSources, sitemap };
}

async function fetchPublicText(path, { origin, fetchImpl }) {
  const response = await fetchImpl(new URL(path, origin), {
    method: 'GET',
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  requireCondition(response.status === 200, `${path} must return HTTP 200, got ${response.status}`);
  return response.text();
}

export async function inspectLiveDocsDiscovery(expected, {
  origin = DOCS_ORIGIN,
  fetchImpl = fetch,
} = {}) {
  const [xml, robots] = await Promise.all([
    fetchPublicText('/sitemap.xml', { origin, fetchImpl }),
    fetchPublicText('/robots.txt', { origin, fetchImpl }),
  ]);
  verifyDocsRobots(robots, { origin });
  const urls = parseDocsSitemap(xml, {
    origin,
    redirectSources: expected.redirectSources,
  });
  const missing = expected.urls.filter((url) => !urls.includes(url));
  const extra = urls.filter((url) => !expected.urls.includes(url));
  requireCondition(
    missing.length === 0 && extra.length === 0,
    `Published documentation sitemap differs from build (missing: ${missing.slice(0, 5).join(', ') || 'none'}; extra: ${extra.slice(0, 5).join(', ') || 'none'})`
  );
  requireCondition(
    xml === expected.sitemap,
    'Published documentation sitemap contents differ from build'
  );
  return { urlCount: urls.length };
}

export async function verifyLiveDocsDiscovery(expected, {
  attempts = 3,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
  ...options
} = {}) {
  requireCondition(Number.isInteger(attempts) && attempts >= 1 && attempts <= 5, 'attempts must be between 1 and 5');
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await inspectLiveDocsDiscovery(expected, options);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(2500);
    }
  }
  throw new Error('Published docs sitemap proof failed: ' + String(lastError));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const mode = process.argv[2];
    requireCondition(['--artifact', '--live'].includes(mode) && process.argv.length === 3, 'Usage: node scripts/seo/docs-sitemap-smoke.mjs --artifact|--live');
    const built = await inspectBuiltDocsDiscovery();
    if (mode === '--live') {
      await verifyLiveDocsDiscovery(built);
    }
    console.log(
      `${mode === '--live' ? 'Published' : 'Built'} documentation discovery proof GREEN: ` +
      built.urlCount + ' canonical sitemap routes; robots.txt and HTML verified'
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
