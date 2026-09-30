import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'vitest';

import {
  fetchBlogMetrics,
  fetchBlogMetricsBatch,
  likeBlogArticle,
  registerBlogArticleView,
  type BlogMetrics,
} from '../../apps/website/src/blog/metrics';

const originalFetch = globalThis.fetch;

interface RecordedRequest {
  url: URL;
  init?: RequestInit;
}

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installBackend(
  handler: (request: RecordedRequest) => Response | Promise<Response>
): RecordedRequest[] {
  const calls: RecordedRequest[] = [];
  globalThis.fetch = async (input, init) => {
    const request = {
      url: new URL(input.toString(), 'https://website.example'),
      init,
    };
    calls.push(request);
    return handler(request);
  };
  return calls;
}

const missingArticle = () =>
  response({ error: { code: 'article_not_found' } }, 404);

function metric(slug: string, index = 1): BlogMetrics {
  return { slug, views: index * 12, likes: index * 3 };
}

function installCatalog(catalog: Record<string, BlogMetrics>) {
  return installBackend(({ url }) => {
    const slugs = url.searchParams.getAll('slug');
    return slugs.some((slug) => !Object.hasOwn(catalog, slug))
      ? missingArticle()
      : response({ items: slugs.map((slug) => catalog[slug]) });
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Blog metrics catalog isolation', () => {
  it('keeps one uncached same-origin batch on the healthy path', async () => {
    const catalog = {
      first: metric('first'),
      second: metric('second', 2),
    };
    const calls = installCatalog(catalog);
    assert.deepEqual(await fetchBlogMetricsBatch(['first', 'second']), catalog);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url.pathname, '/api/blog-metrics/metrics');
    const { signal, ...request } = calls[0]?.init ?? {};
    assert.ok(signal instanceof AbortSignal);
    assert.equal(signal.aborted, false);
    assert.deepEqual(request, {
      credentials: 'include',
      cache: 'no-store',
    });
  });

  it('retains real counts when one candidate is not in the backend catalog', async () => {
    const catalog = {
      first: metric('first'),
      second: metric('second', 2),
    };
    const calls = installCatalog(catalog);
    const result = await fetchBlogMetricsBatch([
      'first',
      'candidate',
      'second',
    ]);
    assert.deepEqual(result, catalog);
    assert.equal(Object.hasOwn(result, 'candidate'), false);
    assert.ok(calls.length <= 5);
    for (const { url, init } of calls) {
      assert.equal(url.pathname, '/api/blog-metrics/metrics');
      assert.equal(init?.credentials, 'include');
      assert.equal(init?.cache, 'no-store');
      assert.equal(init?.method, undefined);
    }
  });

  it('covers every missing-slug combination without fabricating zero counts', async () => {
    const slugs = ['first', 'second', 'third', 'fourth'];
    for (let mask = 0; mask < 2 ** slugs.length; mask += 1) {
      const catalog = Object.fromEntries(
        slugs.flatMap((slug, index) =>
          mask & (1 << index) ? [] : [[slug, metric(slug, index + 1)]]
        )
      );
      const calls = installCatalog(catalog);
      assert.deepEqual(await fetchBlogMetricsBatch(slugs), catalog);
      assert.ok(calls.length <= 2 * slugs.length - 1);
    }
  });

  it('preserves an authoritative zero instead of treating it as unavailable', async () => {
    const catalog = { first: { slug: 'first', views: 0, likes: 0 } };
    installCatalog(catalog);
    assert.deepEqual(
      await fetchBlogMetricsBatch(['first', 'candidate']),
      catalog
    );
  });

  it('deduplicates slugs and does not fetch an empty set', async () => {
    const calls = installCatalog({ first: metric('first') });
    assert.deepEqual(await fetchBlogMetricsBatch([]), {});
    assert.equal(calls.length, 0);
    await fetchBlogMetricsBatch(['first', 'first']);
    assert.deepEqual(calls[0]?.url.searchParams.getAll('slug'), ['first']);
    assert.equal(calls.length, 1);
  });

  it('does not retry a singleton catalog miss', async () => {
    const calls = installCatalog({});
    assert.deepEqual(await fetchBlogMetricsBatch(['candidate']), {});
    assert.equal(calls.length, 1);
  });

  it('does not fan out or silently succeed for unrelated HTTP failures', async () => {
    for (const status of [400, 401, 403, 404, 429, 500, 503]) {
      const calls = installBackend(() =>
        response({ error: { code: 'other' } }, status)
      );
      await assert.rejects(fetchBlogMetricsBatch(['first', 'second']));
      assert.equal(calls.length, 2);
      assert.ok(
        calls.every(({ url }) => url.searchParams.getAll('slug').length === 2)
      );
    }
  });

  it('requires both the exact status and structured backend error code', async () => {
    for (const payload of [
      {},
      { error: 'article_not_found' },
      { code: 'article_not_found' },
    ]) {
      const calls = installBackend(() => response(payload, 404));
      await assert.rejects(fetchBlogMetricsBatch(['first', 'second']));
      assert.equal(calls.length, 2);
    }
    const calls = installBackend(() =>
      response({ error: { code: 'article_not_found' } }, 503)
    );
    await assert.rejects(fetchBlogMetricsBatch(['first', 'second']));
    assert.equal(calls.length, 2);
  });

  it('does not disguise HTML errors or network failures as catalog lag', async () => {
    let calls = installBackend(
      () => new Response('<html>Not found</html>', { status: 404 })
    );
    await assert.rejects(fetchBlogMetricsBatch(['first', 'second']));
    assert.equal(calls.length, 2);
    calls = installBackend(() => {
      throw new TypeError('Network unavailable');
    });
    await assert.rejects(
      fetchBlogMetricsBatch(['first', 'second']),
      /Network unavailable/
    );
    assert.equal(calls.length, 2);
  });

  it('rejects malformed successful metrics rather than recovering them as missing', async () => {
    for (const payload of [{}, { items: [metric('first', -1)] }]) {
      const calls = installBackend(() => response(payload));
      await assert.rejects(
        fetchBlogMetricsBatch(['first', 'second']),
        /Invalid blog metrics/
      );
      assert.equal(calls.length, 1);
    }
  });

  it('propagates an outage encountered during catalog isolation', async () => {
    const calls = installBackend(({ url }) =>
      url.searchParams.getAll('slug').length === 2
        ? missingArticle()
        : response({ error: { code: 'catalog_unavailable' } }, 503)
    );
    await assert.rejects(fetchBlogMetricsBatch(['first', 'candidate']), /503/);
    assert.equal(calls.length, 3);
  });

  it('keeps per-article reads and mutations fail-closed without write retries', async () => {
    for (const request of [
      fetchBlogMetrics,
      likeBlogArticle,
      registerBlogArticleView,
    ]) {
      const calls = installBackend(missingArticle);
      await assert.rejects(request('candidate'), /404/);
      assert.equal(calls.length, 1);
    }
  });

  it('keeps fallback requests sequential', async () => {
    let active = 0;
    let maximum = 0;
    installBackend(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return missingArticle();
    });
    assert.deepEqual(
      await fetchBlogMetricsBatch(['first', 'second', 'third']),
      {}
    );
    assert.equal(maximum, 1);
  });
});
