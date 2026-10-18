import { admitRollingNewsletterAttempt } from './newsletter-rolling-window-model.mjs';
import { rollingBudgetResponse } from './newsletter-rolling-response.mjs';

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
      return rollingBudgetResponse('unavailable');
    }
    try {
      const outcome = await this.ctx.storage.transaction(async (txn) => {
        const persisted = await txn.get('rolling-v1');
        // Only a missing key may initialize an empty budget. Persisted null
        // (or any invalid value) is corruption and must fail closed.
        const state =
          persisted === undefined ? { attempts: [], lastSeen: 0 } : persisted;
        // Sample the clock after obtaining the serialized persisted state.
        // This avoids a queued request carrying an outdated pre-transaction time.
        const now = Date.now();
        const result = admitRollingNewsletterAttempt(state, capacity, now);
        if (result.outcome !== 'unavailable') {
          await txn.put('rolling-v1', result.next);
        }
        return result.outcome;
      });
      return rollingBudgetResponse(outcome);
    } catch {
      return rollingBudgetResponse('unavailable');
    }
  }

}
