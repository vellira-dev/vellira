'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Search } from '@vellira-ui/icons';
import { Popover } from '@vellira-ui/react';

import { Container } from '@/components/layout/Container';
import type { BlogArticleMetadata } from '@/blog';
import { fetchBlogMetricsBatch, type BlogMetricsBySlug } from '../metrics';
import { normalizeBlogSearchText, searchBlogArticles } from '../search';
import {
  deriveBlogTopicOptions,
  filterBlogArticlesByTopics,
  normalizeBlogTopicValue,
  selectCommonBlogTopicOptions,
} from '../topicFilters';
import { BlogMetricsDisplay } from './BlogMetricsDisplay';
import { formatBlogDate } from './formatBlogDate';

import styles from './BlogExperience.module.css';
import searchStyles from './BlogIndexSearch.module.css';

interface BlogIndexProps {
  articles: readonly BlogArticleMetadata[];
  metricsBySlug?: BlogMetricsBySlug;
}

interface BlogDiscoveryState {
  query: string;
  selectedTopics: string[];
}

function readDiscoveryStateFromUrl(
  availableTopics: ReadonlySet<string>
): BlogDiscoveryState {
  if (typeof window === 'undefined') {
    return { query: '', selectedTopics: [] };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const selectedTopics = Array.from(
    new Set(
      (searchParams.get('tags') ?? '')
        .split(',')
        .map(normalizeBlogTopicValue)
        .filter((topic) => topic && availableTopics.has(topic))
    )
  ).sort();

  return {
    query: searchParams.get('q') ?? '',
    selectedTopics,
  };
}

function replaceDiscoveryStateInUrl(
  query: string,
  selectedTopics: readonly string[]
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  const nextQuery = query.trim();
  const nextTopics = Array.from(
    new Set(selectedTopics.map(normalizeBlogTopicValue).filter(Boolean))
  ).sort();

  if (nextQuery) {
    url.searchParams.set('q', nextQuery);
  } else {
    url.searchParams.delete('q');
  }

  if (nextTopics.length > 0) {
    url.searchParams.set('tags', nextTopics.join(','));
  } else {
    url.searchParams.delete('tags');
  }

  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${url.search}${url.hash}`
  );
}

export function BlogIndex({ articles, metricsBySlug = {} }: BlogIndexProps) {
  const [query, setQuery] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [resolvedMetricsBySlug, setResolvedMetricsBySlug] =
    useState<BlogMetricsBySlug>(metricsBySlug);
  const publishedArticles = useMemo(
    () => searchBlogArticles(articles, ''),
    [articles]
  );
  const topicOptions = useMemo(
    () => deriveBlogTopicOptions(publishedArticles),
    [publishedArticles]
  );
  const availableTopicValues = useMemo(
    () => new Set(topicOptions.map((topic) => topic.value)),
    [topicOptions]
  );
  const inlineTopics = useMemo(
    () => selectCommonBlogTopicOptions(topicOptions),
    [topicOptions]
  );
  const inlineTopicValues = useMemo(
    () => new Set(inlineTopics.map((topic) => topic.value)),
    [inlineTopics]
  );
  const moreTopics = useMemo(
    () => topicOptions.filter((topic) => !inlineTopicValues.has(topic.value)),
    [inlineTopicValues, topicOptions]
  );
  const searchedArticles = useMemo(
    () => searchBlogArticles(publishedArticles, query),
    [publishedArticles, query]
  );
  const filteredArticles = useMemo(
    () => filterBlogArticlesByTopics(searchedArticles, selectedTopics),
    [searchedArticles, selectedTopics]
  );
  const normalizedQuery = normalizeBlogSearchText(query);
  const hasActiveFilters = selectedTopics.length > 0;
  const hasActiveDiscovery = Boolean(normalizedQuery) || hasActiveFilters;
  const hiddenSelectedCount = selectedTopics.filter(
    (topic) => !inlineTopicValues.has(topic)
  ).length;

  useEffect(() => {
    const syncDiscoveryFromUrl = () => {
      const nextState = readDiscoveryStateFromUrl(availableTopicValues);
      setQuery(nextState.query);
      setSelectedTopics(nextState.selectedTopics);
    };

    syncDiscoveryFromUrl();
    window.addEventListener('popstate', syncDiscoveryFromUrl);

    return () => window.removeEventListener('popstate', syncDiscoveryFromUrl);
  }, [availableTopicValues]);

  useEffect(() => {
    const slugs = publishedArticles.map((article) => article.slug);

    if (
      slugs.length === 0 ||
      slugs.every((slug) => resolvedMetricsBySlug[slug] !== undefined)
    ) {
      return;
    }

    let cancelled = false;

    void fetchBlogMetricsBatch(slugs)
      .then((metrics) => {
        if (!cancelled) {
          setResolvedMetricsBySlug(metrics);
        }
      })
      .catch(() => {
        // Metrics are supplemental and must never block or break the blog index.
      });

    return () => {
      cancelled = true;
    };
  }, [publishedArticles]);

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    replaceDiscoveryStateInUrl(nextQuery, selectedTopics);
  };

  const toggleTopic = (topic: string) => {
    const normalizedTopic = normalizeBlogTopicValue(topic);
    const nextTopics = selectedTopics.includes(normalizedTopic)
      ? selectedTopics.filter((selected) => selected !== normalizedTopic)
      : [...selectedTopics, normalizedTopic].sort();

    setSelectedTopics(nextTopics);
    replaceDiscoveryStateInUrl(query, nextTopics);
  };

  const clearFilters = () => {
    setSelectedTopics([]);
    replaceDiscoveryStateInUrl(query, []);
  };

  const resetDiscovery = () => {
    setQuery('');
    setSelectedTopics([]);
    replaceDiscoveryStateInUrl('', []);
  };

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <Container size='wide'>
          <div className={styles.heroContent}>
            <div className={styles.heroEyebrow}>Blog</div>

            <h1>Blog</h1>

            <p className={styles.heroDescription}>
              Practical engineering notes on design systems, React, React
              Native, and developer tooling.
            </p>
          </div>
        </Container>
      </header>

      <section
        className={styles.indexSection}
        style={{ paddingTop: 8 }}
        aria-label='Published articles'
      >
        <Container size='wide'>
          {publishedArticles.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.eyebrow}>Publishing soon</p>
              <h2>The foundation is ready.</h2>
              <p>
                The first engineering articles are being prepared. They will
                appear here once they have been reviewed and published.
              </p>
            </div>
          ) : (
            <>
              <div className={searchStyles.discoveryToolbar}>
                <div className={searchStyles.toolbarInner}>
                  <label className={searchStyles.search}>
                    <Search
                      aria-hidden='true'
                      className={searchStyles.searchIcon}
                    />

                    <input
                      type='search'
                      value={query}
                      onChange={(event) => updateQuery(event.target.value)}
                      placeholder='Search articles...'
                      aria-label='Search articles'
                      className={searchStyles.searchInput}
                    />

                    {query && (
                      <button
                        type='button'
                        className={searchStyles.clearSearch}
                        aria-label='Clear search'
                        onClick={() => updateQuery('')}
                      >
                        ×
                      </button>
                    )}
                  </label>

                  <div
                    className={searchStyles.filters}
                    role='group'
                    aria-label='Filter articles by topic'
                  >
                    <button
                      type='button'
                      className={[
                        searchStyles.filter,
                        !hasActiveFilters ? searchStyles.filterActive : null,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-pressed={!hasActiveFilters}
                      onClick={clearFilters}
                    >
                      All
                    </button>

                    {inlineTopics.map((topic) => {
                      const active = selectedTopics.includes(topic.value);

                      return (
                        <button
                          key={topic.value}
                          type='button'
                          className={[
                            searchStyles.filter,
                            active ? searchStyles.filterActive : null,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          aria-pressed={active}
                          onClick={() => toggleTopic(topic.value)}
                        >
                          {topic.label}
                        </button>
                      );
                    })}

                    {moreTopics.length > 0 && (
                      <Popover side='bottom' align='end' sideOffset={10}>
                        <Popover.Trigger asChild>
                          <button
                            type='button'
                            className={[
                              searchStyles.moreFiltersTrigger,
                              hiddenSelectedCount > 0
                                ? searchStyles.filterActive
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <span>More filters</span>
                            {hiddenSelectedCount > 0 && (
                              <span className={searchStyles.filterCount}>
                                {hiddenSelectedCount}
                              </span>
                            )}
                          </button>
                        </Popover.Trigger>

                        <Popover.Content className={searchStyles.filterPanel}>
                          <div className={searchStyles.filterPanelHeader}>
                            <Popover.Title asChild>
                              <strong>More topics</strong>
                            </Popover.Title>
                            {hasActiveFilters && (
                              <button
                                type='button'
                                className={searchStyles.clearFilters}
                                onClick={clearFilters}
                              >
                                Clear filters
                              </button>
                            )}
                          </div>

                          <div
                            className={searchStyles.filterPanelGrid}
                            role='group'
                            aria-label='More topic filters'
                          >
                            {moreTopics.map((topic) => {
                              const active = selectedTopics.includes(
                                topic.value
                              );

                              return (
                                <button
                                  key={topic.value}
                                  type='button'
                                  className={[
                                    searchStyles.panelFilter,
                                    active
                                      ? searchStyles.panelFilterActive
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                  aria-pressed={active}
                                  onClick={() => toggleTopic(topic.value)}
                                >
                                  <span>{topic.label}</span>
                                  <span
                                    className={searchStyles.topicFrequency}
                                    aria-hidden='true'
                                  >
                                    {topic.count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </Popover.Content>
                      </Popover>
                    )}
                  </div>
                </div>
              </div>

              {hasActiveDiscovery && (
                <div
                  className={searchStyles.resultsMeta}
                  role='status'
                  aria-live='polite'
                >
                  {filteredArticles.length === 1
                    ? '1 article'
                    : `${filteredArticles.length} articles`}
                </div>
              )}

              {filteredArticles.length > 0 ? (
                <div className={styles.articleGrid}>
                  {filteredArticles.map((article) => (
                    <article key={article.slug} className={styles.articleCard}>
                      <div className={styles.cardMeta}>
                        <time dateTime={article.publishedAt}>
                          {formatBlogDate(article.publishedAt)}
                        </time>
                        <span
                          className={styles.metaDivider}
                          aria-hidden='true'
                        />
                        <span>{article.author}</span>
                      </div>

                      <h2>{article.title}</h2>
                      <p className={styles.cardDescription}>
                        {article.description}
                      </p>

                      <BlogMetricsDisplay
                        slug={article.slug}
                        metrics={resolvedMetricsBySlug[article.slug]}
                      />

                      <div className={styles.tags} aria-label='Article tags'>
                        {article.tags.map((tag) => (
                          <span key={tag} className={styles.tag}>
                            {tag}
                          </span>
                        ))}
                      </div>

                      <Link
                        href={`/blog/${article.slug}`}
                        prefetch={false}
                        className={styles.cardLink}
                        aria-label={`Read ${article.title}`}
                      >
                        Read article
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p className={styles.eyebrow}>No matches</p>
                  <h2>No articles found.</h2>
                  <p>No articles match the current search and topic filters.</p>
                  <button
                    type='button'
                    className={searchStyles.resetSearch}
                    aria-label='Clear search and filters and show all articles'
                    onClick={resetDiscovery}
                  >
                    Reset search and filters
                  </button>
                </div>
              )}
            </>
          )}
        </Container>
      </section>
    </main>
  );
}
