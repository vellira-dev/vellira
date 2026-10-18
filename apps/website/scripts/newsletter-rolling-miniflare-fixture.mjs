// Local-only test Worker: not referenced by any deployment configuration.
export { NewsletterRollingBudgetCoordinator } from '../cloudflare/newsletter-rolling-budget-coordinator.mjs';

export default {
  fetch(request, env) {
    return env.TEST_ROLLING_BUDGET.getByName('one-buttondown-account').fetch(request);
  },
};
