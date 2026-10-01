import { randomUUID } from 'node:crypto';

// Observe the browser's original fetch response, not a CDP body-cache lookup.
// No routing, extra request, retry, replacement payload or cookie mutation.
export async function captureBrowserJson(page, baseUrl) {
  const binding = `__velliraJson_${randomUUID().replaceAll('-', '')}`;
  const origin = new URL(baseUrl).origin;
  let active;
  let sequence = 0;
  let rejectRun;

  await page.exposeBinding(binding, (source, message) => {
    if (source.frame !== page.mainFrame() || !active) return null;
    const entry = active.find(
      (item) => item.url === message.url && item.method === message.method
    );
    if (!entry) return null;
    if (message.phase === 'start') {
      if (entry.started) {
        rejectRun(
          new Error(`Duplicate observed request: ${entry.method} ${entry.url}`)
        );
        return null;
      }
      entry.started = true;
      return { id: entry.id, timeout: entry.timeout };
    }
    // A late completion from an earlier action must not satisfy a new waiter.
    if (message.id !== entry.id) return null;
    if (message.error) entry.reject(new Error(message.error));
    else entry.resolve({ status: message.status, payload: message.payload });
    return null;
  });

  const install = ({ binding, origin }) => {
    const nativeFetch = window.fetch;
    const report = window[binding];
    window.fetch = function (...args) {
      const [input, init] = args;
      const url = new URL(
        input instanceof Request ? input.url : input,
        location.href
      );
      const method = String(
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();
      if (
        url.origin !== origin ||
        !/^\/api\/blog-metrics\/articles\/[^/]+\/(?:like|views)$/.test(
          url.pathname
        )
      ) {
        return nativeFetch.apply(this, args);
      }
      const metadata = { url: url.href, method };
      const ticket = report({ ...metadata, phase: 'start' }).catch(() => null);
      const notify = async (data) => {
        const selected = await ticket;
        if (selected)
          await report({
            ...metadata,
            ...data,
            id: selected.id,
            phase: 'complete',
          });
      };
      return nativeFetch.apply(this, args).then(
        (response) => {
          // Clone before returning the original, which the application may stream.
          const copy = response.clone();
          void (async () => {
            const selected = await ticket;
            if (!selected) {
              void copy.body?.cancel().catch(() => {});
              return;
            }
            // A redirect chain can end at its original URL (A -> B -> A).
            if (response.redirected || response.url !== url.href) {
              void copy.body?.cancel().catch(() => {});
              throw new Error('Observed metrics response was redirected');
            }
            const reader = copy.body?.getReader();
            if (!reader)
              throw new Error('Observed metrics response has no body');
            let timer;
            let bytes = 0;
            let text = '';
            const decoder = new TextDecoder();
            try {
              const payload = await Promise.race([
                new Promise((_, reject) => {
                  timer = setTimeout(() => {
                    reject(new Error('Observed metrics body timed out'));
                    void reader.cancel().catch(() => {});
                  }, selected.timeout);
                }),
                (async () => {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) return JSON.parse(text + decoder.decode());
                    bytes += value.byteLength;
                    if (bytes > 128 * 1024)
                      throw new Error('Observed metrics body exceeds 128 KiB');
                    text += decoder.decode(value, { stream: true });
                  }
                })(),
              ]);
              await notify({ status: response.status, payload });
            } finally {
              clearTimeout(timer);
              // Never abort the application's branch or await tee cancellation.
              void reader.cancel().catch(() => {});
            }
          })().catch((error) =>
            notify({ error: String(error) }).catch(() => {})
          );
          return response;
        },
        (error) => {
          void notify({ error: String(error) }).catch(() => {});
          throw error;
        }
      );
    };
  };
  await page.addInitScript(install, { binding, origin });
  // Also support an already-loaded page; subsequent documents use initScript.
  await page.evaluate(install, { binding, origin });

  return async function observe(requests, action, timeout = 15_000) {
    if (active)
      throw new Error('Overlapping metrics observations are not allowed');
    if (!Number.isFinite(timeout) || timeout <= 0)
      throw new Error('Invalid observation timeout');
    const keys = requests.map(({ url, method }) => `${method} ${url}`);
    if (!requests.length || new Set(keys).size !== requests.length) {
      throw new Error('Expected metrics requests must be nonempty and unique');
    }
    let timer;
    active = requests.map(({ url, method }) => {
      const entry = { url, method, timeout, id: ++sequence, started: false };
      entry.promise = new Promise((resolve, reject) => {
        entry.resolve = resolve;
        entry.reject = reject;
      });
      return entry;
    });
    const results = Promise.all(active.map((entry) => entry.promise));
    try {
      const [, responses] = await Promise.race([
        new Promise((_, reject) => {
          rejectRun = reject;
        }),
        Promise.all([Promise.resolve().then(action), results]),
        new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(`Metrics observation timed out: ${keys.join(', ')}`)
              ),
            timeout
          );
        }),
      ]);
      return responses;
    } finally {
      clearTimeout(timer);
      active = undefined;
      rejectRun = undefined;
    }
  };
}
