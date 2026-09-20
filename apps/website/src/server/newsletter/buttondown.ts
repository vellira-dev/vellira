const BUTTONDOWN_SUBSCRIBERS_URL = 'https://api.buttondown.com/v1/subscribers';
const BUTTONDOWN_TIMEOUT_MS = 8_000;

export type NewsletterSubscribeResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'invalid_email'
        | 'already_subscribed'
        | 'rate_limited'
        | 'temporarily_unavailable';
      message: string;
    };

type ButtondownErrorResponse = {
  code?: unknown;
};

export type ButtondownSubscribeOptions = {
  apiKey: string | undefined;
  email: string;
  ipAddress: string | null;
  fetcher?: typeof fetch;
};

const newsletterErrors = {
  invalid_email: 'Enter a valid email address.',
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

async function readProviderErrorCode(
  response: Response
): Promise<string | null> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null) {
      const code = (payload as ButtondownErrorResponse).code;
      if (typeof code === 'string') return code;
    }
  } catch {
    // Provider error payloads are intentionally never exposed to callers.
  }

  return null;
}

async function mapProviderResponse(
  response: Response
): Promise<NewsletterSubscribeResult> {
  if (response.status === 201) return { ok: true };

  if (response.status === 422) return error('invalid_email');
  if (response.status === 429) return error('rate_limited');
  if (response.status === 401 || response.status === 403)
    return error('temporarily_unavailable');
  if (response.status === 409) return error('already_subscribed');

  if (response.status === 400) {
    const providerCode = await readProviderErrorCode(response);
    return providerCode === 'email_invalid'
      ? error('invalid_email')
      : error('already_subscribed');
  }

  return error('temporarily_unavailable');
}

export async function subscribeWithButtondown({
  apiKey,
  email,
  ipAddress,
  fetcher = fetch,
}: ButtondownSubscribeOptions): Promise<NewsletterSubscribeResult> {
  if (!apiKey) return error('temporarily_unavailable');

  const body: { email_address: string; ip_address?: string } = {
    email_address: email,
  };
  if (ipAddress) body.ip_address = ipAddress;

  try {
    const response = await fetcher(BUTTONDOWN_SUBSCRIBERS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
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
