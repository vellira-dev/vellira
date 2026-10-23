import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createCacheAssets } from '@opennextjs/aws/build/createAssets.js';
import { prepareRouteCache } from './cloudflare-route-cache.mjs';

const require = createRequire(import.meta.url);
const { getRouteCacheKey } = require('next/dist/server/lib/route-cache-key.js');
const {
  normalizePagePath,
} = require('next/dist/shared/lib/page-path/normalize-page-path.js');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-route-cache-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, data) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      typeof data === 'string' || Buffer.isBuffer(data)
        ? data
        : JSON.stringify(data)
    );
  };
  write('.next/BUILD_ID', 'build-1');
  write('.next/required-server-files.json', { config: {} });
  write('.next/standalone/.next/server/pages-manifest.json', {});
  const routes = [
    {
      pathname: '/',
      sourceRoute: '/(site)/page',
      kind: 'APP_PAGE',
      srcRoute: '/',
    },
    {
      pathname: '/blog/article',
      sourceRoute: '/(site)/blog/[slug]/page',
      kind: 'APP_PAGE',
      srcRoute: '/blog/[slug]',
    },
    {
      pathname: '/robots.txt',
      sourceRoute: '/robots.txt/route',
      kind: 'APP_ROUTE',
      srcRoute: '/robots.txt',
    },
    {
      pathname: '/icon.png',
      sourceRoute: '/icon.png/route',
      kind: 'APP_ROUTE',
      srcRoute: '/icon.png',
    },
  ].map(({ pathname, sourceRoute, kind, srcRoute }) => {
    const owner = { kind, sourceRoute };
    const key = getRouteCacheKey(pathname, owner);
    const original = normalizePagePath(pathname);
    const meta = {
      routeCache: { key, owner, isFallback: false },
      headers: {
        'content-type':
          kind === 'APP_PAGE'
            ? 'text/html'
            : pathname === '/icon.png'
              ? 'image/png'
              : 'text/plain',
      },
      status: 200,
    };
    if (kind === 'APP_PAGE') meta.segmentPaths = ['/_full'];
    write(`.next/server/app/${original}.meta`, meta);
    if (kind === 'APP_PAGE') {
      write(`.next/server/app/${original}.html`, `<h1>${pathname}</h1>`);
      write(`.next/server/app/${original}.rsc`, `flight:${pathname}`);
      write(
        `.next/server/app/${original}.segments/_full.segment.rsc`,
        `segment:${pathname}`
      );
    } else {
      write(
        `.next/server/app/${original}.body`,
        pathname === '/icon.png' ? Buffer.from([0, 255, 128, 42]) : 'robots'
      );
    }
    return {
      pathname,
      owner,
      key,
      original,
      srcRoute,
      cache: `.open-next/cache/build-1${key}.cache`,
    };
  });
  write('.next/prerender-manifest.json', {
    routes: Object.fromEntries(
      routes.map(({ pathname, owner, original, srcRoute }) => [
        pathname,
        {
          dataRoute: owner.kind === 'APP_ROUTE' ? null : `${original}.rsc`,
          srcRoute,
        },
      ])
    ),
  });
  write(
    '.next/app-path-routes-manifest.json',
    Object.fromEntries(
      routes.map(({ owner, srcRoute }) => [owner.sourceRoute, srcRoute])
    )
  );
  fs.cpSync(
    path.join(root, '.next/server/app'),
    path.join(root, '.next/standalone/.next/server/app'),
    { recursive: true }
  );
  // Exercise the installed generator and its real JSON format, not fabricated
  // pathname caches. This is the 1.20.6 -> 1.20.12 compatibility boundary.
  createCacheAssets({
    appBuildOutputPath: root,
    monorepoRoot: root,
    outputDir: path.join(root, '.open-next'),
    nextVersion: require('next/package.json').version,
    config: { dangerous: { disableTagCache: true } },
  });
  const read = (name) =>
    JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  return { root, write, read, routes };
}

test('validates actual OpenNext owner entries without rewriting bytes or creating pathname aliases', (t) => {
  const { root, routes } = fixture(t);
  const before = routes.map(({ cache }) =>
    fs.readFileSync(path.join(root, cache))
  );
  const result = prepareRouteCache(root);
  assert.equal(result.entries.length, routes.length);
  for (const [i, entry] of result.entries.entries()) {
    assert.equal(entry.key, getRouteCacheKey(entry.pathname, entry.owner));
    assert.deepEqual(
      fs.readFileSync(path.join(root, routes[i].cache)),
      before[i]
    );
    assert.equal(
      entry.sha256,
      createHash('sha256').update(before[i]).digest('hex')
    );
    assert.equal(
      fs.existsSync(
        path.join(
          root,
          '.open-next/cache/build-1',
          `${routes[i].original}.cache`
        )
      ),
      false
    );
    assert.ok(
      routes[i].cache.split('/').length > 7,
      'a depth-limited diagnostic misses valid entries'
    );
  }
  const evidence = fs.readFileSync(
    path.join(root, '.open-next/route-cache-evidence.json')
  );
  assert.deepEqual(
    prepareRouteCache(root),
    result,
    'preflight and deployment preparation are idempotent'
  );
  assert.deepEqual(
    fs.readFileSync(path.join(root, '.open-next/route-cache-evidence.json')),
    evidence
  );
  const wrongOwner = getRouteCacheKey('/blog/article', {
    kind: 'APP_PAGE',
    sourceRoute: '/(other)/blog/[slug]/page',
  });
  assert.equal(
    fs.existsSync(
      path.join(root, '.open-next/cache/build-1', `${wrongOwner}.cache`)
    ),
    false
  );
  assert.equal(
    fs.existsSync(path.join(root, '.open-next/cache/build-2')),
    false
  );
});

