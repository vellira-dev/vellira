/* global Response, URL, Headers, crypto, console */
export const RSC_CACHE_CONTROL =
  'private, no-cache, no-store, max-age=0, must-revalidate';
export const HTML_CACHE_CONTROL = 'no-cache, max-age=0, must-revalidate';
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export function isRscRequest(request) {
  return (
    request.headers.get('rsc') === '1' ||
    request.headers.has('next-router-prefetch') ||
    request.headers.has('next-router-segment-prefetch')
  );
}

// Next's encoded [slug] paths and the archive inventory share decoded keys.
// Never allow traversal or malformed encodings to escape the static namespace.
export function staticAssetKey(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (
    !decoded.startsWith('/_next/static/') ||
    decoded.includes('\\') ||
    [...decoded].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  )
    return null;
  if (
    decoded
      .split('/')
      .slice(1)
      .some((part) => !part || part === '.' || part === '..')
  )
    return null;
  return `assets${decoded}`;
}

function responseWithHeaders(response, headers) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function applyCachePolicy(request, response) {
  const pathname = new URL(request.url).pathname;
  const type = response.headers.get('content-type') ?? '';
  const rsc = isRscRequest(request) || type.startsWith('text/x-component');
  const document =
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/_next/') &&
    (type.startsWith('text/html') ||
      request.headers.get('sec-fetch-dest') === 'document' ||
      (['GET', 'HEAD'].includes(request.method) &&
        request.headers.get('accept')?.includes('text/html')));
  if (!rsc && !document) return response;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', rsc ? RSC_CACHE_CONTROL : HTML_CACHE_CONTROL);
  // Prerendered data stays in OpenNext. Shared HTTP route caches must not
  // outlive the active deployment, including responses to bots and HEADs.
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.delete('Age');
  return responseWithHeaders(response, headers);
}

export async function archivedAsset(request, bucket) {
  if (!['GET', 'HEAD'].includes(request.method)) return null;
  const key = staticAssetKey(new URL(request.url).pathname);
  if (!key) return null;
  if (!bucket) throw new Error('Missing STATIC_ASSET_ARCHIVE binding');
  const object =
    request.method === 'HEAD' ? await bucket.head(key) : await bucket.get(key);
  if (!object) return null;
  if (!object.customMetadata?.sha256 || !object.httpMetadata?.contentType) {
    throw new Error(`Invalid archived asset metadata: ${key}`);
  }
  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata.contentType);
  headers.set('Cache-Control', IMMUTABLE_CACHE_CONTROL);
  headers.set('ETag', object.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Vellira-Asset-SHA256', object.customMetadata.sha256);
  headers.set('X-Vellira-Asset-Source', 'archive');
  headers.set('Content-Length', String(object.size));
  const matches = (request.headers.get('if-none-match') ?? '')
    .split(',')
    .some(
      (value) =>
        value.trim() === '*' ||
        value.trim().replace(/^W\//, '') === object.httpEtag
    );
  if (matches) {
    await object.body?.cancel();
    headers.delete('Content-Length');
    return new Response(null, { status: 304, headers });
  }
  // Returning the full representation for Range is valid HTTP. Do not forward
  // a partial object with a full-object Content-Length or incorrect ETag.
  return new Response(request.method === 'HEAD' ? null : object.body, {
    headers,
  });
}

export function createWebsiteWorker(
  handler,
  buildId,
  log = (event) => console.log(JSON.stringify(event))
) {
  if (!buildId || /^local(?:-|$)/.test(buildId))
    throw new Error('Missing deployment build identity');
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const requestId = crypto.randomUUID();
      let response;
      if (
        url.pathname === '/__vellira_runtime' &&
        ['GET', 'HEAD'].includes(request.method)
      ) {
        response = new Response(
          request.method === 'HEAD'
            ? null
            : JSON.stringify({
                buildId,
                workerVersion: env.CF_VERSION_METADATA?.id ?? null,
                requestId,
              }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': RSC_CACHE_CONTROL,
            },
          }
        );
      } else if (
        url.pathname.startsWith('/_next/static/') &&
        ['GET', 'HEAD'].includes(request.method)
      ) {
        response = await env.ASSETS.fetch(request);
        if (response.status === 404) {
          await response.body?.cancel();
          response =
            (await archivedAsset(request, env.STATIC_ASSET_ARCHIVE)) ??
            new Response('Asset not found', {
              status: 404,
              headers: { 'Cache-Control': 'no-store' },
            });
        }
      } else {
        response = applyCachePolicy(
          request,
          await handler.fetch(request, env, ctx)
        );
      }
      const headers = new Headers(response.headers);
      headers.set('X-Vellira-Build-Id', buildId);
      headers.set('X-Vellira-Request-Id', requestId);
      if (env.CF_VERSION_METADATA?.id)
        headers.set('X-Vellira-Worker-Version', env.CF_VERSION_METADATA.id);
      // The response ID alone can be cached. Correlate it with this server log;
      // neither a cached cf-ray nor this header alone proves a network request.
      log({
        event: 'website-response',
        requestId,
        buildId,
        workerVersion: env.CF_VERSION_METADATA?.id ?? null,
        path: url.pathname,
        method: request.method,
        status: response.status,
        rsc: isRscRequest(request),
        cacheControl: headers.get('cache-control'),
        assetSource: headers.get('x-vellira-asset-source'),
      });
      return responseWithHeaders(response, headers);
    },
  };
}
