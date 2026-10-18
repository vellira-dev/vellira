import { admitRollingNewsletterAttempt } from './newsletter-rolling-window-model.mjs';

// Candidate only: not exported by the deployed website or budget owner Worker.
// One transaction persists attempts and lastSeen even on quota exhaustion.
export class NewsletterRollingBudgetCoordinator {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    if (
      request.method !== 'POST' ||
      new globalThis.URL(request.url).pathname !== '/admit'
    ) {
      return new globalThis.Response(null, { status: 404 });
    }
    const capacity = Number(this.env.NEWSLETTER_GLOBAL_BUDGET_CAPACITY);
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      return this.reply('unavailable', 503);
    }
    try {
      const now = Date.now();
      const outcome = await this.ctx.storage.transaction(async (txn) => {
        const persisted = await txn.get('rolling-v1');
        const state = persisted ?? { attempts: [], lastSeen: 0 };
        const result = admitRollingNewsletterAttempt(state, capacity, now);
        if (result.outcome !== 'unavailable') {
          await txn.put('rolling-v1', result.next);
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
    return globalThis.Response.json(
      { ok: status === 200, code },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
