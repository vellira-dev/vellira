import { useCallback, useEffect, useId, useMemo, useRef } from 'react';

import { FlatList, Text, View } from 'react-native';
import type { ViewInstance } from 'react-native';

import {
  useDropdown,
  useOverlayDismiss,
  useOverlayFocusRestore,
  useOverlayPresentation,
} from '../../../hooks';
import { useDropdownAccessibility } from '../../../hooks/behavior/dropdown/useDropdownAccessibility';
import { useDropdownEntries } from '../../../hooks/behavior/dropdown/useDropdownEntries';
import { useDropdownSearch } from '../../../hooks/behavior/dropdown/useDropdownSearch';
import { useNativeFloatingPosition } from '../../../managers';
import { useThemeStyles } from '../../../theme';
import { DropdownContent } from '../Content/DropdownContent';
import { createStyles } from '../Dropdown.styles';
import { DropdownGroup } from '../Group/DropdownGroup';
import { parseDropdownChildren } from '../internal/DropdownCollection';
import { DropdownProvider } from '../internal/DropdownContext';
import { createDropdownSelectEvent } from '../internal/DropdownUtils';
import type { NativeDropdownEntry } from '../internal/types';
import { DropdownItem } from '../Item/DropdownItem';
import { DropdownSeparator } from '../Separator/DropdownSeparator';
import { DropdownTrigger } from '../Trigger/DropdownTrigger';
import type { DropdownProps } from '../types';

