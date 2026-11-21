import { transitionFixedUtcBudget } from './newsletter-fixed-utc-migration.mjs';
import { rollingBudgetResponse } from './newsletter-rolling-response.mjs';

function isAdmissionRequest(request) {
  return (
    request.method === 'POST' &&
    new globalThis.URL(request.url).pathname === '/admit'
  );
}

function parseBudgetCapacity(env) {
  const value = Number(env.NEWSLETTER_GLOBAL_BUDGET_CAPACITY);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

// Isolated candidate, never exported by the deployed owner Worker.
// Migration fencing and reservation updates are committed in one transaction.
export class NewsletterFixedUtcTransactionalCandidate {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  now() {
    return Date.now();
  }

  async reserve(capacity, request) {
    return this.ctx.storage.transaction(async (txn) => {
      const [fixed, legacy] = await Promise.all([
        txn.get('fixed-utc-v1'),
        txn.get('rolling-v1'),
      ]);
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
  }

  async fetch(request) {
    if (!isAdmissionRequest(request)) {
      return new globalThis.Response(null, { status: 404 });
    }

    const capacity = parseBudgetCapacity(this.env);
    if (capacity === null) return rollingBudgetResponse('unavailable');

    let decision = 'unavailable';
    try {
      // Never report an admission before the durable transaction resolves.
      decision = await this.reserve(capacity, request);
    } catch {
      // Includes persistence failures and transaction commit exceptions.
    }
    return rollingBudgetResponse(decision);
  }
}

// A legacy rolling-v1 writer is not excluded by this candidate alone.
// Remote cutover still requires a single active coordinator version.
