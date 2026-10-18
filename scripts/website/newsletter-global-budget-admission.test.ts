import { describe, expect, it, vi } from 'vitest';

import { createNewsletterBudgetAdmission } from '../../apps/website/src/server/newsletter/global-budget-admission';

function coordinator(status: number, code: string, cache = 'no-store') {
  const fetch = vi.fn(async () =>
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
      expect(binding.idFromName).toHaveBeenCalledWith(
        'one-buttondown-account'
      );
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
});
