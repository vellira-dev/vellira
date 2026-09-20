// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

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

function installBlogFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input.toString());

    if (url.pathname.endsWith('/like')) {
      const pathParts = url.pathname.split('/');
      const slug = decodeURIComponent(pathParts.at(-2) ?? 'article');

      return {
        ok: true,
        status: 200,
        json: async () => ({ slug, liked: false }),
      } as Response;
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    } as Response;
  });

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
    title: 'Component metadata architecture',
    slug: 'component-metadata-architecture',
    tags: ['Tooling', 'React'],
  }),
  createArticle({
    title: 'Testing quality gates',
    slug: 'testing-quality-gates',
    tags: ['Testing', 'Tooling'],
  }),
];

function getTestingTopicButton(): HTMLButtonElement {
  const dialog = screen.getByRole('dialog', { hidden: true });
  const label = within(dialog).getByText(/^Testing$/);
  const button = label.closest('button');

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('Testing topic button was not found');
  }

  return button;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('blog topic filter experience', () => {
  it('uses OR topic semantics and intersects filters with search', () => {
    installBlogFetch();
    render(<BlogIndex articles={articles} />);

    fireEvent.click(screen.getByRole('button', { name: 'Accessibility' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tooling' }));

    expect(screen.getByRole('status')).toHaveTextContent('3 articles');
    expect(
      screen.getByRole('link', {
        name: 'Read React Native accessibility patterns',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Read Component metadata architecture' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Read Testing quality gates' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Read Building cross-platform forms' })
    ).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('tags')).toBe(
      'accessibility,tooling'
    );

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search articles' }),
      { target: { value: 'metadata' } }
    );

    expect(screen.getByRole('status')).toHaveTextContent('1 article');
    expect(
      screen.getByRole('link', { name: 'Read Component metadata architecture' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Read Testing quality gates' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    expect(
      screen.getByRole('searchbox', { name: 'Search articles' })
    ).toHaveValue('metadata');
    expect(new URLSearchParams(window.location.search).has('tags')).toBe(false);
    expect(new URLSearchParams(window.location.search).get('q')).toBe(
      'metadata'
    );
  });

  it('dismisses filters outside and keeps hidden topics usable', async () => {
    installBlogFetch();
    render(<BlogIndex articles={articles} />);

    const moreFilters = screen.getByRole('button', { name: 'More filters' });

    expect(moreFilters).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(moreFilters);

    expect(getTestingTopicButton()).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    await waitFor(() =>
      expect(moreFilters).toHaveAttribute('aria-expanded', 'false')
    );
    expect(
      screen.queryByRole('dialog', { hidden: true })
    ).not.toBeInTheDocument();

    fireEvent.click(moreFilters);
    fireEvent.click(getTestingTopicButton());

    expect(screen.getByRole('status')).toHaveTextContent('1 article');
    expect(
      screen.getByRole('link', { name: 'Read Testing quality gates' })
    ).toBeInTheDocument();
    expect(moreFilters).toHaveTextContent('1');
    expect(new URLSearchParams(window.location.search).get('tags')).toBe(
      'testing'
    );

    fireEvent.click(
      within(screen.getByRole('dialog', { hidden: true })).getByText(
        'Clear filters'
      )
    );

    expect(new URLSearchParams(window.location.search).has('tags')).toBe(false);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('restores valid URL filters and safely ignores unknown topics', async () => {
    installBlogFetch();
    window.history.replaceState({}, '', '/blog?q=quality&tags=unknown,testing');

    render(<BlogIndex articles={articles} />);

    const search = screen.getByRole('searchbox', { name: 'Search articles' });

    await waitFor(() => expect(search).toHaveValue('quality'));
    expect(screen.getByRole('status')).toHaveTextContent('1 article');
    expect(
      screen.getByRole('link', { name: 'Read Testing quality gates' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /More filters/ }));
    expect(getTestingTopicButton()).toHaveAttribute('aria-pressed', 'true');

    window.history.pushState({}, '', '/blog?tags=does-not-exist');
    window.dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() => expect(search).toHaveValue(''));
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      screen.getByRole('link', { name: 'Read Building cross-platform forms' })
    ).toBeInTheDocument();
  });

  it('provides one action to reset a no-results search and filter state', () => {
    installBlogFetch();
    render(<BlogIndex articles={articles} />);

    fireEvent.click(screen.getByRole('button', { name: 'React' }));
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search articles' }),
      { target: { value: 'does not exist' } }
    );

    expect(screen.getByText('No articles found.')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Clear search and filters and show all articles',
      })
    );

    expect(new URLSearchParams(window.location.search).has('q')).toBe(false);
    expect(new URLSearchParams(window.location.search).has('tags')).toBe(false);
    expect(screen.queryByText('No articles found.')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Read Building cross-platform forms' })
    ).toBeInTheDocument();
  });
});
