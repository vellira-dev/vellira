import { admitNewsletterAttempt } from './newsletter-global-budget-model.mjs';

// Contract-only Durable Object implementation. Not exported by the deployed
// Worker, not bound in Wrangler and never called by newsletter code.
export class NewsletterBudgetCoordinator {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/admit') {
      return new Response(null, { status: 404 });
    }

    const capacity = Number(this.env.NEWSLETTER_GLOBAL_BUDGET_CAPACITY);
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      return this.reply('unavailable', 503);
    }

    try {
      // The transaction owns the read and write together. Any interrupted
      // attempt must not emit an admitted response before durable commit.
      const outcome = await this.ctx.storage.transaction(async (txn) => {
        const spent = (await txn.get('spent')) ?? 0;
        const result = admitNewsletterAttempt({ spent }, capacity);
        if (result.outcome === 'admitted') {
          await txn.put('spent', result.next.spent);
        }
        return result.outcome;
      });
      if (outcome === 'admitted') return this.reply('admitted', 200);
      if (outcome === 'exhausted') return this.reply('rate_limited', 429);
      return this.reply('unavailable', 503);
    } catch {
      return this.reply('unavailable', 503);
    }
  }

  reply(code, status) {
    return Response.json(
      { ok: status === 200, code },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

// No reset/window is implemented: applying this coordinator to live traffic
// must wait for verified provider quota, scope, and reset semantics.
