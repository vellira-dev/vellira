const DEFAULT_BLOG_METRICS_API_BASE_URL = 'https://api.vellira.dev';
const ANONYMOUS_ACTOR_COOKIE_NAMES = new Set([
  '__Host-vellira_actor',
  'vellira_actor',
]);

type BlogMetricsRouteContext = {
  params: Promise<{
    segments: string[];
  }>;
};

function getBlogMetricsApiBaseUrl(): string {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_BLOG_METRICS_API_BASE_URL?.trim();

  return (configuredBaseUrl || DEFAULT_BLOG_METRICS_API_BASE_URL).replace(
    /\/+$/,
    ''
  );
}

function getAnonymousActorCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  const actorCookies = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => {
      const separator = cookie.indexOf('=');
      const name = separator >= 0 ? cookie.slice(0, separator) : cookie;
      return ANONYMOUS_ACTOR_COOKIE_NAMES.has(name);
    });

  return actorCookies.length > 0 ? actorCookies.join('; ') : null;
}

function createUpstreamUrl(
  request: Request,
  method: string,
  segments: readonly string[]
): URL | null {
  const encoded = segments.map((segment) => encodeURIComponent(segment));
  const upstream = new URL('/v1/blog/', `${getBlogMetricsApiBaseUrl()}/`);

  if (method === 'GET' && segments.length === 1 && segments[0] === 'metrics') {
    upstream.pathname = '/v1/blog/metrics';
    const requestUrl = new URL(request.url);

    for (const [key, value] of requestUrl.searchParams) {
      if (key !== 'slug') {
        return null;
      }
      upstream.searchParams.append(key, value);
    }

    return upstream;
  }

  if (method === 'GET' && segments.length === 2 && segments[0] === 'metrics') {
    upstream.pathname = `/v1/blog/metrics/${encoded[1]}`;
    return upstream;
  }

  if (
    method === 'POST' &&
    segments.length === 3 &&
    segments[0] === 'articles' &&
    segments[2] === 'views'
  ) {
    upstream.pathname = `/v1/blog/articles/${encoded[1]}/views`;
    return upstream;
  }

  if (
    (method === 'GET' || method === 'PUT' || method === 'DELETE') &&
    segments.length === 3 &&
    segments[0] === 'articles' &&
    segments[2] === 'like'
  ) {
    upstream.pathname = `/v1/blog/articles/${encoded[1]}/like`;
    return upstream;
  }

  return null;
}

async function proxyBlogMetrics(
  request: Request,
  context: BlogMetricsRouteContext
): Promise<Response> {
  const { segments } = await context.params;
  const method = request.method.toUpperCase();
  const upstreamUrl = createUpstreamUrl(request, method, segments);

  if (!upstreamUrl) {
    return Response.json(
      { error: 'unsupported_blog_metrics_route' },
      { status: 404 }
    );
  }

  const headers = new Headers({ Accept: 'application/json' });
  const actorCookie = getAnonymousActorCookie(request.headers.get('cookie'));

  if (actorCookie) {
    headers.set('cookie', actorCookie);
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method,
      headers,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return Response.json(
      { error: 'blog_metrics_upstream_unavailable' },
      { status: 503 }
    );
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get('content-type');
  const cacheControl = upstream.headers.get('cache-control');
  const setCookie = upstream.headers.get('set-cookie');

  if (contentType) {
    responseHeaders.set('content-type', contentType);
  }
  if (cacheControl) {
    responseHeaders.set('cache-control', cacheControl);
  } else {
    responseHeaders.set('cache-control', 'private, no-store');
  }
  if (setCookie) {
    responseHeaders.set('set-cookie', setCookie);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export function GET(request: Request, context: BlogMetricsRouteContext) {
  return proxyBlogMetrics(request, context);
}

export function POST(request: Request, context: BlogMetricsRouteContext) {
  return proxyBlogMetrics(request, context);
}

export function PUT(request: Request, context: BlogMetricsRouteContext) {
  return proxyBlogMetrics(request, context);
}

export function DELETE(request: Request, context: BlogMetricsRouteContext) {
  return proxyBlogMetrics(request, context);
}
