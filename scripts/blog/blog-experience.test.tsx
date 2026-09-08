// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import type React from 'react';
import { StrictMode } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BlogArticleActions,
  BlogArticleView,
  BlogIndex,
} from '../../apps/website/src/blog/ui';
import type {
  BlogArticle,
  BlogArticleMetadata,
} from '../../apps/website/src/blog';
import {
  fetchBlogMetricsBatch,
  type BlogMetrics,
} from '../../apps/website/src/blog/metrics';

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function createMetrics(slug: string, overrides: Partial<BlogMetrics> = {}) {
  return {
    slug,
    views: 12,
    likes: 3,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function installArticleMetricsFetch(
  handler: (call: FetchCall) => Response | Promise<Response>
) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = {
        url: input.toString(),
        init,
      };
      calls.push(call);

      return handler(call);
    }
  );

  vi.stubGlobal('fetch', fetchMock);

  return { calls, fetchMock };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.doUnmock('@/blog');
  vi.doUnmock('@/blog/metrics');
  vi.doUnmock('@/blog/ui');
});

function createMetadata(
  overrides: Partial<BlogArticleMetadata> = {}
): BlogArticleMetadata {
  return {
    title: 'Building reliable component APIs',
    description: 'A practical article about component API design.',
    slug: 'building-reliable-component-apis',
    publishedAt: '2026-09-01',
    author: 'Roman Bakurov',
    tags: ['Design Systems', 'TypeScript'],
    draft: false,
    ...overrides,
  };
}

