import { Fragment, useCallback, useEffect, useRef } from 'react';

import { markCompoundSlot } from '@vellira-ui/core';
import { Search } from '@vellira-ui/icons';

import { DropdownArrow } from '../Arrow';
import { DropdownEmptySurface } from '../Empty';
import { DropdownGroupSurface } from '../Group';
import { useDropdownContext } from '../internal/DropdownContext';
import type { DropdownSlotComponent } from '../internal/types';
import { DropdownItemRow } from '../Item';
import { DropdownLabelSurface } from '../Label';
import { DropdownLoadingSurface } from '../Loading';
import { DropdownSeparatorSurface } from '../Separator';
import type { DropdownContentProps } from '../types';

import styles from './DropdownContent.module.scss';

import { Portal } from '#primitives/Portal';
import { cn } from '#utils/cn';

export const DropdownContent: DropdownSlotComponent<DropdownContentProps> = ({
  className,
}) => {
  const context = useDropdownContext();
  const {
    contentReadyToFocus,
    isOpen,
    setContentRef: setContextContentRef,
  } = context;
  const contentRef = useRef<HTMLUListElement | null>(null);
  const setContentRef = useCallback(
    (node: HTMLUListElement | null) => {
      contentRef.current = node;
      setContextContentRef(node);
    },
    [setContextContentRef]
  );

  useEffect(() => {
    const node = contentRef.current;

    if (!isOpen || !contentReadyToFocus || !node) return;
    if (node.contains(document.activeElement)) return;

    node.focus({ preventScroll: true });
  }, [contentReadyToFocus, isOpen]);

  if (!isOpen) return null;

  const contentClassName = cn(
    styles.dropdown,
    styles[context.color],
    context.contentProps?.className,
    className
  );
  const content = (
    <ul
      ref={setContentRef}
      id={context.contentId}
      role='menu'
      autoFocus
      tabIndex={-1}
      aria-labelledby={context.triggerId}
      aria-activedescendant={context.activeDescendantId}
      onKeyDown={context.onKeyDown}
      style={{ ...context.surfaceStyle, ...context.contentProps?.style }}
      className={contentClassName}
      data-color={context.color}
    >
      {context.searchable && (
        <li
          role='presentation'
          className={cn(styles.searchWrap, context.searchProps?.className)}
        >
          <Search aria-hidden='true' />
          <input
            className={styles.search}
            value={context.searchValue}
            placeholder={context.searchPlaceholder}
            aria-label={
              context.searchProps?.['aria-label'] ?? context.searchPlaceholder
            }
            onInput={(event) =>
              context.setSearchValue(event.currentTarget.value)
            }
            onChange={(event) => context.setSearchValue(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'ArrowDown' ||
                event.key === 'ArrowUp' ||
                event.key === 'Enter' ||
                event.key === 'Escape'
              ) {
                return;
              }

              event.stopPropagation();
            }}
          />
        </li>
      )}

      {context.loading ? (
        <DropdownLoadingSurface>{context.loadingText}</DropdownLoadingSurface>
      ) : context.searchable && context.items.length === 0 ? (
        <DropdownEmptySurface>{context.empty}</DropdownEmptySurface>
      ) : context.entries.length ? (
        context.entries.map((entry) => {
          if (entry.type === 'groupStart') {
            return <DropdownGroupSurface key={entry.id} />;
          }

          if (entry.type === 'groupEnd') {
            return null;
          }

          if (entry.type === 'label') {
            return <DropdownLabelSurface key={entry.id} {...entry.props} />;
          }

          if (entry.type === 'separator') {
            return <DropdownSeparatorSurface key={entry.id} {...entry.props} />;
          }

          if (entry.type === 'empty') {
            return (
              <DropdownEmptySurface key={entry.id}>
                {entry.props.children}
              </DropdownEmptySurface>
            );
          }

          if (entry.type === 'loading') {
            return (
              <DropdownLoadingSurface key={entry.id}>
                {entry.props.children}
              </DropdownLoadingSurface>
            );
          }

          if (entry.type === 'arrow') {
            return <DropdownArrow key={entry.id} {...entry.props} />;
          }

          return (
            <Fragment key={entry.item.id}>
              <DropdownItemRow item={entry.item} itemIndex={entry.itemIndex} />
            </Fragment>
          );
        })
      ) : (
        <DropdownEmptySurface />
      )}
    </ul>
  );

  return context.portal ? <Portal>{content}</Portal> : content;
};

markCompoundSlot(DropdownContent, 'content');
DropdownContent.displayName = 'Dropdown.Content';
