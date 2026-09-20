import { getCloudflareContext } from '@opennextjs/cloudflare';

import {
  newsletterErrors,
  subscribeWithButtondown,
  type NewsletterSubscribeResult,
} from './buttondown';

const MAX_REQUEST_BYTES = 1_024;
const MAX_EMAIL_LENGTH = 320;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CloudflareSecretBindings = { BUTTONDOWN_API_KEY?: unknown };
type NewsletterSubscribeDependencies = {
  getApiKey: () => Promise<string | undefined>;
  subscribe: typeof subscribeWithButtondown;
};
type NewsletterRequestBody = { email?: unknown };

function response(
  payload: NewsletterSubscribeResult,
  status: number
): Response {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function invalidEmailResponse() {
  return response(
    {
      ok: false,
      code: 'invalid_email',
      message: newsletterErrors.invalid_email,
    },
    400
  );
}

function statusForResult(result: NewsletterSubscribeResult): number {
  if (result.ok) return 201;
  switch (result.code) {
    case 'invalid_email':
      return 400;
    case 'already_subscribed':
      return 409;
    case 'rate_limited':
      return 429;
    case 'temporarily_unavailable':
      return 503;
  }
}

function hasJsonContentType(request: Request): boolean {
  const contentType = request.headers.get('content-type');
  return contentType?.toLowerCase().startsWith('application/json') ?? false;
}

async function readJsonBody(
  request: Request
): Promise<NewsletterRequestBody | null> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_REQUEST_BYTES) return null;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES)
      return null;
    const payload: unknown = JSON.parse(raw);
    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    )
      return null;
    return payload as NewsletterRequestBody;
  } catch {
    return null;
  }
}

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(normalized)
  )
    return null;
  return normalized;
}

function isValidIpAddress(value: string): boolean {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value))
    return value.split('.').every((segment) => Number(segment) <= 255);
  return /^[0-9a-f]{1,4}(?::[0-9a-f]{0,4}){2,7}$/i.test(value);
}

function normalizeIp(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return isValidIpAddress(normalized) ? normalized : null;
}

export function resolveSubscriberIp(headers: Headers): string | null {
  const cloudflareIp = normalizeIp(headers.get('cf-connecting-ip'));
  if (cloudflareIp) return cloudflareIp;
  const forwardedFor = headers.get('x-forwarded-for');
  if (!forwardedFor) return null;
  for (const candidate of forwardedFor.split(',')) {
    const ipAddress = normalizeIp(candidate);
    if (ipAddress) return ipAddress;
  }
  return null;
}

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

async function getButtondownApiKey(): Promise<string | undefined> {
  const { env } = await getCloudflareContext({ async: true });
  const apiKey = (env as CloudflareSecretBindings).BUTTONDOWN_API_KEY;
  return typeof apiKey === 'string' && apiKey.trim()
    ? apiKey.trim()
    : undefined;
}

const defaultDependencies: NewsletterSubscribeDependencies = {
  getApiKey: getButtondownApiKey,
  subscribe: subscribeWithButtondown,
};

export function createNewsletterSubscribeHandler(
  dependencies: NewsletterSubscribeDependencies = defaultDependencies
) {
  return async function subscribe(request: Request): Promise<Response> {
    if (!isSameOriginRequest(request) || !hasJsonContentType(request))
      return invalidEmailResponse();
    const body = await readJsonBody(request);
    const email = normalizeEmail(body?.email);
    if (!email) return invalidEmailResponse();
    let apiKey: string | undefined;
    try {
      apiKey = await dependencies.getApiKey();
    } catch {
      return response(
        {
          ok: false,
          code: 'temporarily_unavailable',
          message: newsletterErrors.temporarily_unavailable,
        },
        503
      );
    }
    const result = await dependencies.subscribe({
      apiKey,
      email,
      ipAddress: resolveSubscriberIp(request.headers),
    });
    return response(result, statusForResult(result));
  };
}
