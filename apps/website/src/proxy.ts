import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const RSC_CACHE_CONTROL =
  'private, no-cache, no-store, max-age=0, must-revalidate';
const RSC_CACHE_MIGRATION_COOKIE = '__Host-vellira-rsc-cache-v1';
const RSC_CACHE_MIGRATION_MAX_AGE = 60 * 60 * 24 * 365;

function isRscRequest(request: NextRequest) {
  return (
    request.headers.get('rsc') === '1' ||
    request.headers.has('next-router-prefetch') ||
    request.headers.has('next-router-segment-prefetch')
  );
}

function isDocumentRequest(request: NextRequest) {
  return (
    request.method === 'GET' &&
    request.headers.get('sec-fetch-dest') === 'document' &&
    !isRscRequest(request)
  );
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Next/App Router segment-prefetch responses contain build-specific JS/CSS
  // references. Persisting them in the browser HTTP cache lets an older
  // deployment survive a later deploy and point the current runtime at assets
  // that no longer exist. Keep Next's in-memory router cache, but never persist
  // RSC payloads in the browser/shared HTTP cache.
  if (isRscRequest(request)) {
    response.headers.set('Cache-Control', RSC_CACHE_CONTROL);
    return response;
  }

  // Clear legacy cache entries once. The no-store policy above prevents new
  // stale RSC entries, while this migration header removes already-persisted
  // Turbopack/older-deployment responses from browsers that visited before the
  // fix. A durable cookie keeps this from becoming a per-navigation cache wipe.
  if (
    process.env.NODE_ENV === 'production' &&
    isDocumentRequest(request) &&
    !request.cookies.has(RSC_CACHE_MIGRATION_COOKIE)
  ) {
    response.headers.set('Clear-Site-Data', '"cache"');
    response.cookies.set({
      name: RSC_CACHE_MIGRATION_COOKIE,
      value: '1',
      path: '/',
      maxAge: RSC_CACHE_MIGRATION_MAX_AGE,
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!api(?:/|$)|_next/static|_next/image).*)'],
};
