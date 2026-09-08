// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BlogArticleMetadata } from '../../apps/website/src/blog';
import { BlogIndex } from '../../apps/website/src/blog/ui';

function createArticle(
  overrides: Partial<BlogArticleMetadata> = {}
): BlogArticleMetadata {
  return {
    title: 'Design systems in production',
    description: 'Practical engineering notes for cross-platform UI.',
    slug: 'design-systems-production',
    publishedAt: '2026-09-05',
    author: 'Roman Bakurov',
    tags: ['Design Systems', 'React'],
    draft: false,
    ...overrides,
  };
}

function installMetricsFetch() {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL) =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      }) as Response
  );

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

const articles = [
  createArticle({
    title: 'React Native accessibility patterns',
    slug: 'react-native-accessibility',
    tags: ['React Native', 'Accessibility', 'React'],
  }),
  createArticle({
    title: 'Building cross-platform forms',
    slug: 'cross-platform-forms',
    description: 'Compose accessible forms for React and React Native.',
    tags: ['Forms', 'React'],
  }),
  createArticle({
    title: 'Component metadata as a source of truth',
    slug: 'component-metadata-source-of-truth',
    tags: ['Design Systems', 'Tooling'],
  }),
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('blog search experience', () => {
  it('filters cards, reports the result count, updates URL state, and clears search', async () => {
    const fetchMock = installMetricsFetch();
    window.history.replaceState({}, '', '/blog?tags=react');

    render(<BlogIndex articles={articles} />);

    const search = screen.getByRole('searchbox', { name: 'Search articles' });
    fireEvent.change(search, { target: { value: 'react native' } });

    expect(
      screen.getByRole('link', {
        name: 'Read React Native accessibility patterns',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Read Building cross-platform forms' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {
        name: 'Read Component metadata as a source of truth',
      })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2 articles');
    expect(new URLSearchParams(window.location.search).get('q')).toBe(
      'react native'
    );
    expect(new URLSearchParams(window.location.search).get('tags')).toBe(
      'react'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(search).toHaveValue('');
    expect(
      screen.getByRole('link', { name: 'Read Building cross-platform forms' })
    ).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has('q')).toBe(false);
    expect(new URLSearchParams(window.location.search).get('tags')).toBe(
      'react'
    );

    const getBatchMetricsRequests = () =>
      fetchMock.mock.calls
        .map(([input]) => input.toString())
        .filter((url) => url.includes('/api/blog-metrics/metrics?'));

    await waitFor(() => expect(getBatchMetricsRequests()).toHaveLength(1));

    const [batchMetricsRequest] = getBatchMetricsRequests();
    expect(batchMetricsRequest).toBeDefined();

    if (!batchMetricsRequest) {
      throw new Error('Expected one blog metrics batch request');
    }

    expect(batchMetricsRequest).not.toContain('api.vellira.dev');

    const batchMetricsUrl = new URL(batchMetricsRequest, 'https://vellira.test');
    expect(batchMetricsUrl.searchParams.getAll('slug')).toEqual(
      articles.map((article) => article.slug)
    );
  });

  it('renders a useful no-results state with one-action reset', () => {
    installMetricsFetch();
    render(<BlogIndex articles={articles} />);

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search articles' }),
      { target: { value: 'does not exist' } }
    );

    expect(screen.getByText('No articles found.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('0 articles');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Clear search and filters and show all articles',
      })
    );

    expect(screen.queryByText('No articles found.')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'Read Component metadata as a source of truth',
      })
    ).toBeInTheDocument();
  });

  it('restores query state from the URL and browser popstate navigation', async () => {
    installMetricsFetch();
    window.history.replaceState({}, '', '/blog?q=accessibility');

    render(<BlogIndex articles={articles} />);

    const search = screen.getByRole('searchbox', { name: 'Search articles' });

    await waitFor(() => expect(search).toHaveValue('accessibility'));
    expect(
      screen.getByRole('link', {
        name: 'Read React Native accessibility patterns',
      })
    ).toBeInTheDocument();

    window.history.pushState({}, '', '/blog?q=metadata');
    window.dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() => expect(search).toHaveValue('metadata'));
    expect(
      screen.getByRole('link', {
        name: 'Read Component metadata as a source of truth',
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {
        name: 'Read React Native accessibility patterns',
      })
    ).not.toBeInTheDocument();
  });
});
