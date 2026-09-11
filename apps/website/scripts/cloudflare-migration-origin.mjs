import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import {
  createWebsiteWorker,
  isRscRequest,
} from '../cloudflare/cache-policy.mjs';
import {
  archiveAssets,
  assetInventory,
} from './cloudflare-static-asset-archive.mjs';
import {
  verifyNextPatch,
  verifyShippedTransport,
} from './next-rsc-patch-check.mjs';

const require = createRequire(import.meta.url);
const nextCli = require.resolve('next/dist/bin/next');
const repository = path.resolve(import.meta.dirname, '../../..');
const fixture = path.join(import.meta.dirname, 'fixtures/migration');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function respondMigrationError(outgoing, error) {
  console.error('Migration origin request failed:', error);
  outgoing.writeHead(500, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  outgoing.end('Internal Server Error');
}

async function replaceFixture(directory, generation, color) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await replaceFixture(filename, generation, color);
    else
      await fs.writeFile(
        filename,
        (await fs.readFile(filename, 'utf8'))
          .replaceAll('__GENERATION__', generation)
          .replaceAll('__COLOR__', color)
      );
  }
}

export async function buildGenerations(directory) {
  verifyNextPatch();
  // Disposable source copies belong outside the maintained repository tree,
  // not in test-results where source-hygiene scanners can mistake them for UI.
  const buildsDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'vellira-migration-builds-')
  );
  const generations = {};
  for (const [generation, color] of [
    ['A', '#f1f2f3'],
    ['B', '#e1e2e3'],
    ['C', '#d1d2d3'],
  ]) {
    const root = await fs.mkdtemp(
      path.join(buildsDirectory, `build-${generation}-`)
    );
    await fs.cp(fixture, root, { recursive: true });
    await replaceFixture(root, generation, color);
    await fs
      .symlink(
        path.join(repository, 'node_modules'),
        path.join(root, 'node_modules'),
        'dir'
      )
      .catch((error) => {
        if (error.code !== 'EEXIST') throw error;
      });
    const buildId = `migration-${generation}`;
    // Always rebuild on a test run: previous outputs are not exact-head proof.
    const log = await fs.open(
      path.join(directory, `build-${generation}.log`),
      'w'
    );
    try {
      const child = spawn(process.execPath, [nextCli, 'build', '--webpack'], {
        cwd: root,
        env: {
          ...process.env,
          VELLIRA_BUILD_ID: buildId,
          NEXT_TELEMETRY_DISABLED: '1',
        },
        stdio: ['ignore', log.fd, log.fd],
      });
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', resolve);
      });
      assert.equal(
        code,
        0,
        `Build ${generation} failed; see build-${generation}.log`
      );
    } finally {
      await log.close();
    }
    generations[generation] = {
      root,
      buildId,
      browserChunks: verifyShippedTransport(root),
      assets: await assetInventory(path.join(root, '.next/static')),
    };
    console.log(
      `Migration fixture ${generation} built and patched bootstrap verified`
    );
  }
  for (const extension of ['.js', '.css']) {
    for (const [left, right] of [
      ['A', 'B'],
      ['B', 'C'],
    ]) {
      assert.ok(
        generations[left].assets.some(
          (asset) =>
            asset.pathname.endsWith(extension) &&
            !generations[right].assets.some(
              (candidate) => candidate.pathname === asset.pathname
            )
        ),
        `${left}/${right} must have materially distinct ${extension} assets`
      );
    }
  }
  return generations;
}

