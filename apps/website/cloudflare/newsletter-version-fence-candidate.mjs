import { transitionFixedUtcBudget } from './newsletter-fixed-utc-migration.mjs';
import { admitRollingNewsletterAttempt } from './newsletter-rolling-window-model.mjs';
import { rollingBudgetResponse } from './newsletter-rolling-response.mjs';

// Test-only *cooperative* version protocol; never exported by the real owner.
// Existing unmodified rolling-v1 code DOES NOT read this fence. Remote
// deployment must replace all legacy writers before this proof can apply.
const VERSION_KEY = 'newsletter-coordinator-version-v1';

export class NewsletterVersionFenceCandidate {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  now() {
    return Date.now();
  }

  async reserve(request, version, capacity) {
    return this.ctx.storage.transaction(async (txn) => {
      const marker = await txn.get(VERSION_KEY);
      if (marker !== undefined && marker !== 'legacy' && marker !== 'fixed') {
        return 'unavailable';
      }

      if (version === 'legacy') {
        // The new version permanently supersedes all cooperative legacy calls.
        if (marker === 'fixed') return 'unavailable';
        // Reject an inconsistent partial cutover, even without the marker.
        if ((await txn.get('fixed-utc-v1')) !== undefined) return 'unavailable';
        const persisted = await txn.get('rolling-v1');
        const state =
          persisted === undefined ? { attempts: [], lastSeen: 0 } : persisted;
        const result = admitRollingNewsletterAttempt(
          state,
          capacity,
          this.now(request)
        );
        if (result.outcome === 'unavailable') return result.outcome;
        await txn.put('rolling-v1', result.next);
        if (marker === undefined) await txn.put(VERSION_KEY, 'legacy');
        return result.outcome;
      }

      if (marker === 'fixed') {
        const fixed = await txn.get('fixed-utc-v1');
        if (fixed === undefined) return 'unavailable';
        const result = transitionFixedUtcBudget({
          fixed,
          legacy: undefined,
          capacity,
          now: this.now(request),
        });
        if (result.persist) await txn.put('fixed-utc-v1', result.next);
        return result.outcome;
      }

      // A cooperative legacy writer must not run after this transaction
      // commits. The first transition always consumes today's entire budget.
      const fixed = await txn.get('fixed-utc-v1');
      const legacy = await txn.get('rolling-v1');
      const result = transitionFixedUtcBudget({
        fixed,
        legacy,
        capacity,
        now: this.now(request),
      });
      if (!result.persist) return 'unavailable';
      await txn.put('fixed-utc-v1', result.next);
      await txn.put(VERSION_KEY, 'fixed');
      return result.outcome;
    });
  }

  async fetch(request) {
    const route = new globalThis.URL(request.url).pathname;
    const version = route === '/admit/legacy'
      ? 'legacy'
      : route === '/admit/fixed'
        ? 'fixed'
        : null;
    if (request.method !== 'POST' || !version) {
      return new globalThis.Response(null, { status: 404 });
    }
    const capacity = Number(this.env.NEWSLETTER_GLOBAL_BUDGET_CAPACITY);
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      return rollingBudgetResponse('unavailable');
    }
    try {
      const result = await this.reserve(request, version, capacity);
      return rollingBudgetResponse(result);
    } catch {
      return rollingBudgetResponse('unavailable');
    }
  }
}
