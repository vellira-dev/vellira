import { describe, expect, it, vi } from 'vitest';

import {
  createNewsletterSubscribeHandler,
  resolveSubscriberIp,
} from '../../apps/website/src/server/newsletter/subscribe';
import {
  BUTTONDOWN_SUBSCRIBERS_URL,
  PRO_INTEREST_UTM_CAMPAIGN,
  newsletterErrors,
  subscribeWithButtondown,
  type NewsletterSubscribeResult,
} from '../../apps/website/src/server/newsletter/buttondown';

const API_URL = 'https://vellira.dev/api/newsletter/subscribe';
type ButtondownFetcher = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

function request(
  body: string,
  headers: HeadersInit = { 'Content-Type': 'application/json' }
) {
  return new Request(API_URL, { method: 'POST', headers, body });
}

function handler(options?: {
  apiKey?: string | undefined;
  proInterestEnabled?: boolean;
  subscribe?: (input: {
    apiKey: string | undefined;
    email: string;
    ipAddress: string | null;
    purpose?: 'pro_launch';
  }) => Promise<NewsletterSubscribeResult>;
}) {
  return createNewsletterSubscribeHandler({
    getApiKey: async () =>
      options && 'apiKey' in options ? options.apiKey : 'test-buttondown-key',
    proInterestEnabled: options?.proInterestEnabled ?? false,
    subscribe:
      options?.subscribe ??
      (async () => {
        return { ok: true };
      }),
  });
}

describe('newsletter subscribe API', () => {
  it('rejects empty, malformed, oversized, malformed-json, and cross-origin requests', async () => {
    const subscribe = vi.fn();
    const route = handler({ subscribe });

    for (const requestToReject of [
      request(JSON.stringify({ email: '' })),
      request(JSON.stringify({ email: 'invalid-email' })),
      request(JSON.stringify({ email: `${'a'.repeat(320)}@example.com` })),
      request('{'),
      request(JSON.stringify({ email: 'person@example.com' }), {
        'Content-Type': 'application/json',
        Origin: 'https://not-vellira.example',
      }),
      request(JSON.stringify({ email: 'person@example.com' }), {
        'Content-Type': 'text/plain',
      }),
    ]) {
      const response = await route(requestToReject);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        ok: false,
        code: 'invalid_email',
        message: newsletterErrors.invalid_email,
      });
      expect(response.headers.get('cache-control')).toBe('no-store');
    }

    expect(subscribe).not.toHaveBeenCalled();
  });

  it('normalizes valid email and forwards a trusted Cloudflare IP', async () => {
    const subscribe = vi.fn(async () => ({ ok: true }) as const);
    const route = handler({ subscribe });

    const response = await route(
      request(JSON.stringify({ email: '  Person@Example.COM  ' }), {
        'Content-Type': 'application/json; charset=utf-8',
        'CF-Connecting-IP': '203.0.113.12',
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(subscribe).toHaveBeenCalledWith({
      apiKey: 'test-buttondown-key',
      email: 'person@example.com',
      ipAddress: '203.0.113.12',
    });
  });

  it('keeps Pro collection disabled until the separate provider rollout is approved', async () => {
    const subscribe = vi.fn(async () => ({ ok: true }) as const);
    const route = handler({ subscribe, proInterestEnabled: false });
    const result = await route(
      request(
        JSON.stringify({
          email: 'person@example.com',
          purpose: 'pro_launch',
          consent: true,
        })
      )
    );
    expect(result.status).toBe(503);
    expect(await result.json()).toMatchObject({
      ok: false,
      code: 'temporarily_unavailable',
    });
    expect(subscribe).not.toHaveBeenCalled();

    const normal = await route(
      request(
        JSON.stringify({
          email: 'person@example.com',
        })
      )
    );
    expect(normal.status).toBe(201);
    expect(subscribe).toHaveBeenCalledExactlyOnceWith({
      apiKey: 'test-buttondown-key',
      email: 'person@example.com',
      ipAddress: null,
    });
  });

  it('requires a genuine Pro opt-in before tagging an email address', async () => {
    const subscribe = vi.fn(async () => ({ ok: true }) as const);
    const route = handler({ subscribe, proInterestEnabled: true });

    for (const consent of [undefined, false, 'true', 1]) {
      const response = await route(
        request(
          JSON.stringify({
            email: 'person@example.com',
            purpose: 'pro_launch',
            ...(consent === undefined ? {} : { consent }),
          })
        )
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        ok: false,
        code: 'consent_required',
      });
    }
    expect(subscribe).not.toHaveBeenCalled();

    const invalidPurpose = await route(
      request(
        JSON.stringify({
          email: 'person@example.com',
          purpose: 'override',
          consent: true,
        })
      )
    );
    expect(invalidPurpose.status).toBe(400);
    expect(subscribe).not.toHaveBeenCalled();

    const confirmedRequest = await route(
      request(
        JSON.stringify({
          email: 'person@example.com',
          purpose: 'pro_launch',
          consent: true,
        })
      )
    );
    expect(confirmedRequest.status).toBe(201);
    expect(subscribe).toHaveBeenCalledExactlyOnceWith({
      apiKey: 'test-buttondown-key',
      email: 'person@example.com',
      ipAddress: null,
      purpose: 'pro_launch',
    });
  });

  it('uses the first normalized X-Forwarded-For value only as a fallback', () => {
    expect(
      resolveSubscriberIp(
        new Headers({
          'CF-Connecting-IP': 'not-an-ip',
          'X-Forwarded-For': 'not-an-ip, 198.51.100.7, 203.0.113.9',
        })
      )
    ).toBe('198.51.100.7');
    expect(
      resolveSubscriberIp(
        new Headers({
          'CF-Connecting-IP': '2001:db8::9',
          'X-Forwarded-For': '198.51.100.7',
        })
      )
    ).toBe('2001:db8::9');
  });

  it('fails safely when the Worker secret is unavailable without exposing it', async () => {
    const secret = 'server-only-test-key';
    const response = await handler({
      apiKey: undefined,
      subscribe: subscribeWithButtondown,
    })(request(JSON.stringify({ email: 'person@example.com' })));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain(newsletterErrors.temporarily_unavailable);
    expect(body).not.toContain(secret);
  });
});

