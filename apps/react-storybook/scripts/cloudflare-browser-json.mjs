/* global window, location */
import { randomUUID } from 'node:crypto';

// Observe the browser's original fetch response, not a CDP body-cache lookup.
// No routing, extra request, retry, replacement payload or cookie mutation.
// Bootstrap may hold the original fetch until document readiness, never replay it.
export async function captureBrowserJson(
  page,
  baseUrl,
  { record = () => {}, gateBootstrap = false } = {}
) {
  const binding = `__velliraJson_${randomUUID().replaceAll('-', '')}`;
  const origin = new URL(baseUrl).origin;
  let active;
  let sequence = 0;
  let latestDocumentId;

  await page.exposeBinding(binding, (source, message) => {
    if (source.frame !== page.mainFrame()) return null;
    if (message.phase === 'document') latestDocumentId = message.documentId;
    if (!active?.armed)
      return gateBootstrap && message.phase === 'start' && message.observationId
        ? { cancelled: true }
        : null;
    if (message.phase === 'document') {
      // A main frame survives reloads; its documents do not. Only the next
      // document may join a navigation observation, never the outgoing one.
      if (message.documentId === active.initialDocumentId) return null;
      if (active.documentScope !== 'next' || active.documentId) {
        active.reject(
          new Error('Observed metrics document changed during action')
        );
        return { cancelled: true };
      }
      active.documentId = message.documentId;
      return { observationId: active.id, deferFetch: active.deferFetch };
    }
    if (
      message.observationId !== active.id ||
      message.documentId !== active.documentId
    )
      return gateBootstrap && message.phase === 'start'
        ? { cancelled: true }
        : null;
    const entry = active.entries.find(
      (item) => item.url === message.url && item.method === message.method
    );
    if (!entry) return null;
    if (message.phase === 'start') {
      if (entry.started) {
        active.reject(
          new Error(`Duplicate observed request: ${entry.method} ${entry.url}`)
        );
        return { cancelled: true };
      }
      entry.started = true;
      record('metrics-request-intent', {
        observationId: active.id,
        url: entry.url,
        method: entry.method,
      });
      const run = active;
      const selected = {
        id: entry.id,
        timeout: entry.timeout,
        observationId: run.id,
      };
      if (run.deferFetch) {
        return run.ready.then((ready) =>
          ready && active === run ? selected : { cancelled: true }
        );
      }
      return selected;
    }
    // A late completion from an earlier action must not satisfy a new waiter.
    if (message.id !== entry.id) return null;
    entry.completed = true;
    entry.response = message.error
      ? { error: message.error }
      : { status: message.status, payload: message.payload };
    record('metrics-response', {
      observationId: active.id,
      url: entry.url,
      method: entry.method,
      ...entry.response,
    });
    if (message.error) entry.reject(new Error(message.error));
    else entry.resolve(entry.response);
    return null;
  });

  const install = ({ binding, origin, gateBootstrap }) => {
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
    // Each selected request awaits its ticket, so even an inline bootstrap that
    // runs before the binding reply cannot pass the readiness gate.
    state.deferFetch = gateBootstrap;
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
          observation?.cancelled
            ? { cancelled: true }
            : observation
              ? report({ ...metadata, ...observation, phase: 'start' })
              : null
        )
        .catch(() => null);
      const notify = async (data) => {
        const selected = await ticket;
        if (selected && !selected.cancelled)
          await report({
            ...metadata,
            ...data,
            id: selected.id,
            observationId: selected.observationId,
            phase: 'complete',
          });
      };
      const invoke = () => nativeFetch.apply(this, args);
      const responsePromise = state.deferFetch
        ? ticket.then((selected) => {
            if (selected?.cancelled)
              throw new DOMException(
                'Metrics bootstrap document was not ready',
                'AbortError'
              );
            return invoke();
          })
        : invoke();
      return responsePromise.then(
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
  await page.addInitScript(install, { binding, origin, gateBootstrap });
  // Also support an already-loaded page; subsequent documents use initScript.
  await page.evaluate(install, { binding, origin, gateBootstrap });

  return async function observe(
    requests,
    action,
    timeout = 15_000,
    { document: documentScope = 'current', deferFetchUntilReady = false } = {}
  ) {
    if (active)
      throw new Error('Overlapping metrics observations are not allowed');
    if (!Number.isFinite(timeout) || timeout <= 0)
      throw new Error('Invalid observation timeout');
    if (!['current', 'next'].includes(documentScope))
      throw new Error('Invalid metrics observation document scope');
    if (deferFetchUntilReady && (!gateBootstrap || documentScope !== 'next'))
      throw new Error('Metrics readiness gate requires next-document scope');
    const keys = requests.map(({ url, method }) => `${method} ${url}`);
    if (!requests.length || new Set(keys).size !== requests.length) {
      throw new Error('Expected metrics requests must be nonempty and unique');
    }
    let timer;
    const run = {
      id: ++sequence,
      documentScope,
      armed: false,
      deferFetch: deferFetchUntilReady,
      phase: 'arming',
    };
    run.ready = new Promise((resolve) => {
      run.release = resolve;
    });
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
          // Next-document observation must not evaluate a failed/outgoing
          // document. Its init-script ID is already recorded by the binding.
          run.initialDocumentId =
            documentScope === 'next'
              ? latestDocumentId
              : await page.evaluate(
                  ({ binding, observationId }) => {
                    const state = window[Symbol.for(binding)];
                    if (!state)
                      throw new Error('Metrics observer is not installed');
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
          run.phase = 'document-readiness';
          record('metrics-observation', {
            observationId: run.id,
            phase: run.phase,
          });
          const [, responses] = await Promise.all([
            Promise.resolve()
              .then(action)
              .then((value) => {
                if (active !== run)
                  throw new Error(
                    'Metrics observation expired during readiness'
                  );
                run.phase = 'metrics';
                record('metrics-observation', {
                  observationId: run.id,
                  phase: run.phase,
                });
                run.release(true);
                return value;
              }),
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
                new Error(
                  `Metrics observation timed out during ${run.phase}: ${keys.join(', ')}`
                )
              ),
            timeout
          );
        }),
      ]);
    } catch (error) {
      // Releasing the original requests is a one-way boundary, even if a
      // subsequent browser event has not yet reported the mutation dispatch.
      error.metricsPhase = run.phase;
      throw error;
    } finally {
      clearTimeout(timer);
      run.release(false);
      record('metrics-observation-finish', {
        observationId: run.id,
        phase: run.phase,
        entries: run.entries.map(
          ({ url, method, started, completed, response }) => ({
            url,
            method,
            started,
            completed: Boolean(completed),
            response,
          })
        ),
      });
      active = undefined;
    }
  };
}
