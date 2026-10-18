// Local-only test Worker: not referenced by any deployment configuration.
import { NewsletterRollingBudgetCoordinator } from '../cloudflare/newsletter-rolling-budget-coordinator.mjs';

// These routes exist only on the local test subclass. They are not part of the
// production candidate and cannot be reached through deployed website Workers.
export class TestNewsletterRollingBudgetCoordinator extends NewsletterRollingBudgetCoordinator {
  async fetch(request) {
    const pathname = new globalThis.URL(request.url).pathname;
    if (request.method === 'POST' && pathname === '/__test/seed-null') {
      await this.ctx.storage.put('rolling-v1', null);
      return new globalThis.Response(null, { status: 204 });
    }
    if (request.method === 'GET' && pathname === '/__test/inspect') {
      const value = await this.ctx.storage.get('rolling-v1');
      return globalThis.Response.json(
        { isNull: value === null, isMissing: value === undefined },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return super.fetch(request);
  }
}

export default {
  fetch(request, env) {
    return env.TEST_ROLLING_BUDGET.getByName('one-buttondown-account').fetch(request);
  },
};