describe('Buttondown provider boundary', () => {
  it('uses the documented server request contract without bypassing confirmation or firewall', async () => {
    const fetcher = vi.fn<ButtondownFetcher>(async (input, init) => {
      void input;
      void init;
      return new Response('{}', { status: 201 });
    });

    const result = await subscribeWithButtondown({
      apiKey: 'server-only-test-key',
      email: 'person@example.com',
      ipAddress: '203.0.113.12',
      fetcher,
    });

    expect(result).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith(
      BUTTONDOWN_SUBSCRIBERS_URL,
      expect.objectContaining({ method: 'POST', cache: 'no-store' })
    );

    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({
      Authorization: 'Token server-only-test-key',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      email_address: 'person@example.com',
      ip_address: '203.0.113.12',
    });
    expect(String(init?.body)).not.toContain('"type"');
    expect(init?.headers).not.toHaveProperty('X-Buttondown-Bypass-Firewall');
  });

  it('keeps Pro updates distinct, requires confirmation, and never bypasses provider suppression', async () => {
    const fetcher = vi.fn<ButtondownFetcher>(
      async () => new Response('{}', { status: 201 })
    );
    const result = await subscribeWithButtondown({
      apiKey: 'server-only-test-key',
      email: 'pro@example.com',
      ipAddress: null,
      purpose: 'pro_launch',
      fetcher,
    });

    expect(result).toEqual({ ok: true });
    const init = fetcher.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toEqual({
      email_address: 'pro@example.com',
      utm_campaign: PRO_INTEREST_UTM_CAMPAIGN,
      type: 'unactivated',
    });
    expect(init?.headers).not.toHaveProperty('X-Buttondown-Collision-Behavior');
    expect(init?.headers).not.toHaveProperty('X-Buttondown-Bypass-Firewall');
    expect(JSON.parse(String(init?.body))).not.toHaveProperty('tags');

    // Existing subscribers must not acquire new Pro-interest attribution from
    // an unauthenticated duplicate signup. Buttondown's default policy rejects
    // collisions instead of updating an existing subscriber's campaign.
    await expect(
      subscribeWithButtondown({
        apiKey: 'server-only-test-key',
        email: 'existing@example.com',
        ipAddress: null,
        purpose: 'pro_launch',
        fetcher: async (_url, init) => {
          expect(init?.headers).not.toHaveProperty(
            'X-Buttondown-Collision-Behavior'
          );
          expect(JSON.parse(String(init?.body))).toMatchObject({
            utm_campaign: PRO_INTEREST_UTM_CAMPAIGN,
            type: 'unactivated',
          });
          return new Response(JSON.stringify({ code: 'subscriber_exists' }), {
            status: 400,
          });
        },
      })
    ).resolves.toMatchObject({ ok: false, code: 'already_subscribed' });

    // A surprising 200 does not certify either creation or topic consent.
    await expect(
      subscribeWithButtondown({
        apiKey: 'server-only-test-key',
        email: 'unexpected@example.com',
        ipAddress: null,
        purpose: 'pro_launch',
        fetcher: async () => new Response('{}', { status: 200 }),
      })
    ).resolves.toMatchObject({ ok: false, code: 'temporarily_unavailable' });

    await expect(
      subscribeWithButtondown({
        apiKey: 'server-only-test-key',
        email: 'suppressed@example.com',
        ipAddress: null,
        purpose: 'pro_launch',
        fetcher: async () =>
          new Response(JSON.stringify({ code: 'subscriber_suppressed' }), {
            status: 400,
          }),
      })
    ).resolves.toMatchObject({ ok: false, code: 'already_subscribed' });
  });

  it.each([
    [
      400,
      { code: 'email_invalid', detail: 'provider-private-detail' },
      'invalid_email',
    ],
    [400, { code: 'subscriber_suppressed' }, 'already_subscribed'],
    [409, {}, 'already_subscribed'],
    [422, { detail: [{ msg: 'provider-private-detail' }] }, 'invalid_email'],
    [429, {}, 'rate_limited'],
    [401, {}, 'temporarily_unavailable'],
    [403, {}, 'temporarily_unavailable'],
    [500, {}, 'temporarily_unavailable'],
    [418, '<html>provider-private-detail</html>', 'temporarily_unavailable'],
  ] as const)(
    'maps Buttondown status %i to a safe %s result',
    async (status, providerBody, code) => {
      const result = await subscribeWithButtondown({
        apiKey: 'server-only-test-key',
        email: 'person@example.com',
        ipAddress: null,
        fetcher: async () =>
          new Response(
            typeof providerBody === 'string'
              ? providerBody
              : JSON.stringify(providerBody),
            { status, headers: { 'Content-Type': 'application/json' } }
          ),
      });

      expect(result).toMatchObject({ ok: false, code });
      expect(JSON.stringify(result)).not.toContain('provider-private-detail');
    }
  );

  it('fails closed for missing secrets and provider network failures', async () => {
    const fetcher = vi.fn<ButtondownFetcher>(async (input, init) => {
      void input;
      void init;
      throw new Error('provider-private-detail');
    });

    await expect(
      subscribeWithButtondown({
        apiKey: undefined,
        email: 'person@example.com',
        ipAddress: null,
        fetcher,
      })
    ).resolves.toMatchObject({ ok: false, code: 'temporarily_unavailable' });
    expect(fetcher).not.toHaveBeenCalled();

    await expect(
      subscribeWithButtondown({
        apiKey: 'server-only-test-key',
        email: 'person@example.com',
        ipAddress: null,
        fetcher,
      })
    ).resolves.toMatchObject({ ok: false, code: 'temporarily_unavailable' });

    await expect(
      subscribeWithButtondown({
        apiKey: 'server-only-test-key',
        email: 'person@example.com',
        ipAddress: null,
        fetcher: async () => {
          throw new DOMException('provider timeout', 'TimeoutError');
        },
      })
    ).resolves.toMatchObject({ ok: false, code: 'temporarily_unavailable' });
  });
});
