import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { KeyboardEvent, MouseEvent } from 'react';

import { DropdownContent } from '../Content';
import { toCssSize } from '../internal/composeEventHandlers';
import { parseDropdownChildren } from '../internal/DropdownCollection';
import {
  DropdownProvider,
  DropdownTriggerProvider,
} from '../internal/DropdownContext';
import type {
  DropdownCollectionItem,
  ParsedDropdownChildren,
} from '../internal/types';
import type { DropdownProps, DropdownSelectEvent } from '../types';

import styles from '../Dropdown.module.scss';

import {
  useDropdown,
  useOverlayDismiss,
  useOverlayPresentation,
  useScrollLock,
} from '#hooks';
import { cn } from '#utils/cn';

export const DropdownRoot = ({
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  size = 'md',
  color = 'primary',
  placement = 'bottom-start',
  strategy,
  offset = 2,
  collisionPadding = 8,
  matchTriggerWidth = false,
  minWidth,
  maxWidth,
  portal = true,
  avoidCollisions = true,
  modal = false,
  closeOnSelect = true,
  loop = true,
  disabled = false,
  loading = false,
  loadingText = 'Loading actions...',
  searchable = false,
  command = false,
  searchValue,
  defaultSearchValue = '',
  searchPlaceholder,
  onSearch,
  empty,
  className,
}: DropdownProps) => {
  const generatedId = useId();
  const triggerId = `${generatedId}-trigger`;
  const contentId = `${generatedId}-menu`;
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const [openSubId, setOpenSubId] = useState<string | undefined>();
  const [activeSubIndex, setActiveSubIndex] = useState(-1);
  const [radioValues, setRadioValues] = useState<
    Record<string, string | undefined>
  >({});
  const [uncontrolledSearchValue, setUncontrolledSearchValue] =
    useState(defaultSearchValue);
  const resolvedSearchValue = searchValue ?? uncontrolledSearchValue;

  const parsed = useMemo(() => parseDropdownChildren(children), [children]);
  const contentCommand = parsed.content?.props.command ?? false;
  const isSearchable =
    searchable || command || contentCommand || !!parsed.search;
  const allItems = useMemo(
    () => collectDropdownItems(parsed.items),
    [parsed.items]
  );
  const navigableItems = useMemo(
    () =>
      parsed.items.map((item) => ({
        disabled: item.disabled,
        label: item.label,
      })),
    [parsed.items]
  );
  const filteredParsed = useMemo(() => {
    if (!isSearchable || !resolvedSearchValue.trim()) return parsed;

    return filterDropdownEntries(parsed, resolvedSearchValue);
  }, [isSearchable, parsed, resolvedSearchValue]);
  const filteredNavigableItems = useMemo(
    () =>
      filteredParsed.items.map((item) => ({
        disabled: item.disabled,
        label: item.label,
      })),
    [filteredParsed.items]
  );

  useEffect(() => {
    setRadioValues((current) => {
      const next = { ...current };

      allItems.forEach((item) => {
        if (item.type !== 'radio') return;
        if (next[item.groupId] !== undefined) return;

        next[item.groupId] =
          item.groupProps?.value ?? item.groupProps?.defaultValue;
      });

      return next;
    });
  }, [allItems]);

  const {
    activeIndex,
    setActiveIndex,
    isOpen,
    closeDropdown,
    toggleDropdown,
    onKeyDown,
  } = useDropdown({
    items: isSearchable ? filteredNavigableItems : navigableItems,
    open,
    defaultOpen,
    disabled,
    onOpenChange,
    getItemValue: (_item, index) =>
      (isSearchable ? filteredParsed.items : parsed.items)[index]?.id ?? '',
    getItemText: (item) => item.label,
    loop,
  });

  useEffect(() => {
    if (!isOpen) {
      setOpenSubId(undefined);
      setActiveSubIndex(-1);
    }
  }, [isOpen]);

  const {
    floatingStyles,
    isMobileSheet,
    isPositioned,
    setRef,
    setFloatingRef,
  } = useOverlayPresentation({
    open: isOpen,
    placement,
    strategy,
    portal,
    matchTriggerWidth,
    avoidCollisions,
    offset,
    collisionPadding,
    mobileSheetBreakpoint: 640,
  });

  const setDropdownSearchValue = useCallback(
    (value: string) => {
      if (searchValue === undefined) {
        setUncontrolledSearchValue(value);
      }

      onSearch?.(value);
      setActiveIndex(0);
    },
    [onSearch, searchValue, setActiveIndex]
  );

  useScrollLock({
    active: isOpen,
    enabled: modal,
  });

  const setPointerSubId = useCallback((id: string | undefined) => {
    setOpenSubId(id);
    setActiveSubIndex(-1);
  }, []);

  const openKeyboardSubmenu = useCallback((item: DropdownCollectionItem) => {
    if (item.type !== 'subTrigger' || item.disabled) return;

    setOpenSubId(item.id);
    setActiveSubIndex(item.subItems.findIndex((entry) => !entry.disabled));
  }, []);

  const closeAndFocusTrigger = useCallback(() => {
    closeDropdown();
    setPointerSubId(undefined);
    triggerRef.current?.focus();
  }, [closeDropdown, setPointerSubId]);

  const selectItem = useCallback(
    (item: DropdownCollectionItem, event: DropdownSelectEvent) => {
      if (item.disabled || loading) return;

      if (item.type === 'subTrigger') {
        openKeyboardSubmenu(item);
        return;
      }

      if (item.type === 'item') {
        item.props.onSelect?.(event);
      }

      if (item.type === 'radio') {
        setRadioValues((current) => ({
          ...current,
          [item.groupId]: item.props.value,
        }));
        item.groupProps?.onValueChange?.(item.props.value);
      }

      const shouldClose =
        item.props.closeOnSelect ??
        (item.type === 'checkbox' ? false : closeOnSelect);

      if (!event.defaultPrevented && shouldClose) {
        closeAndFocusTrigger();
      }
    },
    [closeAndFocusTrigger, closeOnSelect, loading, openKeyboardSubmenu]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const activeItem = filteredParsed.items[activeIndex];
      const parentIndex = filteredParsed.items.findIndex(
        (item) => item.type === 'subTrigger' && item.id === openSubId
      );
      const parentItem = filteredParsed.items[parentIndex];

      if (parentItem?.type === 'subTrigger' && activeSubIndex >= 0) {
        const subItems = parentItem.subItems;
        const firstIndex = subItems.findIndex((item) => !item.disabled);
        const lastIndex = subItems.reduce(
          (last, item, index) => (item.disabled ? last : index),
          -1
        );

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveSubIndex(
            nextSubmenuIndex(
              subItems,
              activeSubIndex,
              event.key === 'ArrowDown' ? 1 : -1,
              loop
            )
          );
          return;
        }

        if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          setActiveSubIndex(event.key === 'Home' ? firstIndex : lastIndex);
          return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const item = subItems[activeSubIndex];
          const node = document.getElementById(
            `${contentId}-item-${parentIndex}-${activeSubIndex}`
          );

          if (
            item &&
            !item.disabled &&
            node instanceof HTMLElement &&
            contentRef.current?.contains(node)
          ) {
            // Use the same onClick path for keyboard and pointer, including
            // checkbox/radio state, links and preventDefault behavior.
            node.click();
          }
          return;
        }

        if (
          event.key.length === 1 &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          const query = event.key.toLocaleLowerCase();
          const match = subItems.findIndex(
            (item, index) =>
              index > activeSubIndex &&
              !item.disabled &&
              item.label.toLocaleLowerCase().startsWith(query)
          );
          const wrapped =
            match < 0
              ? subItems.findIndex(
                  (item) =>
                    !item.disabled &&
                    item.label.toLocaleLowerCase().startsWith(query)
                )
              : match;
          if (wrapped >= 0) {
            event.preventDefault();
            setActiveSubIndex(wrapped);
            return;
          }
        }
      }

      if (openSubId && (event.key === 'ArrowLeft' || event.key === 'Escape')) {
        // First Escape closes only the submenu. The parent menu remains
        // focused, with its active descendant restored to the subtrigger.
        event.preventDefault();
        setPointerSubId(undefined);
        return;
      }

      if (event.key === 'ArrowRight' && activeItem?.type === 'subTrigger') {
        event.preventDefault();
        openKeyboardSubmenu(activeItem);
        return;
      }

      if ((event.key === 'Enter' || event.key === ' ') && activeItem) {
        event.preventDefault();
        if (activeItem.type === 'subTrigger') {
          openKeyboardSubmenu(activeItem);
          return;
        }
        if (activeItem.type === 'checkbox') {
          // Route keyboard activation through the same controlled/uncontrolled
          // checkbox handler as pointer activation, without double-toggling.
          const activeNode = document.getElementById(
            `${contentId}-item-${activeIndex}`
          );
          if (
            activeNode instanceof HTMLElement &&
            contentRef.current?.contains(activeNode)
          ) {
            activeNode.click();
          }
          return;
        }
        const selectEvent = createDropdownSelectEvent(event);
        selectItem(activeItem, selectEvent);
        return;
      }

      onKeyDown(event);

      if (event.key === 'Escape') {
        triggerRef.current?.focus();
      }
    },
    [
      activeIndex,
      activeSubIndex,
      contentId,
      filteredParsed.items,
      loop,
      onKeyDown,
      openKeyboardSubmenu,
      openSubId,
      selectItem,
      setPointerSubId,
    ]
  );

  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      toggleDropdown();
    },
    [toggleDropdown]
  );

  const setTriggerRef = useCallback(
    (node: HTMLElement | null) => {
      triggerRef.current = node;
      setRef(node);
    },
    [setRef]
  );

  const setContentRef = useCallback(
    (node: HTMLElement | null) => {
      contentRef.current = node;
      setFloatingRef(node);

      if (isMobileSheet) {
        node?.focus({ preventScroll: true });
      }
    },
    [isMobileSheet, setFloatingRef]
  );

  const dismiss = useOverlayDismiss({
    active: isOpen,
    id: contentId,
    zIndexLevel: 'dropdown',
    closeOnEscape: true,
    closeOnOutsidePress: true,
    contentRef,
    ignoreRefs: [triggerRef],
    requestClose: () => closeDropdown(),
  });

  const surfaceStyle = {
    ...floatingStyles,
    zIndex: dismiss.zIndex,
    minWidth: toCssSize(minWidth),
    maxWidth: toCssSize(maxWidth),
  };

  const triggerContext = {
    disabled,
    isOpen,
    contentId,
    triggerId,
    setTriggerRef,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
  };

  const openSubParentIndex = filteredParsed.items.findIndex(
    (item) => item.type === 'subTrigger' && item.id === openSubId
  );
  const openSubParent = filteredParsed.items[openSubParentIndex];
  const activeSubItem =
    openSubParent?.type === 'subTrigger'
      ? openSubParent.subItems[activeSubIndex]
      : undefined;
  const activeDescendantId =
    activeSubItem && !activeSubItem.disabled
      ? `${contentId}-item-${openSubParentIndex}-${activeSubIndex}`
      : activeIndex >= 0 && activeIndex < filteredParsed.items.length
        ? `${contentId}-item-${activeIndex}`
        : undefined;

  const dropdownContext = {
    activeDescendantId,
    activeIndex,
    activeSubIndex,
    closeOnSelect,
    color,
    contentReadyToFocus: isMobileSheet || isPositioned,
    contentId,
    contentProps: parsed.content?.props,
    disabled,
    entries: filteredParsed.entries,
    getItemId: (index: number) => `${contentId}-item-${index}`,
    isOpen,
    items: filteredParsed.items,
    loading,
    loadingText,
    empty,
    maxWidth,
    minWidth,
    openSubId,
    onKeyDown: handleKeyDown,
    portal: parsed.portal ? false : portal,
    radioValues,
    searchPlaceholder:
      parsed.search?.props.placeholder ??
      searchPlaceholder ??
      (command || contentCommand ? 'Type a command...' : 'Search actions...'),
    searchProps: parsed.search?.props,
    searchValue: resolvedSearchValue,
    searchable: isSearchable,
    selectItem,
    setActiveIndex,
    setActiveSubIndex,
    setContentRef,
    setOpenSubId: setPointerSubId,
    setRadioValue: (groupId: string, value: string) => {
      setRadioValues((current) => ({ ...current, [groupId]: value }));
    },
    setSearchValue: setDropdownSearchValue,
    size,
    surfaceStyle,
    triggerId,
  };

  return (
    <DropdownTriggerProvider value={triggerContext}>
      <DropdownProvider value={dropdownContext}>
        <div
          className={cn(styles.wrapper, className)}
          data-disabled={disabled || undefined}
        >
          {parsed.trigger ?? null}
          {parsed.portal ?? parsed.content ?? <DropdownContent />}
        </div>
      </DropdownProvider>
    </DropdownTriggerProvider>
  );
};