describe('Blog V1 index experience', () => {
  it('renders an explicit empty state when there are no published articles', () => {
    const html = renderToStaticMarkup(<BlogIndex articles={[]} />);

    expect(html).toContain('Publishing soon');
    expect(html).toContain('The foundation is ready.');
    expect(html).not.toContain('/blog/building-reliable-component-apis');
  });

  it('renders published article metadata and stable article links', () => {
    const html = renderToStaticMarkup(
      <BlogIndex articles={[createMetadata()]} />
    );

    expect(html).toContain('Building reliable component APIs');
    expect(html).toContain('September 1, 2026');
    expect(html).toContain('Roman Bakurov');
    expect(html).toContain('Design Systems');
    expect(html).toContain('href="/blog/building-reliable-component-apis"');
  });

  it('renders accessible card metrics when batch metrics are available', () => {
    const article = createMetadata();
    const html = renderToStaticMarkup(
      <BlogIndex
        articles={[article]}
        metricsBySlug={{
          [article.slug]: createMetrics(article.slug, {
            views: 1234,
            likes: 56,
          }),
        }}
      />
    );

    expect(html).toContain('aria-label="1,234 views"');
    expect(html).toContain('aria-label="56 likes"');
  });

  it('hydrates actor liked state for blog card metrics', async () => {
    const article = createMetadata({ slug: 'two-runtimes' });

    const { calls } = installArticleMetricsFetch((call) => {
      if (
        call.url.endsWith('/api/blog-metrics/articles/two-runtimes/like') &&
        !call.init?.method
      ) {
        return jsonResponse({
          slug: 'two-runtimes',
          liked: true,
        });
      }

      return jsonResponse({}, 404);
    });

    render(
      <BlogIndex
        articles={[article]}
        metricsBySlug={{
          [article.slug]: createMetrics(article.slug, {
            views: 2,
            likes: 1,
          }),
        }}
      />
    );

    await waitFor(() =>
      expect(screen.getByLabelText('1 likes, liked by you')).toBeInTheDocument()
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain(
      '/api/blog-metrics/articles/two-runtimes/like'
    );
    expect(calls[0]?.init?.credentials).toBe('include');
  });

  it('does not display fake zero metrics when card metrics are unavailable', () => {
    const html = renderToStaticMarkup(
      <BlogIndex articles={[createMetadata()]} metricsBySlug={{}} />
    );

    expect(html).not.toContain('aria-label="0 views"');
    expect(html).not.toContain('aria-label="0 likes"');
  });

  it('does not register views when blog cards render', () => {
    const { fetchMock } = installArticleMetricsFetch(() =>
      jsonResponse({ items: [] })
    );

    renderToStaticMarkup(
      <BlogIndex
        articles={[createMetadata()]}
        metricsBySlug={{
          'building-reliable-component-apis': createMetrics(
            'building-reliable-component-apis'
          ),
        }}
      />
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches /blog metrics with one client batch request for all article slugs', async () => {
    const articles = [
      createMetadata({ slug: 'one-runtime' }),
      createMetadata({ slug: 'two-runtimes' }),
    ];

    const { calls } = installArticleMetricsFetch((call) => {
      if (call.url.includes('/v1/blog/metrics?')) {
        return jsonResponse({
          items: [createMetrics('one-runtime'), createMetrics('two-runtimes')],
        });
      }

      if (call.url.endsWith('/like') && !call.init?.method) {
        const slug = call.url.includes('one-runtime')
          ? 'one-runtime'
          : 'two-runtimes';

        return jsonResponse({
          slug,
          liked: false,
        });
      }

      return jsonResponse({}, 404);
    });

    render(<BlogIndex articles={articles} />);

    await waitFor(() =>
      expect(screen.getAllByLabelText('12 views')).toHaveLength(2)
    );

    const batchCalls = calls.filter((call) =>
      call.url.includes('/v1/blog/metrics?')
    );

    expect(batchCalls).toHaveLength(1);
    expect(batchCalls[0]?.url).toContain('slug=one-runtime');
    expect(batchCalls[0]?.url).toContain('slug=two-runtimes');
  });

  it('retries a failed batch metrics read once with the same slug set', async () => {
    const { calls } = installArticleMetricsFetch(() => {
      if (calls.length === 1) {
        return jsonResponse({}, 503);
      }

      return jsonResponse({
        items: [
          createMetrics('one-runtime', { views: 7, likes: 1 }),
          createMetrics('two-runtimes', { views: 9, likes: 2 }),
        ],
      });
    });

    const metrics = await fetchBlogMetricsBatch([
      'one-runtime',
      'two-runtimes',
    ]);

    expect(metrics).toEqual({
      'one-runtime': createMetrics('one-runtime', { views: 7, likes: 1 }),
      'two-runtimes': createMetrics('two-runtimes', { views: 9, likes: 2 }),
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toContain('/v1/blog/metrics?');
    expect(calls[0]?.url).toBe(calls[1]?.url);
  });
});

describe('Blog V1 article experience', () => {
  it('renders semantic article metadata, content, and back navigation', () => {
    function Content() {
      return (
        <>
          <h2>Shared contracts</h2>
          <p>Article body.</p>
          <pre>
            <code>{'const platform = "web";'}</code>
          </pre>
        </>
      );
    }

    const article: BlogArticle = {
      metadata: createMetadata({ updatedAt: '2026-09-02' }),
      Content,
    };
    const html = renderToStaticMarkup(<BlogArticleView article={article} />);

    expect(html).toContain('href="/blog"');
    expect(html).toContain('Building reliable component APIs');
    expect(html).toContain('Published');
    expect(html).toContain('September 1, 2026');
    expect(html).toContain('Updated');
    expect(html).toContain('September 2, 2026');
    expect(html).toContain('<h2>Shared contracts</h2>');
    expect(html).toContain('const platform = &quot;web&quot;;');
  });

  it('loads article metrics and registers a view from the client experience', async () => {
    const { calls } = installArticleMetricsFetch((call) => {
      if (call.url.endsWith('/v1/blog/metrics/two-runtimes')) {
        return jsonResponse(createMetrics('two-runtimes'));
      }

      if (
        call.url.endsWith('/api/blog-metrics/articles/two-runtimes/like') &&
        !call.init?.method
      ) {
        return jsonResponse({ slug: 'two-runtimes', liked: false });
      }

      if (
        call.url.endsWith('/api/blog-metrics/articles/two-runtimes/views') &&
        call.init?.method === 'POST'
      ) {
        return jsonResponse({
          metrics: createMetrics('two-runtimes', { views: 13 }),
          counted: true,
        });
      }

      return jsonResponse({}, 404);
    });

    render(<BlogArticleActions slug='two-runtimes' title='Two runtimes' />);

    await waitFor(() =>
      expect(screen.getByLabelText('13 views')).toBeInTheDocument()
    );
    expect(screen.getByLabelText('3 likes')).toBeInTheDocument();
    expect(calls.map((call) => call.init?.method ?? 'GET')).toEqual([
      'GET',
      'POST',
    ]);
    expect(calls[0]?.url).toContain(
      '/api/blog-metrics/articles/two-runtimes/like'
    );
    expect(calls[1]?.url).toContain(
      '/api/blog-metrics/articles/two-runtimes/views'
    );
    expect(calls[0]?.init?.credentials).toBe('include');
    expect(calls[1]?.init?.credentials).toBe('include');
  });

  it('retries liked-state read once before registering the article view', async () => {
    const { calls } = installArticleMetricsFetch((call) => {
      if (
        call.url.endsWith('/api/blog-metrics/articles/retry-runtime/like') &&
        !call.init?.method &&
        calls.length === 1
      ) {
        return jsonResponse({}, 503);
      }

      if (
        call.url.endsWith('/api/blog-metrics/articles/retry-runtime/like') &&
        !call.init?.method
      ) {
        return jsonResponse({ slug: 'retry-runtime', liked: true });
      }

      if (
        call.url.endsWith('/api/blog-metrics/articles/retry-runtime/views') &&
        call.init?.method === 'POST'
      ) {
        return jsonResponse({
          metrics: createMetrics('retry-runtime', { views: 4, likes: 1 }),
          counted: true,
        });
      }

      return jsonResponse({}, 404);
    });

    render(<BlogArticleActions slug='retry-runtime' title='Retry runtime' />);

    await waitFor(() =>
      expect(screen.getByLabelText('4 views')).toBeInTheDocument()
    );
    expect(calls.map((call) => call.init?.method ?? 'GET')).toEqual([
      'GET',
      'GET',
      'POST',
    ]);
    expect(calls[0]?.url).toContain('/like');
    expect(calls[1]?.url).toContain('/like');
    expect(calls[2]?.url).toContain('/views');
  });

  it('keeps metrics hidden when the backend is unavailable', async () => {
    installArticleMetricsFetch(() => jsonResponse({}, 503));

    render(<BlogArticleActions slug='two-runtimes' title='Two runtimes' />);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Like this article' })
      ).toBeInTheDocument()
    );

    expect(screen.queryByLabelText('0 views')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('0 likes')).not.toBeInTheDocument();
  });

  it('coalesces duplicate Strict Mode view registration while mounted', async () => {
    let resolveView: ((response: Response) => void) | undefined;
    const { calls } = installArticleMetricsFetch((call) => {
      if (
        call.url.endsWith('/api/blog-metrics/articles/strict-runtime/like') &&
        !call.init?.method
      ) {
        return jsonResponse({ slug: 'strict-runtime', liked: false });
      }

      if (
        call.url.endsWith('/api/blog-metrics/articles/strict-runtime/views') &&
        call.init?.method === 'POST'
      ) {
        return new Promise<Response>((resolve) => {
          resolveView = resolve;
        });
      }

      if (call.url.endsWith('/v1/blog/metrics/strict-runtime')) {
        return jsonResponse(createMetrics('strict-runtime'));
      }

      return jsonResponse({}, 404);
    });

    render(
      <StrictMode>
        <BlogArticleActions slug='strict-runtime' title='Strict runtime' />
      </StrictMode>
    );

    await waitFor(() =>
      expect(calls.filter((call) => call.init?.method === 'POST')).toHaveLength(
        1
      )
    );

    resolveView?.(
      jsonResponse({
        metrics: createMetrics('strict-runtime', { views: 2, likes: 0 }),
        counted: true,
      })
    );

    await waitFor(() =>
      expect(screen.getByLabelText('2 views')).toBeInTheDocument()
    );
    expect(calls.filter((call) => call.init?.method === 'POST')).toHaveLength(
      1
    );
  });

  it('hydrates backend liked=true state', async () => {
    installArticleMetricsFetch((call) => {
      if (call.url.endsWith('/v1/blog/metrics/two-runtimes')) {
        return jsonResponse(createMetrics('two-runtimes'));
      }

      if (
        call.url.endsWith('/api/blog-metrics/articles/two-runtimes/like') &&
        !call.init?.method
      ) {
        return jsonResponse({ slug: 'two-runtimes', liked: true });
      }

      return jsonResponse({ metrics: createMetrics('two-runtimes') });
    });

    render(<BlogArticleActions slug='two-runtimes' title='Two runtimes' />);

    const likeButton = await screen.findByRole('button', {
      name: 'Unlike this article',
    });

    expect(likeButton).toHaveAttribute('aria-pressed', 'true');
    expect(likeButton).toHaveTextContent('Liked');
  });

  it('uses PUT like success as the authoritative state', async () => {
    const { calls } = installArticleMetricsFetch((call) => {
      if (call.url.endsWith('/v1/blog/metrics/two-runtimes')) {
        return jsonResponse(createMetrics('two-runtimes'));
      }

      if (
        call.url.endsWith('/api/blog-metrics/articles/two-runtimes/like') &&
        !call.init?.method
      ) {
        return jsonResponse({ slug: 'two-runtimes', liked: false });
      }

      if (call.init?.method === 'POST') {
        return jsonResponse({ metrics: createMetrics('two-runtimes') });
      }

      if (call.init?.method === 'PUT') {
        return jsonResponse({
          metrics: createMetrics('two-runtimes', { likes: 4 }),
          liked: true,
          changed: true,
        });
      }

      return jsonResponse({}, 404);
    });

    render(<BlogArticleActions slug='two-runtimes' title='Two runtimes' />);

    const likeButton = await screen.findByRole('button', {
      name: 'Like this article',
    });
    fireEvent.click(likeButton);

    await waitFor(() =>
      expect(screen.getByLabelText('4 likes')).toBeInTheDocument()
    );
    expect(
      screen.getByRole('button', { name: 'Unlike this article' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(calls.at(-1)).toMatchObject({
      init: { method: 'PUT', credentials: 'include' },
    });
  });

  it('uses DELETE unlike success as the authoritative state', async () => {
    const { calls } = installArticleMetricsFetch((call) => {
      if (call.url.endsWith('/v1/blog/metrics/two-runtimes')) {
        return jsonResponse(createMetrics('two-runtimes', { likes: 4 }));
      }

      if (
        call.url.endsWith('/api/blog-metrics/articles/two-runtimes/like') &&
        !call.init?.method
      ) {
        return jsonResponse({ slug: 'two-runtimes', liked: true });
      }

      if (call.init?.method === 'POST') {
        return jsonResponse({
          metrics: createMetrics('two-runtimes', { likes: 4 }),
        });
      }

      if (call.init?.method === 'DELETE') {
        return jsonResponse({
          metrics: createMetrics('two-runtimes', { likes: 3 }),
          liked: false,
          changed: true,
        });
      }

      return jsonResponse({}, 404);
    });

    render(<BlogArticleActions slug='two-runtimes' title='Two runtimes' />);

    const likeButton = await screen.findByRole('button', {
      name: 'Unlike this article',
    });
    fireEvent.click(likeButton);

    await waitFor(() =>
      expect(screen.getByLabelText('3 likes')).toBeInTheDocument()
    );
    expect(
      screen.getByRole('button', { name: 'Like this article' })
    ).toHaveAttribute('aria-pressed', 'false');
    expect(calls.at(-1)).toMatchObject({
      init: { method: 'DELETE', credentials: 'include' },
    });
  });

  it('serializes repeated like interactions while a mutation is pending', async () => {
    let resolvePut: ((response: Response) => void) | undefined;
    const { calls } = installArticleMetricsFetch((call) => {
      if (call.url.endsWith('/v1/blog/metrics/two-runtimes')) {
        return jsonResponse(createMetrics('two-runtimes'));
      }

      if (
        call.url.endsWith('/api/blog-metrics/articles/two-runtimes/like') &&
        !call.init?.method
      ) {
        return jsonResponse({ slug: 'two-runtimes', liked: false });
      }

      if (call.init?.method === 'POST') {
        return jsonResponse({ metrics: createMetrics('two-runtimes') });
      }

      if (call.init?.method === 'PUT') {
        return new Promise<Response>((resolve) => {
          resolvePut = resolve;
        });
      }

      return jsonResponse({}, 404);
    });

    render(<BlogArticleActions slug='two-runtimes' title='Two runtimes' />);

    const likeButton = await screen.findByRole('button', {
      name: 'Like this article',
    });
    fireEvent.click(likeButton);
    fireEvent.click(likeButton);

    await waitFor(() => expect(likeButton).toBeDisabled());
    expect(calls.filter((call) => call.init?.method === 'PUT')).toHaveLength(1);

    resolvePut?.(
      jsonResponse({
        metrics: createMetrics('two-runtimes', { likes: 4 }),
        liked: true,
        changed: true,
      })
    );

    await waitFor(() =>
      expect(screen.getByLabelText('4 likes')).toBeInTheDocument()
    );
  });

  it('keeps the last known metrics when a like mutation fails', async () => {
    installArticleMetricsFetch((call) => {
      if (call.url.endsWith('/v1/blog/metrics/two-runtimes')) {
        return jsonResponse(createMetrics('two-runtimes'));
      }

      if (
        call.url.endsWith('/api/blog-metrics/articles/two-runtimes/like') &&
        !call.init?.method
      ) {
        return jsonResponse({ slug: 'two-runtimes', liked: false });
      }

      if (call.init?.method === 'POST') {
        return jsonResponse({ metrics: createMetrics('two-runtimes') });
      }

      if (call.init?.method === 'PUT') {
        return jsonResponse({}, 500);
      }

      return jsonResponse({}, 404);
    });

    render(<BlogArticleActions slug='two-runtimes' title='Two runtimes' />);

    const likeButton = await screen.findByRole('button', {
      name: 'Like this article',
    });
    await screen.findByLabelText('3 likes');
    fireEvent.click(likeButton);

    await waitFor(() => expect(likeButton).not.toBeDisabled());
    expect(screen.getByLabelText('3 likes')).toBeInTheDocument();
    expect(screen.queryByLabelText('0 likes')).not.toBeInTheDocument();
  });

  it('keeps Share usable independently of metrics availability', async () => {
    installArticleMetricsFetch(() => jsonResponse({}, 503));
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<BlogArticleActions slug='two-runtimes' title='Two runtimes' />);

    fireEvent.click(screen.getByRole('button', { name: 'Share' }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'https://vellira.dev/blog/two-runtimes'
      )
    );
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});
