// Dedicated future Durable Object owner entrypoint (not deployed or bound).
// No public routes and no Buttondown credentials or provider requests.
export { NewsletterBudgetCoordinator } from './newsletter-budget-coordinator.mjs';

export default {
  fetch() {
    return new globalThis.Response(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  },
};
