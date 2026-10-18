// Local-only Miniflare entry. It is not referenced by any deploy configuration.
export { NewsletterBudgetCoordinator } from '../cloudflare/newsletter-budget-coordinator.mjs';

export default {
  fetch(request, env) {
    const stub = env.TEST_NEWSLETTER_BUDGET.getByName('one-buttondown-account');
    return stub.fetch(request);
  },
};