export function DropdownRoot({
  children,
  label = 'Menu',
  trigger,
  icon,
  arrowIcon,
  showArrow = true,
  open,
  defaultOpen = false,
  onOpenChange,
  presentation = 'auto',
  placement = 'bottom-start',
  offset = 8,
  closeOnSelect = true,
  color = 'primary',
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
  size = 'md',
  style,
  triggerStyle,
  contentStyle,
  itemStyle,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}: DropdownProps) {
  const styles = useThemeStyles(createStyles);
  const overlayId = useId();
  const triggerRef = useRef<ViewInstance | null>(null);

  const setTriggerRef = useCallback((node: unknown) => {
    if (
      node &&
      typeof node === 'object' &&
      'measureInWindow' in node &&
      typeof node.measureInWindow === 'function'
    ) {
      triggerRef.current = node as ViewInstance;
      return;
    }

    triggerRef.current = null;
  }, []);

  const parsed = useMemo(() => parseDropdownChildren(children), [children]);

  const {
    contentCommand,
    filteredParsed,
    handleSearchChange,
    isSearchable,
    resolvedSearchValue,
  } = useDropdownSearch({
    parsed,
    searchable,
    command,
    searchValue,
    defaultSearchValue,
    onSearch,
  });

  const { navigableItems, data } = useDropdownEntries({
    parsed,
    filteredParsed,
    loading,
    loadingText,
    isSearchable,
    empty,
  });

  const resolvedPresentation = useOverlayPresentation(presentation);

  const contentStyleFromSlot = parsed.contentProps?.style;

  const presentationFromSlot =
    parsed.contentProps?.presentation === 'auto'
      ? undefined
      : parsed.contentProps?.presentation;

  const contentPresentation = presentationFromSlot ?? resolvedPresentation;

  const {
    isPositioned: positionReady,
    position,
    updatePosition,
    onFloatingLayout,
  } = useNativeFloatingPosition(placement, offset);

  const { isOpen, closeDropdown, toggleDropdown } = useDropdown({
    items: navigableItems,
    open,
    defaultOpen,
    disabled,
    onOpenChange,
    getItemValue: (item) => item.value,
    getItemText: (item) =>
      typeof item.label === 'string' ? item.label : item.value,
  });

  const { menuAccessibilityLabel } = useDropdownAccessibility({
    accessibilityLabel,
    label,
    open: isOpen,
  });

  useEffect(() => {
    if (!isOpen || contentPresentation !== 'popover') return;

    updatePosition(triggerRef);
  }, [isOpen, contentPresentation, updatePosition]);

  const { restoreFocusAfterClose } = useOverlayFocusRestore({
    active: isOpen,
    triggerRef,
  });

  const closeAndFocusTrigger = useCallback(() => {
    closeDropdown();
    restoreFocusAfterClose();
  }, [closeDropdown, restoreFocusAfterClose]);

  const dismiss = useOverlayDismiss({
    id: overlayId,
    active: isOpen,
    requestClose: closeAndFocusTrigger,
  });

  const handleSelect = useCallback(
    (entry: Extract<NativeDropdownEntry, { type: 'item' }>) => {
      if (entry.disabled || loading) return;

      const event = createDropdownSelectEvent();

      entry.props.onSelect?.(event);

      const shouldClose = entry.props.closeOnSelect ?? closeOnSelect;

      if (!event.defaultPrevented && shouldClose) {
        closeAndFocusTrigger();
      }
    },
    [closeAndFocusTrigger, closeOnSelect, loading]
  );

  const handleTriggerPress = useCallback(() => {
    toggleDropdown();
  }, [toggleDropdown]);

  const renderEntry = useCallback(
    ({ item }: { item: NativeDropdownEntry }) => {
      if (item.type === 'label') {
        return <DropdownGroup label={item.props.children} />;
      }

      if (item.type === 'separator') {
        return <DropdownSeparator />;
      }

      if (item.type === 'empty') {
        return <Text style={styles.emptyText}>{item.props.children}</Text>;
      }

      if (item.type === 'loading') {
        return <Text style={styles.emptyText}>{item.props.children}</Text>;
      }

      return (
        <DropdownItem
          asChild={item.props.asChild}
          label={item.props.children}
          value={item.props.value ?? item.id}
          color={item.props.color}
          icon={item.props.icon}
          disabled={item.props.disabled}
          textWrap={item.props.textWrap}
          onSelect={() => handleSelect(item)}
        >
          {item.props.children}
        </DropdownItem>
      );
    },
    [handleSelect, styles.emptyText]
  );

  const resolvedSearchPlaceholder =
    parsed.searchProps?.placeholder ??
    searchPlaceholder ??
    (command || contentCommand ? 'Type a command...' : 'Search actions...');

  const searchAccessibilityLabel = parsed.searchProps?.accessibilityLabel;

  const contextValue = useMemo(
    () => ({
      open: isOpen,
      disabled,
      loading,
      color,
      size,
      presentation: contentPresentation,
      positionReady,
      position,
      zIndex: dismiss.zIndex,

      searchable: isSearchable,
      searchValue: resolvedSearchValue,
      searchPlaceholder: resolvedSearchPlaceholder,
      searchAccessibilityLabel,

      itemStyle,
      textStyle,

      requestClose: dismiss.requestClose,
      getOutsidePressProps: dismiss.getOutsidePressProps,
      toggle: handleTriggerPress,
      onSearchChange: handleSearchChange,
      onFloatingLayout,
    }),
    [
      color,
      contentPresentation,
      disabled,
      dismiss.zIndex,
      dismiss.getOutsidePressProps,
      dismiss.requestClose,
      handleSearchChange,
      handleTriggerPress,
      isOpen,
      isSearchable,
      itemStyle,
      loading,
      onFloatingLayout,
      position,
      positionReady,
      resolvedSearchPlaceholder,
      resolvedSearchValue,
      searchAccessibilityLabel,
      size,
      textStyle,
    ]
  );

  return (
    <DropdownProvider value={contextValue}>
      <View style={[styles.root, style]}>
        <DropdownTrigger
          asChild={Boolean(parsed.trigger)}
          label={label}
          trigger={trigger ?? parsed.trigger}
          icon={icon}
          arrowIcon={arrowIcon}
          showArrow={showArrow}
          triggerRef={setTriggerRef}
          triggerStyle={triggerStyle}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
        />

        <DropdownContent
          contentStyle={[contentStyle, contentStyleFromSlot]}
          accessibilityLabel={menuAccessibilityLabel}
        >
          <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={renderEntry}
            keyboardShouldPersistTaps='handled'
            removeClippedSubviews={data.length > 24}
          />
        </DropdownContent>
      </View>
    </DropdownProvider>
  );
}

DropdownRoot.displayName = 'Dropdown';
