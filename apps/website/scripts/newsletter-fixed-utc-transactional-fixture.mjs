import { NewsletterFixedUtcTransactionalCandidate } from '../cloudflare/newsletter-fixed-utc-transactional-candidate.mjs';

// Test-only endpoints. Never exported from a deployed Worker.
export class TestFixedUtcCoordinator extends NewsletterFixedUtcTransactionalCandidate {
  now(request) {
    const value = request.headers.get('x-test-now');
    return value === null ? Date.now() : Number(value);
  }

  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (request.method === 'POST' && pathname === '/__test/seed') {
      const { key, value } = await request.json();
      if (!['rolling-v1', 'fixed-utc-v1'].includes(key)) {
        return new Response(null, { status: 400 });
      }
      await this.ctx.storage.put(key, value);
      return new Response(null, { status: 204 });
    }
    if (request.method === 'GET' && pathname === '/__test/state') {
      return Response.json(
        {
          fixed: await this.ctx.storage.get('fixed-utc-v1') ?? null,
          legacy: await this.ctx.storage.get('rolling-v1') ?? null,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return super.fetch(request);
  }
}

export default {
  fetch(request, env) {
    return env.TEST_BUDGET.getByName('one-buttondown-account').fetch(request);
  },
};