test('ambiguous or missing ownership cannot publish arbitrary namespaces', (t) => {
  const { root, write } = fixture(t);
  write('.next/app-path-routes-manifest.json', {
    '/(site)/page': '/',
    '/(other)/page': '/',
  });
  assert.throws(() => prepareRouteCache(root), /Ambiguous or missing/);
  write('.next/app-path-routes-manifest.json', {});
  assert.throws(() => prepareRouteCache(root), /Ambiguous or missing/);
  assert.equal(
    fs.existsSync(path.join(root, '.open-next/route-cache-evidence.json')),
    false
  );
});

test('missing or wrong-kind cache fails, even when a legacy pathname alias exists', (t) => {
  const { root, write, read, routes } = fixture(t);
  const cache = routes[0].cache;
  const value = read(cache);
  write(cache, { ...value, type: 'route' });
  assert.throws(() => prepareRouteCache(root), /Cache kind mismatch/);
  write('.open-next/cache/build-1/index.cache', value);
  fs.unlinkSync(path.join(root, cache));
  assert.throws(() => prepareRouteCache(root), /ENOENT/);
  assert.equal(
    fs.existsSync(path.join(root, cache)),
    false,
    'must not repair from a pathname alias'
  );
});

for (const mutation of ['owner', 'key', 'fallback', 'missing']) {
  test(`rejects ${mutation} metadata corruption at the correct cache path`, (t) => {
    const { root, write, read, routes } = fixture(t);
    const value = read(routes[0].cache);
    if (mutation === 'owner')
      value.meta.routeCache.owner.sourceRoute = '/(other)/page';
    if (mutation === 'key') value.meta.routeCache.key = '/index';
    if (mutation === 'fallback') value.meta.routeCache.isFallback = true;
    if (mutation === 'missing') delete value.meta.routeCache;
    write(routes[0].cache, value);
    assert.throws(
      () => prepareRouteCache(root),
      /Cache owner metadata mismatch/
    );
  });
}

for (const field of ['html', 'rsc', 'body', 'segments', 'metadata']) {
  test(`rejects ${field} drift from actual Next prerender output`, (t) => {
    const { root, write, read, routes } = fixture(t);
    const route = routes[field === 'body' ? 2 : 0];
    const value = read(route.cache);
    if (field === 'segments') value.segmentData['/_full'] = 'foreign';
    else if (field === 'metadata') value.meta.status = 404;
    else value[field] = 'foreign';
    write(route.cache, value);
    assert.throws(() => prepareRouteCache(root), /Cache .* mismatch/);
  });
}

test('missing Flight fails closed and cannot publish evidence', (t) => {
  const { root, write, read, routes } = fixture(t);
  const value = read(routes[0].cache);
  delete value.rsc;
  write(routes[0].cache, value);
  assert.throws(() => prepareRouteCache(root), /Cache rsc mismatch/);
  assert.equal(
    fs.existsSync(path.join(root, '.open-next/route-cache-evidence.json')),
    false
  );
});

test('conflicting generated owner entry and previous evidence are never overwritten', (t) => {
  const { root, write, read, routes } = fixture(t);
  prepareRouteCache(root);
  const evidence = fs.readFileSync(
    path.join(root, '.open-next/route-cache-evidence.json')
  );
  const value = read(routes[0].cache);
  write(routes[0].cache, { ...value, html: 'foreign' });
  assert.throws(() => prepareRouteCache(root), /Cache html mismatch/);
  assert.equal(read(routes[0].cache).html, 'foreign');
  assert.deepEqual(
    fs.readFileSync(path.join(root, '.open-next/route-cache-evidence.json')),
    evidence
  );
  // Semantically identical JSON must not silently replace byte-level evidence.
  write(routes[0].cache, JSON.stringify(value, null, 2));
  assert.throws(
    () => prepareRouteCache(root),
    /Conflicting route cache evidence/
  );
  assert.deepEqual(
    fs.readFileSync(path.join(root, '.open-next/route-cache-evidence.json')),
    evidence
  );
});

test('another build namespace cannot satisfy a missing entry and unsafe IDs are rejected', (t) => {
  const { root, write } = fixture(t);
  write('.next/BUILD_ID', 'build-2');
  assert.throws(() => prepareRouteCache(root), /ENOENT/);
  write('.next/BUILD_ID', '../build-1');
  assert.throws(() => prepareRouteCache(root), /Invalid route cache build ID/);
});
