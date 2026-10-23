import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createCacheAssets } from '@opennextjs/aws/build/createAssets.js';
import {
  prepareRouteCache,
  verifyPublishedRouteCache,
} from './cloudflare-route-cache.mjs';

const { populateCache } = await import(
  new URL(
    '../cli/commands/populate-cache.js',
    import.meta.resolve('@opennextjs/cloudflare')
  )
);
async function publish(root) {
  await populateCache(
    { outputDir: path.join(root, '.open-next') },
    {
      default: {
        override: { incrementalCache: 'cf-static-assets-incremental-cache' },
      },
    },
    {},
    { target: 'local' },
    {}
  );
}
const publishedRoot = '.open-next/assets/cdn-cgi/_next_cache';

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
  // Legitimate fetch artifacts are copied by the same upstream generator and
  // publisher. A .cache suffix does not make them route-cache entries.
  write('.next/cache/fetch-cache/fetch-key.cache', { kind: 'FETCH', tags: [] });
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
  assert.throws(
    () => prepareRouteCache(root),
    /inventory mismatch; missing=\["build-1.*; unexpected=\["build-1\/index.cache"\]/
  );
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
  assert.throws(
    () => prepareRouteCache(root),
    /inventory mismatch; missing=\["build-2.*; unexpected=\["build-1/
  );
  write('.next/BUILD_ID', '../build-1');
  assert.throws(() => prepareRouteCache(root), /Invalid route cache build ID/);
});

test('complete generated and published inventories retain original SHA-256 evidence and fetch artifacts', async (t) => {
  const { root, routes } = fixture(t);
  const evidence = prepareRouteCache(root);
  const evidencePath = path.join(root, '.open-next/route-cache-evidence.json');
  const before = fs.readFileSync(evidencePath);
  assert.equal(fs.existsSync(path.join(root, publishedRoot)), false);
  await publish(root);
  assert.deepEqual(verifyPublishedRouteCache(root), evidence);
  for (const route of routes) {
    assert.deepEqual(
      fs.readFileSync(
        path.join(root, publishedRoot, `build-1${route.key}.cache`)
      ),
      fs.readFileSync(path.join(root, route.cache))
    );
  }
  assert.deepEqual(
    fs.readFileSync(
      path.join(root, publishedRoot, '__fetch/build-1/fetch-key.cache')
    ),
    fs.readFileSync(path.join(root, '.next/cache/fetch-cache/fetch-key.cache'))
  );
  assert.deepEqual(fs.readFileSync(evidencePath), before);
});

for (const mutation of [
  'foreign owner',
  'legacy alias',
  'wrong build',
  'missing',
]) {
  test(`generated inventory rejects ${mutation} without repairing payloads or evidence`, (t) => {
    const { root, write, routes } = fixture(t);
    prepareRouteCache(root);
    const evidencePath = path.join(
      root,
      '.open-next/route-cache-evidence.json'
    );
    const before = fs.readFileSync(evidencePath);
    const bytes = fs.readFileSync(path.join(root, routes[0].cache));
    let entry;
    if (mutation === 'foreign owner')
      entry = `build-1${getRouteCacheKey('/', { kind: 'APP_PAGE', sourceRoute: '/(foreign)/page' })}.cache`;
    if (mutation === 'legacy alias') entry = 'build-1/index.cache';
    if (mutation === 'wrong build') entry = `stale-build${routes[0].key}.cache`;
    if (mutation === 'missing') fs.unlinkSync(path.join(root, routes[0].cache));
    else write(`.open-next/cache/${entry}`, bytes);
    assert.throws(
      () => prepareRouteCache(root),
      (error) => {
        assert.match(error.message, /route cache inventory mismatch/);
        if (mutation === 'missing')
          assert.ok(
            error.message.includes(`missing=["build-1${routes[0].key}.cache"]`)
          );
        else assert.ok(error.message.includes(`unexpected=["${entry}"]`));
        return true;
      }
    );
    if (entry)
      assert.deepEqual(
        fs.readFileSync(path.join(root, '.open-next/cache', entry)),
        bytes
      );
    else assert.equal(fs.existsSync(path.join(root, routes[0].cache)), false);
    assert.deepEqual(fs.readFileSync(evidencePath), before);
  });
}