// Real HTTP origin. No Playwright routing, Service Worker, or browser cache
// emulation. Next servers switch behind one listener, using the production
// response/archive policy and an actual local R2 runtime.
export async function startMigrationOrigin(generations, directory) {
  const children = [];
  const logs = [];
  const requests = [];
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      compatibilityDate: '2026-09-06',
      r2Buckets: ['ARCHIVE'],
    })
  );
  const archive = await mf.getR2Bucket('ARCHIVE');
  const state = { generation: 'A', poison: false, archiveEnabled: true };
  const upstreams = {};
  for (const [generation, build] of Object.entries(generations)) {
    const reservation = http.createServer();
    await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    const log = await fs.open(
      path.join(directory, `server-${generation}.log`),
      'w'
    );
    logs.push(log);
    const child = spawn(
      process.execPath,
      [nextCli, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
      { cwd: build.root, stdio: ['ignore', log.fd, log.fd] }
    );
    children.push(child);
    upstreams[generation] = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      if (child.exitCode !== null) throw new Error(`Next ${generation} exited`);
      try {
        ready = (await fetch(upstreams[generation])).ok;
      } catch {
        /* waiting for listener */
      }
      if (ready) break;
      await pause(100);
    }
    assert.ok(ready, `Next ${generation} did not start`);
  }
  const server = http.createServer(async (incoming, outgoing) => {
    try {
      const request = new Request(
        `http://${incoming.headers.host}${incoming.url}`,
        {
          method: incoming.method,
          headers: incoming.headers,
        }
      );
      const generation = state.generation;
      const url = new URL(request.url);
      const handler = {
        fetch: async (req) => {
          if (url.pathname === '/api/cookie-probe')
            return new Response(request.headers.get('cookie') ?? '', {
              headers: {
                'Cache-Control': 'no-store',
                'Set-Cookie': 'vellira_probe=1; Path=/; HttpOnly; SameSite=Lax',
              },
            });
          if (url.pathname === '/api/cache-contract')
            return new Response('api', {
              headers: { 'Cache-Control': 'private, max-age=120' },
            });
          if (url.pathname === '/outside')
            return new Response(
              '<!doctype html><title>Outside Next</title><a href="/">Return</a>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          if (url.pathname === '/favicon.ico')
            return new Response(null, { status: 204 });
          const headers = new Headers(req.headers);
          headers.delete('host');
          headers.set('accept-encoding', 'identity');
          const response = await fetch(
            `${upstreams[generation]}${url.pathname}${url.search}`,
            { headers, redirect: 'manual' }
          );
          const clean = new Headers(response.headers);
          clean.delete('content-encoding');
          clean.delete('content-length');
          return new Response(response.body, {
            status: response.status,
            headers: clean,
          });
        },
      };
      const worker = createWebsiteWorker(
        handler,
        generations[generation].buildId,
        () => {}
      );
      let response = await worker.fetch(
        request,
        {
          CF_VERSION_METADATA: { id: `version-${generation}` },
          ASSETS: {
            fetch: async () => {
              const asset = generations[generation].assets.find(
                (item) => item.pathname === decodeURIComponent(url.pathname)
              );
              return asset
                ? new Response(await fs.readFile(asset.filename), {
                    headers: {
                      'Content-Type': asset.contentType,
                      'Cache-Control': 'public, max-age=31536000, immutable',
                      'X-Vellira-Asset-Source': 'current',
                    },
                  })
                : new Response(null, { status: 404 });
            },
          },
          STATIC_ASSET_ARCHIVE: state.archiveEnabled
            ? archive
            : { get: async () => null, head: async () => null },
        },
        {}
      );
      // Explicit legacy-cache fixture: cache a real A Flight payload, never a
      // mocked JSON stand-in. Only the primary poison test enables this mode.
      if (state.poison && isRscRequest(request)) {
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'public, max-age=86400, immutable');
        response = new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      requests.push({
        at: Date.now(),
        generation,
        url: url.pathname + url.search,
        rsc: isRscRequest(request),
        requestHeaders: Object.fromEntries(request.headers),
        status: response.status,
        responseHeaders: Object.fromEntries(response.headers),
      });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (request.method === 'HEAD' || !response.body) outgoing.end();
      else Readable.fromWeb(response.body).pipe(outgoing);
    } catch (error) {
      respondMigrationError(outgoing, error);
    }
  });
  await archiveAssets(archive, generations.A.assets);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    state,
    async activate(generation) {
      // The same ordering as real deployment: verify archive before activation.
      await archiveAssets(archive, generations[generation].assets);
      state.generation = generation;
    },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      for (const child of children) child.kill('SIGTERM');
      await Promise.all(
        children.map((child) =>
          child.exitCode !== null
            ? null
            : new Promise((resolve) => child.once('exit', resolve))
        )
      );
      await Promise.all(logs.map((log) => log.close()));
      await mf.dispose();
    },
  };
}
