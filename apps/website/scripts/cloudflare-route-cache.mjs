import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { isBinaryContentType } from '@opennextjs/aws/utils/binary.js';

const require = createRequire(import.meta.url);
const {
  getRouteCacheKey,
  isRouteCacheOwner,
} = require('next/dist/server/lib/route-cache-key.js');
const {
  normalizePagePath,
} = require('next/dist/shared/lib/page-path/normalize-page-path.js');

// OpenNext Cloudflare 1.20.12 (AWS 4.1.11) already emits Next's owner keys.
// Validate those artifacts before populateCache copies them into private static
// assets. Never manufacture pathname aliases or repair a missing owner entry.
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
    const target = path.join(cacheRoot, `${key}.cache`);
    assert.ok(
      target.startsWith(`${cacheRoot}${path.sep}`),
      'Route cache path escaped build namespace'
    );
    const bytes = fs.readFileSync(target);
    const value = JSON.parse(bytes);
    assert.equal(
      value.type,
      owner.kind === 'APP_ROUTE' ? 'route' : 'app',
      `Cache kind mismatch: ${pathname}`
    );
    assert.deepEqual(
      value.meta?.routeCache,
      { key, owner, isFallback: false },
      `Cache owner metadata mismatch: ${pathname}`
    );
    // Verify the payload against this build's actual Next prerender output,
    // including response headers, status and Flight segments. A valid key alone
    // cannot prove that its contents belong to the selected route.
    const sourceRoot = path.resolve(root, '.next/server/app');
    const source = path.join(sourceRoot, normalizePagePath(pathname));
    assert.ok(source.startsWith(`${sourceRoot}${path.sep}`));
    const meta = JSON.parse(fs.readFileSync(`${source}.meta`, 'utf8'));
    assert.deepEqual(value.meta, meta, `Cache metadata mismatch: ${pathname}`);
    if (owner.kind === 'APP_ROUTE') {
      assert.equal(
        typeof value.body,
        'string',
        `Missing route body: ${pathname}`
      );
      assert.deepEqual(
        Buffer.from(
          value.body,
          isBinaryContentType(meta.headers['content-type']) ? 'base64' : 'utf8'
        ),
        fs.readFileSync(`${source}.body`),
        `Cache body mismatch: ${pathname}`
      );
    } else {
      for (const field of ['html', 'rsc']) {
        assert.equal(
          value[field],
          fs.readFileSync(`${source}.${field}`, 'utf8'),
          `Cache ${field} mismatch: ${pathname}`
        );
      }
      const segments = Object.fromEntries(
        (meta.segmentPaths ?? []).map((segment) => {
          const directory = `${source}.segments`;
          const file = path.join(directory, `${segment}.segment.rsc`);
          assert.ok(
            file.startsWith(`${directory}${path.sep}`),
            'Segment path escaped route'
          );
          return [segment, fs.readFileSync(file, 'utf8')];
        })
      );
      assert.deepEqual(
        value.segmentData,
        Object.keys(segments).length ? segments : undefined,
        `Cache segments mismatch: ${pathname}`
      );
    }
    entries.push({
      pathname,
      owner,
      key,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  assert.ok(entries.length, 'No prerender route cache entries');
  const evidence = { buildId, entries };
  const evidencePath = path.join(root, '.open-next/route-cache-evidence.json');
  if (fs.existsSync(evidencePath)) {
    assert.deepEqual(
      read('.open-next/route-cache-evidence.json'),
      evidence,
      'Conflicting route cache evidence'
    );
  } else {
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), {
      flag: 'wx',
    });
  }
  return evidence;
}
