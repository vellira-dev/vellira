import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  getRouteCacheKey,
  isRouteCacheOwner,
} = require('next/dist/server/lib/route-cache-key.js');
const {
  normalizePagePath,
} = require('next/dist/shared/lib/page-path/normalize-page-path.js');

// OpenNext 1.20 emits pathname cache entries. Next 16.3 reads owner-scoped
// keys. Materialize the pinned Next key; never strip its ownership boundary at
// runtime or let another source route read a matching pathname's cache entry.
export function prepareRouteCache(root) {
  const read = (name) =>
    JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  const buildId = fs
    .readFileSync(path.join(root, '.next/BUILD_ID'), 'utf8')
    .trim();
  assert.match(buildId, /^[a-zA-Z0-9_-]+$/, 'Invalid route cache build ID');
  const prerender = read('.next/prerender-manifest.json');
  const appPaths = read('.next/app-path-routes-manifest.json');
  const cacheRoot = path.join(root, '.open-next/cache', buildId);
  const entries = [];
  for (const [pathname, route] of Object.entries(prerender.routes)) {
    const owners = Object.keys(appPaths)
      .map((sourceRoute) => ({
        kind: sourceRoute.endsWith('/route') ? 'APP_ROUTE' : 'APP_PAGE',
        sourceRoute,
      }))
      .filter((owner) => isRouteCacheOwner(pathname, owner, route));
    assert.equal(
      owners.length,
      1,
      `Ambiguous or missing prerender owner: ${pathname}`
    );
    const owner = owners[0];
    const key = getRouteCacheKey(pathname, owner);
    const source = path.join(cacheRoot, `${normalizePagePath(pathname)}.cache`);
    const target = path.join(cacheRoot, `${key}.cache`);
    assert.ok(
      target.startsWith(`${cacheRoot}${path.sep}`),
      'Route cache path escaped build namespace'
    );
    const bytes = fs.readFileSync(source);
    const value = JSON.parse(bytes);
    assert.equal(
      value.type,
      owner.kind === 'APP_ROUTE' ? 'route' : 'app',
      `Cache kind mismatch: ${pathname}`
    );
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target))
      assert.deepEqual(
        fs.readFileSync(target),
        bytes,
        `Conflicting owner cache: ${key}`
      );
    else fs.writeFileSync(target, bytes);
    entries.push({ pathname, owner, key, bytes: bytes.length });
  }
  assert.ok(entries.length, 'No prerender route cache entries');
  const evidence = { buildId, entries };
  fs.writeFileSync(
    path.join(root, '.open-next/route-cache-evidence.json'),
    JSON.stringify(evidence, null, 2)
  );
  return evidence;
}
