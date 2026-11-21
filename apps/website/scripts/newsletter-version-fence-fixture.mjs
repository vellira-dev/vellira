import { NewsletterVersionFenceCandidate } from '../cloudflare/newsletter-version-fence-candidate.mjs';

// Local-only test owner; never referenced by real Wrangler configurations.
export class TestNewsletterVersionFence extends NewsletterVersionFenceCandidate {
  now(request) {
    return Number(request.headers.get('x-test-clock'));
  }

  async fetch(request) {
    const url = new globalThis.URL(request.url);
    if (request.method === 'POST' && url.pathname === '/__test/seed') {
      const { key, value } = await request.json();
      if (![
        'newsletter-coordinator-version-v1',
        'rolling-v1',
        'fixed-utc-v1',
      ].includes(key)) return new globalThis.Response(null, { status: 400 });
      await this.ctx.storage.put(key, value);
      return new globalThis.Response(null, { status: 204 });
    }
    if (request.method === 'GET' && url.pathname === '/__test/state') {
      return globalThis.Response.json({
        version: (await this.ctx.storage.get('newsletter-coordinator-version-v1')) ?? null,
        rolling: (await this.ctx.storage.get('rolling-v1')) ?? null,
        fixed: (await this.ctx.storage.get('fixed-utc-v1')) ?? null,
      });
    }
    return super.fetch(request);
  }
}

export default {
  fetch(request, env) {
    return env.TEST_BUDGET.getByName('one-buttondown-account').fetch(request);
  },
};
