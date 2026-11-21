import { transitionFixedUtcBudget } from './newsletter-fixed-utc-migration.mjs';
import { rollingBudgetResponse } from './newsletter-rolling-response.mjs';

// Isolated candidate, never exported by the deployed owner Worker.
// All reads, migration fencing and writes occur in ONE Durable Object
// transaction. A successful permit is returned only after commit.
export class NewsletterFixedUtcTransactionalCandidate {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  now() {
    return Date.now();
  }

  async fetch(request) {
    if (
      request.method !== 'POST' ||
      new URL(request.url).pathname !== '/admit'
    ) {
      return new Response(null, { status: 404 });
    }

    const capacity = Number(this.env.NEWSLETTER_GLOBAL_BUDGET_CAPACITY);
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      return rollingBudgetResponse('unavailable');
    }

    try {
      const outcome = await this.ctx.storage.transaction(async (txn) => {
        const fixed = await txn.get('fixed-utc-v1');
        const legacy = await txn.get('rolling-v1');
        const result = transitionFixedUtcBudget({
          fixed,
          legacy,
          capacity,
          now: this.now(request),
        });
        if (result.persist) {
          await txn.put('fixed-utc-v1', result.next);
        }
        return result.outcome;
      });
      return rollingBudgetResponse(outcome);
    } catch {
      return rollingBudgetResponse('unavailable');
    }
  }
}

// IMPORTANT: This does not exclude an older deployed rolling-v1 writer.
// Real cutover requires exclusive owner-version activation and rollback fencing.
