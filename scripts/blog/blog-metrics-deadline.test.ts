import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';

import {
  fetchBlogArticleLike,
  fetchBlogMetrics,
  fetchBlogMetricsBatch,
  likeBlogArticle,
  registerBlogArticleView,
  unlikeBlogArticle,
} from '../../apps/website/src/blog/metrics';

const operations = [
  {
    name: 'batch read',
    run: () => fetchBlogMetricsBatch(['known', 'new']),
    retries: 1,
  },
  { name: 'single read', run: () => fetchBlogMetrics('known'), retries: 1 },
  { name: 'actor read', run: () => fetchBlogArticleLike('known'), retries: 1 },
  { name: 'like', run: () => likeBlogArticle('known'), retries: 0 },
  { name: 'unlike', run: () => unlikeBlogArticle('known'), retries: 0 },
  { name: 'view', run: () => registerBlogArticleView('known'), retries: 0 },
];

function stalledBody(status: number, cancel = vi.fn()) {
  return {
    cancel,
    response: new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"error":'));
        },
        cancel,
      }),
      { status }
    ),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Blog metrics request deadlines', () => {
  for (const operation of operations) {
    for (const status of [404, 200]) {
      it(`${operation.name}: cancels stalled ${status}, no retry`, async () => {
        vi.useFakeTimers();
        const stalled = stalledBody(status);
        const signals: AbortSignal[] = [];
        const fetchMock = vi.fn(
          async (_url: RequestInfo | URL, init: RequestInit) => {
            signals.push(init.signal as AbortSignal);
            return stalled.response;
          }
        );
        vi.stubGlobal('fetch', fetchMock);

        const rejected = assert.rejects(operation.run(), /timed out/);
        await vi.advanceTimersByTimeAsync(5_000);
        await rejected;

        assert.equal(fetchMock.mock.calls.length, 1);
        assert.equal(signals[0]?.aborted, true);
        assert.equal(stalled.cancel.mock.calls.length, 1);
        assert.equal(vi.getTimerCount(), 0);
      });
    }

    it(`${operation.name}: rejects stalled 503 immediately`, async () => {
      const bodies: ReturnType<typeof stalledBody>[] = [];
      const fetchMock = vi.fn(async () => {
        const stalled = stalledBody(503);
        bodies.push(stalled);
        return stalled.response;
      });
      vi.stubGlobal('fetch', fetchMock);

      await assert.rejects(operation.run(), /503/);
      assert.equal(fetchMock.mock.calls.length, operation.retries + 1);
      assert.ok(bodies.every(({ cancel }) => cancel.mock.calls.length === 1));
    });

    it(`${operation.name}: bounds missing headers`, async () => {
      vi.useFakeTimers();
      const signals: AbortSignal[] = [];
      const fetchMock = vi.fn((_url: RequestInfo | URL, init: RequestInit) => {
        signals.push(init.signal as AbortSignal);
        return new Promise<Response>(() => undefined);
      });
      vi.stubGlobal('fetch', fetchMock);

      const rejected = assert.rejects(operation.run(), /timed out/);
      await vi.advanceTimersByTimeAsync(5_000);
      await rejected;
      assert.equal(fetchMock.mock.calls.length, 1);
      assert.equal(signals[0]?.aborted, true);
      assert.equal(vi.getTimerCount(), 0);
    });
  }

  it('does not wait for cancellation acknowledgement', async () => {
    vi.useFakeTimers();
    const stalled = stalledBody(
      404,
      vi.fn(() => new Promise<void>(() => undefined))
    );
    vi.stubGlobal('fetch', vi.fn(async () => stalled.response));
    const rejected = assert.rejects(
      fetchBlogMetricsBatch(['known']),
      /timed out/
    );
    await vi.advanceTimersByTimeAsync(5_000);
    await rejected;
    assert.equal(stalled.cancel.mock.calls.length, 1);
    assert.equal(vi.getTimerCount(), 0);
  });

  it('cancels late responses without accepting them or isolating slugs', async () => {
    vi.useFakeTimers();
    let finish: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const rejected = assert.rejects(
      fetchBlogMetricsBatch(['known', 'new']),
      /timed out/
    );
    await vi.advanceTimersByTimeAsync(5_000);
    await rejected;
    const stalled = stalledBody(404);
    finish?.(stalled.response);
    await vi.advanceTimersByTimeAsync(0);
    assert.equal(stalled.cancel.mock.calls.length, 1);
    assert.equal(fetchMock.mock.calls.length, 1);
    assert.equal(vi.getTimerCount(), 0);
  });

  it('clears its deadline after a successful response', async () => {
    vi.useFakeTimers();
    const metrics = { slug: 'known', views: 9, likes: 2 };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(metrics)))
    );
    assert.deepEqual(await fetchBlogMetrics('known'), metrics);
    assert.equal(vi.getTimerCount(), 0);
  });

  it('decodes JSON split across UTF-8 byte boundaries', async () => {
    const metrics = { slug: 'known', views: 9, likes: 2, ignored: 'é' };
    const bytes = new TextEncoder().encode(JSON.stringify(metrics));
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                for (const byte of bytes) {
                  controller.enqueue(new Uint8Array([byte]));
                }
                controller.close();
              },
            })
          )
      )
    );
    assert.deepEqual(await fetchBlogMetrics('known'), {
      slug: 'known',
      views: 9,
      likes: 2,
    });
  });
});
