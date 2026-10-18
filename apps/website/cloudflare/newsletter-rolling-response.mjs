// Shared response contract for candidate budget coordinators.
export function rollingBudgetResponse(outcome) {
  const status = outcome === 'admitted' ? 200 : outcome === 'exhausted' ? 429 : 503;
  const code =
    outcome === 'admitted'
      ? 'admitted'
      : outcome === 'exhausted'
        ? 'rate_limited'
        : 'unavailable';
  return globalThis.Response.json(
    { ok: status === 200, code },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}
