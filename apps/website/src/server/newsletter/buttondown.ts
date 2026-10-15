const BUTTONDOWN_SUBSCRIBERS_URL = 'https://api.buttondown.com/v1/subscribers';
const BUTTONDOWN_TIMEOUT_MS = 8_000;
export const PRO_INTEREST_UTM_CAMPAIGN = 'vellira_pro_launch_interest';

export type NewsletterSubscribeResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'invalid_email'
        | 'consent_required'
        | 'already_subscribed'
        | 'rate_limited'
        | 'temporarily_unavailable';
      message: string;
    };

type ButtondownErrorResponse = {
  code?: unknown;
  metadata?: unknown;
};

type ButtondownProviderError = {
  code: string | null;
  existingSubscriber: boolean;
};

export type ButtondownSubscribeOptions = {
  apiKey: string | undefined;
  email: string;
  ipAddress: string | null;
  purpose?: 'pro_launch';
  fetcher?: typeof fetch;
};

const newsletterErrors = {
  invalid_email: 'Enter a valid email address.',
  consent_required: 'Please confirm that you want Pro updates.',
  already_subscribed:
    'This email is already subscribed or awaiting confirmation.',
  rate_limited: 'Please wait a few minutes and try again.',
  temporarily_unavailable:
    'Newsletter signup is temporarily unavailable. Please try again later.',
} as const;

function error(
  code: Exclude<NewsletterSubscribeResult, { ok: true }>['code']
): NewsletterSubscribeResult {
  return { ok: false, code, message: newsletterErrors[code] };
}

async function readProviderError(
  response: Response
): Promise<ButtondownProviderError> {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === 'object' &&
      payload !== null &&
      !Array.isArray(payload)
    ) {
      const errorResponse = payload as ButtondownErrorResponse;
      const metadata = errorResponse.metadata;
      const subscriberId =
        typeof metadata === 'object' &&
        metadata !== null &&
        !Array.isArray(metadata)
          ? (metadata as { subscriber_id?: unknown }).subscriber_id
          : null;

      return {
        code:
          typeof errorResponse.code === 'string' ? errorResponse.code : null,
        // Buttondown includes the existing ID on duplicate-create errors.
        // Do not use arbitrary 400s as evidence that an address is subscribed.
        existingSubscriber:
          typeof subscriberId === 'string' &&
          /^sub_[a-z0-9]+$/i.test(subscriberId),
      };
    }
  } catch {
    // Provider error payloads are intentionally never exposed to callers.
  }

  return { code: null, existingSubscriber: false };
}

async function mapProviderResponse(
  response: Response
): Promise<NewsletterSubscribeResult> {
  if (response.status === 201) return { ok: true };

  if (response.status === 422) {
    const providerError = await readProviderError(response);
    return providerError.code === 'email_invalid'
      ? error('invalid_email')
      : error('temporarily_unavailable');
  }
  if (response.status === 429) return error('rate_limited');
  if (response.status === 401 || response.status === 403)
    return error('temporarily_unavailable');
  if (response.status === 409) return error('already_subscribed');

  if (response.status === 400) {
    const providerError = await readProviderError(response);
    if (providerError.code === 'email_invalid') return error('invalid_email');
    if (providerError.code === 'subscriber_suppressed')
      return error('temporarily_unavailable');
    if (
      providerError.code === 'subscriber_exists' ||
      providerError.existingSubscriber
    )
      return error('already_subscribed');

    // Buttondown also uses HTTP 400 for the daily subscriber-creation limit.
    // Unknown validation, quota and firewall errors must not be presented as
    // proof that the submitted email is already subscribed.
    return error('temporarily_unavailable');
  }

  return error('temporarily_unavailable');
}

export async function subscribeWithButtondown({
  apiKey,
  email,
  ipAddress,
  purpose,
  fetcher = fetch,
}: ButtondownSubscribeOptions): Promise<NewsletterSubscribeResult> {
  if (!apiKey) return error('temporarily_unavailable');

  const body: {
    email_address: string;
    ip_address?: string;
    utm_campaign?: string;
    type?: 'unactivated';
  } = { email_address: email };
  if (ipAddress) body.ip_address = ipAddress;

  const headers: Record<string, string> = {
    Authorization: `Token ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (purpose === 'pro_launch') {
    // Attribute voluntary Pro interest without paid tags, while retaining
    // default duplicate rejection (no unauthenticated updates to existing
    // subscribers). New addresses must confirm via Buttondown double opt-in.
    body.utm_campaign = PRO_INTEREST_UTM_CAMPAIGN;
    body.type = 'unactivated';
  }

  try {
    const response = await fetcher(BUTTONDOWN_SUBSCRIBERS_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(BUTTONDOWN_TIMEOUT_MS),
    });

    return mapProviderResponse(response);
  } catch {
    return error('temporarily_unavailable');
  }
}

export { BUTTONDOWN_SUBSCRIBERS_URL, newsletterErrors };
