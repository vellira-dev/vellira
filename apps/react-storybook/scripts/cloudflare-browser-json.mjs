import { randomUUID } from 'node:crypto';

// Observe the browser's original fetch response, not a CDP body-cache lookup.
// No routing, extra request, retry, replacement payload or cookie mutation.
export async function captureBrowserJson(page, baseUrl) {
  const binding = `__velliraJson_${randomUUID().replaceAll('-', '')}`;
  const origin = new URL(baseUrl).origin;
  let active;
  let sequence = 0;

  await page.exposeBinding(binding, (source, message) => {
    if (source.frame !== page.mainFrame() || !active?.armed) return null;
    if (message.phase === 'document') {
      // A main frame survives reloads; its documents do not. Only the next
      // document may join a navigation observation, never the outgoing one.
      if (message.documentId === active.initialDocumentId) return null;
      if (active.documentScope !== 'next' || active.documentId) {
        active.reject(
          new Error('Observed metrics document changed during action')
        );
        return null;
      }
      active.documentId = message.documentId;
      return { observationId: active.id };
    }
    if (
      message.observationId !== active.id ||
      message.documentId !== active.documentId
    )
      return null;
    const entry = active.entries.find(
      (item) => item.url === message.url && item.method === message.method
    );
    if (!entry) return null;
    if (message.phase === 'start') {
      if (entry.started) {
        active.reject(
          new Error(`Duplicate observed request: ${entry.method} ${entry.url}`)
        );
        return null;
      }
      entry.started = true;
      return { id: entry.id, timeout: entry.timeout, observationId: active.id };
    }
    // A late completion from an earlier action must not satisfy a new waiter.
    if (message.id !== entry.id) return null;
    if (message.error) entry.reject(new Error(message.error));
    else entry.resolve({ status: message.status, payload: message.payload });
    return null;
  });

  const install = ({ binding, origin }) => {
    const key = Symbol.for(binding);
    if (window[key]) return;
    const nativeFetch = window.fetch;
    const report = window[binding];
    const documentId = Array.from(
      crypto.getRandomValues(new Uint32Array(4))
    ).join('-');
    const state = { documentId };
    window[key] = state;
    state.observation = report({ phase: 'document', documentId }).catch(
      () => null
    );
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
      const metadata = { url: url.href, method, documentId };
      // Snapshot the observation at fetch invocation. A queued start from an
      // earlier action must not acquire a later action's ticket.
      const ticket = state.observation
        .then((observation) =>
          observation
            ? report({ ...metadata, ...observation, phase: 'start' })
            : null
        )
        .catch(() => null);
      const notify = async (data) => {
        const selected = await ticket;
        if (selected)
          await report({
            ...metadata,
            ...data,
            id: selected.id,
            observationId: selected.observationId,
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

  return async function observe(
    requests,
    action,
    timeout = 15_000,
    { document: documentScope = 'current' } = {}
  ) {
    if (active)
      throw new Error('Overlapping metrics observations are not allowed');
    if (!Number.isFinite(timeout) || timeout <= 0)
      throw new Error('Invalid observation timeout');
    if (!['current', 'next'].includes(documentScope))
      throw new Error('Invalid metrics observation document scope');
    const keys = requests.map(({ url, method }) => `${method} ${url}`);
    if (!requests.length || new Set(keys).size !== requests.length) {
      throw new Error('Expected metrics requests must be nonempty and unique');
    }
    let timer;
    const run = { id: ++sequence, documentScope, armed: false };
    // Lock before the first await, including document arming in the deadline.
    active = run;
    run.entries = requests.map(({ url, method }) => {
      const entry = { url, method, timeout, id: ++sequence, started: false };
      entry.promise = new Promise((resolve, reject) => {
        entry.resolve = resolve;
        entry.reject = reject;
      });
      return entry;
    });
    const results = Promise.all(run.entries.map((entry) => entry.promise));
    const failed = new Promise((_, reject) => {
      run.reject = reject;
    });
    try {
      return await Promise.race([
        failed,
        (async () => {
          run.initialDocumentId = await page.evaluate(
            ({ binding, observationId }) => {
              const state = window[Symbol.for(binding)];
              if (!state) throw new Error('Metrics observer is not installed');
              state.observation = Promise.resolve(
                observationId === null ? null : { observationId }
              );
              return state.documentId;
            },
            {
              binding,
              observationId: documentScope === 'current' ? run.id : null,
            }
          );
          // Arming may complete after the deadline; it must not run the action.
          if (active !== run)
            throw new Error('Metrics observation expired while arming');
          if (documentScope === 'current')
            run.documentId = run.initialDocumentId;
          run.armed = true;
          const [, responses] = await Promise.all([
            Promise.resolve().then(action),
            results,
          ]);
          const finalDocumentId = await page.evaluate(
            (binding) => window[Symbol.for(binding)]?.documentId,
            binding
          );
          if (!run.documentId || finalDocumentId !== run.documentId)
            throw new Error('Observed metrics document changed during action');
          return responses;
        })(),
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
    } finally {
      clearTimeout(timer);
      active = undefined;
    }
  };
}
