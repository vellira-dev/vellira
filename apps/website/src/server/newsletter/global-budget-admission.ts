// Dormant adapter for the already-tested provider admission seam.
// This module is intentionally not imported by the deployed newsletter handler.
export type NewsletterAdmissionDecision = 'admitted' | 'exhausted' | 'unavailable';

type BudgetStub = {
  fetch: (request: Request) => Promise<Response>;
};

type BudgetNamespace = {
  idFromName: (name: string) => unknown;
  get: (id: unknown) => BudgetStub;
};

type BudgetBindings = {
  NEWSLETTER_GLOBAL_BUDGET_ENABLED?: unknown;
  NEWSLETTER_GLOBAL_BUDGET?: unknown;
};

const ACCOUNT_KEY = 'one-buttondown-account';

export function createNewsletterBudgetAdmission(
  bindings: BudgetBindings
): (() => Promise<NewsletterAdmissionDecision>) | undefined {
  const mode = bindings.NEWSLETTER_GLOBAL_BUDGET_ENABLED;
  if (mode === undefined || mode === '0') return undefined;

  // Unexpected non-OFF modes must not silently bypass admission.
  if (mode !== '1') return async () => 'unavailable';

  return async () => {
    try {
      const namespace = bindings.NEWSLETTER_GLOBAL_BUDGET as
        | BudgetNamespace
        | undefined;
      if (
        !namespace ||
        typeof namespace.idFromName !== 'function' ||
        typeof namespace.get !== 'function'
      ) {
        return 'unavailable';
      }
      const stub = namespace.get(namespace.idFromName(ACCOUNT_KEY));
      if (!stub || typeof stub.fetch !== 'function') return 'unavailable';

      const result = await stub.fetch(
        new Request('https://newsletter-budget.internal/admit', {
          method: 'POST',
        })
      );
      if (result.headers.get('cache-control') !== 'no-store') {
        return 'unavailable';
      }
      const payload: unknown = await result.json();
      if (
        typeof payload !== 'object' ||
        payload === null ||
        Array.isArray(payload)
      ) {
        return 'unavailable';
      }
      const code = (payload as { code?: unknown }).code;
      if (result.status === 200 && code === 'admitted') return 'admitted';
      if (result.status === 429 && code === 'rate_limited') {
        return 'exhausted';
      }
      return 'unavailable';
    } catch {
      return 'unavailable';
    }
  };
}
