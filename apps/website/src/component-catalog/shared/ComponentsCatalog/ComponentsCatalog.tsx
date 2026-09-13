'use client';

import { useId, useMemo, useState } from 'react';

import Link from 'next/link';

import { Button, Input } from '@vellira-ui/react';

import { Container } from '@/components/layout/Container';

import { componentGroups } from '../../registry/componentGroups';

import { ComponentCatalogPreview } from './ComponentCatalogPreview';
import { Search, Grid, Monitor, Smartphone } from '@vellira-ui/icons';

import styles from './ComponentsCatalog.module.css';

type PlatformFilter = 'all' | 'react' | 'react-native';

export function ComponentsCatalog() {
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<PlatformFilter>('all');

  const normalizedQuery = query.trim().toLowerCase();

  const platformFilters = [
    {
      value: 'all',
      label: 'All',
      icon: Grid,
    },
    {
      value: 'react',
      label: 'React',
      icon: Monitor,
    },
    {
      value: 'react-native',
      label: 'React Native',
      icon: Smartphone,
    },
  ] as const;

  const filteredGroups = useMemo(
    () =>
      componentGroups
        .map((group) => ({
          ...group,
          components: group.components.filter((component) => {
            const matchesPlatform =
              platform === 'all' || component.platforms.includes(platform);

            const searchableText = [
              component.name,
              component.slug,
              component.description,
              component.category,
              ...component.platforms,
            ]
              .join(' ')
              .toLowerCase();

            const matchesQuery =
              !normalizedQuery || searchableText.includes(normalizedQuery);

            return matchesPlatform && matchesQuery;
          }),
        }))
        .filter((group) => group.components.length > 0),
    [normalizedQuery, platform]
  );

  const resultCount = filteredGroups.reduce(
    (total, group) => total + group.components.length,
    0
  );

  return (
    <section className={styles.root}>
      <Container size='wide'>
        <div className={styles.toolbar}>
          <div className={styles.toolbarInner}>
            <div className={styles.search}>
              <label htmlFor={searchId} className={styles.searchLabel}>
                <Search aria-hidden='true' className={styles.searchIcon} />
              </label>

              <Input
                id={searchId}
                variant='bare'
                startIcon={false}
                type='search'
                autoComplete='on'
                value={query}
                onValueChange={setQuery}
                placeholder='Search components...'
                aria-label='Search components'
                className={styles.searchInput}
              />

              {query && (
                <Button
                  appearance='bare'
                  type='button'
                  className={styles.clearSearch}
                  aria-label='Clear search'
                  onClick={() => setQuery('')}
                >
                  ×
                </Button>
              )}
            </div>

            <div className={styles.filters} aria-label='Filter by platform'>
              {platformFilters.map(({ value, label, icon: Icon }) => {
                const active = platform === value;

                return (
                  <Button
                    appearance='bare'
                    key={value}
                    type='button'
                    className={[
                      styles.filter,
                      active ? styles.filterActive : null,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-pressed={active}
                    onClick={() => setPlatform(value)}
                  >
                    <Icon aria-hidden='true' className={styles.filterIcon} />
                    <span>{label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {normalizedQuery && (
          <div className={styles.resultsMeta}>
            {resultCount === 1 ? '1 component' : `${resultCount} components`}
          </div>
        )}

        {filteredGroups.length > 0 ? (
          <div className={styles.groups}>
            {filteredGroups.map((group) => (
              <section key={group.category} className={styles.group}>
                <div className={styles.groupHeader}>
                  <h2 className={styles.groupTitle}>{group.label}</h2>

                  <span className={styles.groupCount}>
                    {group.components.length}
                  </span>
                </div>

                <div className={styles.grid}>
                  {group.components.map((component) => (
                    <Link
                      key={component.slug}
                      href={`/components/${component.slug}`}
                      className={styles.card}
                    >
                      <div className={styles.cardHeader}>
                        <h3 className={styles.cardTitle}>{component.name}</h3>

                        <span className={styles.status}>
                          {component.status}
                        </span>
                      </div>

                      <div className={styles.preview}>
                        <ComponentCatalogPreview slug={component.slug} />
                      </div>

                      <div className={styles.cardFooter}>
                        <div className={styles.platforms}>
                          {component.platforms.map((item) => (
                            <span key={item} className={styles.platform}>
                              {item === 'react-native'
                                ? 'React Native'
                                : 'React'}
                            </span>
                          ))}
                        </div>

                        <span className={styles.openArrow} aria-hidden='true'>
                          ↗
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <strong>No components found</strong>
            <span>Try another search or platform filter.</span>
          </div>
        )}
      </Container>
    </section>
  );
}
