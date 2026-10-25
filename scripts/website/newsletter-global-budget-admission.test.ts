import { describe, expect, it, vi } from 'vitest';

import { createNewsletterBudgetAdmission } from '../../apps/website/src/server/newsletter/global-budget-admission';

function coordinator(status: number, code: string, cache = 'no-store') {
  const fetch = vi.fn(async (_request: Request) =>
    Response.json(
      { ok: status === 200, code },
      { status, headers: { 'Cache-Control': cache } }
    )
  );
  const get = vi.fn(() => ({ fetch }));
  const idFromName = vi.fn((name: string) => name);
  return { fetch, get, idFromName };
}

describe('dormant global newsletter budget binding adapter', () => {
  it('keeps missing or OFF mode disabled without accessing the binding', () => {
    const binding = coordinator(200, 'admitted');
    expect(
      createNewsletterBudgetAdmission({
        NEWSLETTER_GLOBAL_BUDGET: binding,
      })
    ).toBeUndefined();
    expect(
      createNewsletterBudgetAdmission({
        NEWSLETTER_GLOBAL_BUDGET_ENABLED: '0',
        NEWSLETTER_GLOBAL_BUDGET: binding,
      })
    ).toBeUndefined();
    expect(binding.get).not.toHaveBeenCalled();
  });

  it('treats unexpected ON mode and absent binding as unavailable', async () => {
    const unknown = createNewsletterBudgetAdmission({
      NEWSLETTER_GLOBAL_BUDGET_ENABLED: 'invalid',
    });
    expect(await unknown?.()).toBe('unavailable');

    const missing = createNewsletterBudgetAdmission({
      NEWSLETTER_GLOBAL_BUDGET_ENABLED: '1',
    });
    expect(await missing?.()).toBe('unavailable');
  });

  it.each([
    [200, 'admitted', 'admitted'],
    [429, 'rate_limited', 'exhausted'],
    [503, 'unavailable', 'unavailable'],
    [200, 'rate_limited', 'unavailable'],
    [429, 'admitted', 'unavailable'],
  ] as const)(
    'maps strict coordinator response %i/%s to %s',
    async (status, code, expected) => {
      const binding = coordinator(status, code);
      const admit = createNewsletterBudgetAdmission({
        NEWSLETTER_GLOBAL_BUDGET_ENABLED: '1',
        NEWSLETTER_GLOBAL_BUDGET: binding,
      });
      expect(await admit?.()).toBe(expected);
      expect(binding.idFromName).toHaveBeenCalledWith('one-buttondown-account');
      expect(binding.fetch).toHaveBeenCalledTimes(1);
      const request = binding.fetch.mock.calls[0]?.[0];
      expect(request?.method).toBe('POST');
      expect(new URL(request!.url).pathname).toBe('/admit');
    }
  );

  it('fails closed on invalid cache policy or malformed response', async () => {
    const wrongCache = coordinator(200, 'admitted', 'public');
    const admit = createNewsletterBudgetAdmission({
      NEWSLETTER_GLOBAL_BUDGET_ENABLED: '1',
      NEWSLETTER_GLOBAL_BUDGET: wrongCache,
    });
    expect(await admit?.()).toBe('unavailable');
  });

  it('fails closed when the remote binding throws', async () => {
    const binding = coordinator(200, 'admitted');
    binding.fetch.mockRejectedValueOnce(new Error('private remote failure'));
    const admit = createNewsletterBudgetAdmission({
      NEWSLETTER_GLOBAL_BUDGET_ENABLED: '1',
      NEWSLETTER_GLOBAL_BUDGET: binding,
    });
    expect(await admit?.()).toBe('unavailable');
    expect(binding.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    [200, { ok: true, code: 'admitted' }, 'max-age=60'],
    [200, { ok: true, code: 'unknown' }, 'no-store'],
    [200, null, 'no-store'],
    [200, ['admitted'], 'no-store'],
    [429, { code: 'rate_limited' }, 'public'],
  ] as const)(
    'fails closed on malformed coordinator protocol %#',
    async (status, payload, cache) => {
      const fetch = vi.fn(async () =>
        Response.json(payload, { status, headers: { 'Cache-Control': cache } })
      );
      const admit = createNewsletterBudgetAdmission({
        NEWSLETTER_GLOBAL_BUDGET_ENABLED: '1',
        NEWSLETTER_GLOBAL_BUDGET: {
          idFromName: () => 'account',
          get: () => ({ fetch }),
        },
      });
      // Missing or unusual payload fields must never independently grant capacity.
      const decision = await admit?.();
      if (status === 200 && payload && !Array.isArray(payload) &&
          'code' in payload && payload.code === 'admitted' && cache === 'no-store') {
        expect(decision).toBe('admitted');
      } else {
        expect(decision).toBe('unavailable');
      }
    }
  );

  it('fails closed on malformed JSON, binding lookup failure and request failure', async () => {
    const failureCases = [
      { idFromName: () => { throw new Error('object id failure'); }, get: () => ({ fetch: vi.fn() }) },
      { idFromName: () => 'account', get: () => { throw new Error('binding unavailable'); } },
      { idFromName: () => 'account', get: () => ({ fetch: async () => new Response('{invalid', { status: 200, headers: { 'Cache-Control': 'no-store' } }) }) },
      { idFromName: () => 'account', get: () => ({ fetch: async () => { throw new Error('network timeout'); } }) },
    ];
    for (const binding of failureCases) {
      const admit = createNewsletterBudgetAdmission({
        NEWSLETTER_GLOBAL_BUDGET_ENABLED: '1',
        NEWSLETTER_GLOBAL_BUDGET: binding,
      });
      expect(await admit?.()).toBe('unavailable');
    }
  });

  it('uses one fixed logical account identity across independent calls', async () => {
    const idFromName = vi.fn((name: string) => name);
    const fetch = vi.fn(async (_request: Request) => Response.json(
      { code: 'rate_limited' },
      { status: 429, headers: { 'Cache-Control': 'no-store' } }
    ));
    const admit = createNewsletterBudgetAdmission({
      NEWSLETTER_GLOBAL_BUDGET_ENABLED: '1',
      NEWSLETTER_GLOBAL_BUDGET: { idFromName, get: () => ({ fetch }) },
    });
    expect(await Promise.all(Array.from({ length: 12 }, () => admit?.())))
      .toEqual(Array(12).fill('exhausted'));
    expect(idFromName).toHaveBeenCalledTimes(12);
    expect(idFromName.mock.calls.every(([name]) => name === 'one-buttondown-account'))
      .toBe(true);
    expect(fetch).toHaveBeenCalledTimes(12);
    expect(fetch.mock.calls.every(([request]) =>
      request.method === 'POST' &&
      new URL(request.url).pathname === '/admit' &&
      request.body === null
    )).toBe(true);
  });

});
