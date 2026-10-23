import { getCloudflareContext } from '@opennextjs/cloudflare';

import { createNewsletterBudgetAdmission } from './global-budget-admission';

import {
  newsletterErrors,
  subscribeWithButtondown,
  type NewsletterSubscribeResult,
} from './buttondown';

const MAX_REQUEST_BYTES = 1_024;
const MAX_EMAIL_LENGTH = 320;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CloudflareSecretBindings = {
  BUTTONDOWN_API_KEY?: unknown;
  NEWSLETTER_GLOBAL_BUDGET_ENABLED?: unknown;
  NEWSLETTER_GLOBAL_BUDGET?: unknown;
};
type Admission = () => Promise<'admitted' | 'exhausted' | 'unavailable'>;
type NewsletterSubscribeDependencies = {
  getApiKey: () => Promise<string | undefined>;
  subscribe: typeof subscribeWithButtondown;
  proInterestEnabled: boolean;
  getAdmission?: () => Promise<Admission | undefined>;
};
type NewsletterRequestBody = {
  email?: unknown;
  purpose?: unknown;
  consent?: unknown;
};

function response(
  payload: NewsletterSubscribeResult,
  status: number
): Response {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function consentRequiredResponse() {
  return response(
    {
      ok: false,
      code: 'consent_required',
      message: newsletterErrors.consent_required,
    },
    400
  );
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
    case 'consent_required':
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

function isWorkersDevIngress(request: Request): boolean {
  // Both website Workers expose their stable workers.dev origins for CI and
  // recovery. Never let a request via any workers.dev alias spend the real
  // Buttondown subscriber-create account quota, even without Origin.
  // Use the incoming URL host, not untrusted forwarding/origin headers.
  return new URL(request.url).hostname.endsWith('.workers.dev');
}

async function getButtondownApiKey(): Promise<string | undefined> {
  const { env } = await getCloudflareContext({ async: true });
  const apiKey = (env as CloudflareSecretBindings).BUTTONDOWN_API_KEY;
  return typeof apiKey === 'string' && apiKey.trim()
    ? apiKey.trim()
    : undefined;
}

async function getGlobalBudgetAdmission(): Promise<Admission | undefined> {
  const { env } = await getCloudflareContext({ async: true });
  return createNewsletterBudgetAdmission(env as CloudflareSecretBindings);
}

const defaultDependencies: NewsletterSubscribeDependencies = {
  getAdmission: getGlobalBudgetAdmission,
  getApiKey: getButtondownApiKey,
  subscribe: subscribeWithButtondown,
  proInterestEnabled:
    process.env.NEXT_PUBLIC_VELLIRA_PRO_INTEREST_ENABLED === '1',
};

export function createNewsletterSubscribeHandler(
  dependencies: NewsletterSubscribeDependencies = defaultDependencies
) {
  return async function subscribe(request: Request): Promise<Response> {
    if (!isSameOriginRequest(request) || !hasJsonContentType(request))
      return invalidEmailResponse();
    const body = await readJsonBody(request);
    if (!body) return invalidEmailResponse();
    const email = normalizeEmail(body.email);
    if (!email) return invalidEmailResponse();
    if (body.purpose !== undefined && body.purpose !== 'pro_launch')
      return invalidEmailResponse();
    if (body.purpose === 'pro_launch' && body.consent !== true)
      return consentRequiredResponse();
    if (body.purpose === 'pro_launch' && !dependencies.proInterestEnabled)
      return response(
        {
          ok: false,
          code: 'temporarily_unavailable',
          message: newsletterErrors.temporarily_unavailable,
        },
        503
      );

    // Preserve safe malformed-address/consent smoke behavior, but stop every
    // valid subscriber-create candidate on workers.dev before reading secrets,
    // contacting the Durable Object or sending anything to Buttondown.
    if (isWorkersDevIngress(request))
      return response(
        {
          ok: false,
          code: 'temporarily_unavailable',
          message: newsletterErrors.temporarily_unavailable,
        },
        503
      );

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
    let admit: Admission | undefined;
    if (apiKey && dependencies.getAdmission) {
      try {
        admit = await dependencies.getAdmission();
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
    }
    const result = await dependencies.subscribe({
      ...(admit ? { admit } : {}),
      apiKey,
      email,
      ipAddress: resolveSubscriberIp(request.headers),
      ...(body.purpose === 'pro_launch'
        ? { purpose: 'pro_launch' as const }
        : {}),
    });
    return response(result, statusForResult(result));
  };
}
