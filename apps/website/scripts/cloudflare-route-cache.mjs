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

function assertRouteCacheInventory(root, directory, { buildId, entries }) {
  let ancestor = root;
  for (const part of directory.split('/')) {
    ancestor = path.join(ancestor, part);
    assert.ok(
      fs.lstatSync(ancestor).isDirectory(),
      `Unsafe cache directory (including symlink): ${ancestor}`
    );
  }
  const actual = [];
  const pending = [''];
  while (pending.length) {
    const relative = pending.pop();
    for (const name of fs.readdirSync(path.join(root, directory, relative))) {
      assert.ok(
        !name.includes('\\') &&
          [...name].every((character) => {
            const code = character.charCodeAt(0);
            return code > 31 && code !== 127;
          }),
        `Unsafe cache path: ${JSON.stringify(name)}`
      );
      const entry = relative ? `${relative}/${name}` : name;
      const stat = fs.lstatSync(path.join(root, directory, entry));
      assert.ok(
        stat.isDirectory() || stat.isFile(),
        `Unsafe cache entry (including symlink): ${directory}/${entry}`
      );
      if (stat.isDirectory()) pending.push(entry);
      // AWS createCacheAssets puts response .cache files under <buildId> and
      // fetch data under __fetch/<buildId>. Fetch keys may also end in .cache.
      // Inspect all response namespaces, including stale builds, without a
      // depth limit. Other regular artifacts are not response-cache entries.
      else if (!entry.startsWith('__fetch/') && entry.endsWith('.cache'))
        actual.push(entry);
    }
  }
  const expected = new Set(entries.map(({ key }) => `${buildId}${key}.cache`));
  assert.equal(expected.size, entries.length, 'Duplicate route cache keys');
  const actualSet = new Set(actual);
  const missing = [...expected].filter((entry) => !actualSet.has(entry)).sort();
  const unexpected = actual.filter((entry) => !expected.has(entry)).sort();
  assert.ok(
    !missing.length && !unexpected.length,
    `${directory}: route cache inventory mismatch; missing=${JSON.stringify(missing)}; unexpected=${JSON.stringify(unexpected)}`
  );
}

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
  const expected = [];
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
    expected.push({ pathname, owner, key });
  }
  assert.ok(expected.length, 'No prerender route cache entries');
  assertRouteCacheInventory(root, '.open-next/cache', {
    buildId,
    entries: expected,
  });
  const entries = [];
  for (const { pathname, owner, key } of expected) {
    const target = path.join(cacheRoot, `${key}.cache`);
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
  const evidence = { buildId, entries };
  const evidencePath = path.join(root, '.open-next/route-cache-evidence.json');
  if (fs.existsSync(evidencePath)) {
    assert.ok(
      fs.lstatSync(evidencePath).isFile(),
      'Unsafe route cache evidence'
    );
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

// Only call after populateCache: the upstream static-assets publisher copies
// the whole cache tree and does not remove stale destination entries.
export function verifyPublishedRouteCache(root) {
  const evidencePath = path.join(root, '.open-next/route-cache-evidence.json');
  assert.ok(fs.lstatSync(evidencePath).isFile(), 'Unsafe route cache evidence');
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  // Require the original evidence before revalidating generation. Publication
  // cannot establish a new digest baseline or silently replace existing proof.
  assert.deepEqual(prepareRouteCache(root), evidence);
  const directory = '.open-next/assets/cdn-cgi/_next_cache';
  assertRouteCacheInventory(root, directory, evidence);
  for (const entry of evidence.entries) {
    const relative = `${evidence.buildId}${entry.key}.cache`;
    const bytes = fs.readFileSync(path.join(root, directory, relative));
    assert.equal(
      bytes.length,
      entry.bytes,
      `Published cache size mismatch: ${relative}`
    );
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      entry.sha256,
      `Published cache SHA-256 mismatch: ${relative}`
    );
  }
  return evidence;
}