DropdownRoot.displayName = 'DropdownRoot';

function nextSubmenuIndex(
  items: DropdownCollectionItem[],
  current: number,
  direction: -1 | 1,
  loop: boolean
): number {
  let index = current;

  for (let step = 0; step < items.length; step++) {
    const next = index + direction;

    if (!loop && (next < 0 || next >= items.length)) return current;

    index = (next + items.length) % items.length;
    if (!items[index]?.disabled) return index;
  }

  return current;
}

function createDropdownSelectEvent(
  originalEvent: DropdownSelectEvent['originalEvent']
) {
  let defaultPrevented = false;

  return {
    originalEvent,
    preventDefault: () => {
      defaultPrevented = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
  };
}

function collectDropdownItems(items: DropdownCollectionItem[]) {
  const result: DropdownCollectionItem[] = [];

  items.forEach((item) => {
    result.push(item);

    if (item.type === 'subTrigger') {
      result.push(...collectDropdownItems(item.subItems));
    }
  });

  return result;
}

function filterDropdownEntries(
  parsed: ParsedDropdownChildren,
  searchValue: string
): ParsedDropdownChildren {
  const normalizedSearch = searchValue.trim().toLocaleLowerCase();
  const matchedItems = new Set(
    parsed.items
      .filter((item) =>
        item.label.toLocaleLowerCase().includes(normalizedSearch)
      )
      .map((item) => item.id)
  );
  const items = parsed.items.filter((item) => matchedItems.has(item.id));

  return {
    ...parsed,
    items,
    entries: parsed.entries.filter(
      (entry) => entry.type !== 'item' || matchedItems.has(entry.item.id)
    ),
  };
}
