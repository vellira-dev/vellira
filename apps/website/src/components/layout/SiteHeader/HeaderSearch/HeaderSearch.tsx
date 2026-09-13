'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Search, Close } from '@vellira-ui/icons';
import { Button, Input } from '@vellira-ui/react';

import { webComponents } from '@/component-catalog';

import styles from './HeaderSearch.module.css';

const MAX_RESULTS = 6;

export function HeaderSearch() {
  const router = useRouter();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
  });

  const updateDropdownPosition = () => {
    const rect = fieldRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    setDropdownPosition({
      top: rect.bottom + 4,
      left: rect.left,
    });
  };

  const normalizedQuery = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return webComponents
      .filter((component) => {
        const searchableText = [
          component.name,
          component.slug,
          component.description,
          component.category,
          ...component.platforms,
        ]
          .join(' ')
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      })
      .slice(0, MAX_RESULTS);
  }, [normalizedQuery]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      const clickedInsideSearch = rootRef.current?.contains(target);
      const clickedInsideResults = resultsRef.current?.contains(target);

      if (!clickedInsideSearch && !clickedInsideResults) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  const closeSearch = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const resetSearch = () => {
    setQuery('');
    closeSearch();
  };

  const openMobileSearch = () => {
    setMobileOpen(true);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const closeMobileSearch = () => {
    resetSearch();
    setMobileOpen(false);
  };

  const openResult = (index: number) => {
    const result = results[index];

    if (!result) {
      return;
    }

    resetSearch();
    router.push(`/components/${result.slug}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      closeSearch();
      event.currentTarget.blur();
      return;
    }

    if (results.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);

      setActiveIndex((current) =>
        current >= results.length - 1 ? 0 : current + 1
      );

      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);

      setActiveIndex((current) =>
        current <= 0 ? results.length - 1 : current - 1
      );

      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      openResult(activeIndex);
    }
  };

  const showResults = open && normalizedQuery.length > 0;

  useEffect(() => {
    if (!showResults) {
      return;
    }

    updateDropdownPosition();

    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [showResults]);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-mobile-open={mobileOpen ? '' : undefined}
    >
      <Button
        appearance='bare'
        type='button'
        className={styles.mobileTrigger}
        aria-label='Open search'
        aria-expanded={mobileOpen}
        onClick={openMobileSearch}
      >
        <Search aria-hidden='true' />
      </Button>

      <div ref={fieldRef} className={styles.field}>
        <Search aria-hidden='true' className={styles.icon} />

        <Input
          variant='bare'
          startIcon={false}
          ref={inputRef}
          type='search'
          autoComplete='on'
          role='combobox'
          className={styles.input}
          placeholder='Search...'
          aria-label='Search components'
          aria-expanded={showResults}
          aria-controls={listboxId}
          aria-autocomplete='list'
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => {
            if (normalizedQuery) {
              setOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
        />

        {mobileOpen && (
          <Button
            appearance='bare'
            type='button'
            className={styles.mobileClose}
            aria-label='Close search'
            onClick={closeMobileSearch}
          >
            <Close aria-hidden='true' />
          </Button>
        )}

        {query && (
          <Button
            appearance='bare'
            type='button'
            className={styles.clear}
            aria-label='Clear search'
            onClick={() => {
              resetSearch();
              inputRef.current?.focus();
            }}
          >
            <Close aria-hidden='true' />
          </Button>
        )}
      </div>

      {showResults &&
        createPortal(
          <div
            ref={resultsRef}
            id={listboxId}
            role='listbox'
            aria-label='Component search results'
            className={styles.results}
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
          >
            {results.length > 0 ? (
              results.map((component, index) => {
                const active = index === activeIndex;

                return (
                  <Link
                    id={`${listboxId}-option-${index}`}
                    key={component.slug}
                    role='option'
                    aria-selected={active}
                    href={`/components/${component.slug}`}
                    className={styles.result}
                    data-active={active ? '' : undefined}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={resetSearch}
                  >
                    <span className={styles.resultHeader}>
                      <span className={styles.resultName}>
                        {component.name}
                      </span>

                      <span className={styles.resultCategory}>
                        {component.category}
                      </span>
                    </span>

                    <span className={styles.resultDescription}>
                      {component.description}
                    </span>
                  </Link>
                );
              })
            ) : (
              <div className={styles.empty}>No components found</div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

HeaderSearch.displayName = 'HeaderSearch';