for (const mutation of ['extra', 'wrong build', 'missing', 'bytes']) {
  test(`published inventory rejects ${mutation} independently of valid generation`, async (t) => {
    const { root, write, routes } = fixture(t);
    const evidence = prepareRouteCache(root);
    const evidencePath = path.join(
      root,
      '.open-next/route-cache-evidence.json'
    );
    const before = fs.readFileSync(evidencePath);
    // Upstream cp merges its destination: an old alias must survive population
    // so our post-population validation, not the generator, detects it.
    if (mutation === 'extra')
      write(`${publishedRoot}/build-1/index.cache`, 'stale');
    if (mutation === 'wrong build')
      write(`${publishedRoot}/old-build/index.cache`, 'stale');
    await publish(root);
    const file = path.join(
      root,
      publishedRoot,
      `build-1${routes[0].key}.cache`
    );
    if (mutation === 'missing') fs.unlinkSync(file);
    if (mutation === 'bytes') {
      const bytes = fs.readFileSync(file);
      bytes[bytes.indexOf('flight:')] = 'F'.charCodeAt(0);
      fs.writeFileSync(file, bytes); // Same size, different SHA-256.
    }
    assert.throws(
      () => verifyPublishedRouteCache(root),
      mutation === 'bytes'
        ? /Published cache SHA-256 mismatch/
        : /route cache inventory mismatch/
    );
    assert.deepEqual(prepareRouteCache(root), evidence);
    assert.deepEqual(fs.readFileSync(evidencePath), before);
  });
}

for (const stage of ['generated', 'published']) {
  for (const name of ['back\\slash.cache', 'control\u001f.cache']) {
    test(`${stage} inventory rejects unsafe filename ${JSON.stringify(name)}`, async (t) => {
      const { root, write } = fixture(t);
      const directory =
        stage === 'generated' ? '.open-next/cache' : publishedRoot;
      if (stage === 'published') {
        prepareRouteCache(root);
        await publish(root);
      }
      write(`${directory}/build-1/${name}`, 'foreign');
      assert.throws(
        () =>
          stage === 'generated'
            ? prepareRouteCache(root)
            : verifyPublishedRouteCache(root),
        /Unsafe cache path/
      );
    });
  }
  for (const link of ['file', 'directory', 'namespace', 'fetch']) {
    test(`${stage} inventory rejects ${link} symlinks`, async (t) => {
      const { root, routes } = fixture(t);
      const directory =
        stage === 'generated' ? '.open-next/cache' : publishedRoot;
      if (stage === 'published') {
        prepareRouteCache(root);
        await publish(root);
      }
      const relative =
        link === 'file'
          ? `build-1${routes[0].key}.cache`
          : link === 'directory'
            ? 'build-1'
            : link === 'fetch'
              ? '__fetch'
              : '';
      const target = path.join(root, directory, relative);
      const saved = path.join(root, 'linked-cache');
      fs.renameSync(target, saved);
      fs.symlinkSync(saved, target);
      assert.throws(
        () =>
          stage === 'generated'
            ? prepareRouteCache(root)
            : verifyPublishedRouteCache(root),
        /Unsafe cache (entry|directory)/
      );
    });
  }
}

test('post-population validation cannot create missing evidence', async (t) => {
  const { root } = fixture(t);
  await publish(root);
  assert.throws(
    () => verifyPublishedRouteCache(root),
    /ENOENT.*route-cache-evidence/
  );
  assert.equal(
    fs.existsSync(path.join(root, '.open-next/route-cache-evidence.json')),
    false
  );
});
