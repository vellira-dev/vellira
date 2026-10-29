import { useEffect, useRef, useState } from 'react';

import { FlatList, Pressable, Text, View } from 'react-native';

import { useTheme, useThemeStyles } from '../../../theme';
import { SelectEmptyState } from '../Empty';
import { SelectGroupActionRow, SelectGroupLabelRow } from '../Group';
import { createSelectSlot } from '../internal/SelectCollection';
import { useSelectContext } from '../internal/SelectContext';
import type { SelectCollectionRow } from '../internal/types';
import { SelectItemRow } from '../Item';
import { SelectLoadingState } from '../Loading';
import { SelectModal, SelectPopover, SelectSheet } from '../Presentation';
import { SelectSearchField } from '../Search';
import { SelectSeparatorRow } from '../Separator';
import type { SelectContentProps } from '../types';

import {
  SELECT_LIST_MAX_HEIGHT,
  createContentStyles,
} from './SelectContent.styles';

export const SelectContent = createSelectSlot<SelectContentProps>(
  'content',
  'Select.Content'
);

export const SelectContentSurface = () => {
  const styles = useThemeStyles(createContentStyles);
  const { theme } = useTheme();
  const wasOpenRef = useRef(false);
  const [openCycle, setOpenCycle] = useState(0);
  const context = useSelectContext();
  const {
    isOpen,
    resolvedPresentation,
    zIndex,
    position,
    onFloatingLayout,
    contentStyle,
    matchTriggerWidth,
    triggerWidth,
    resolvedLabel,
    closeContent,
    getOutsidePressProps,
    searchable,
    loading,
    filteredRows,
    selectedValues,
    selectedOptions,
    maxSelected,
    optionStyle,
    selectOption,
    selectGroup,
    itemHeight,
    selectedRowIndex,
    query,
  } = context;
  const shouldSeedSelectedPosition =
    Boolean(context.virtual) && selectedRowIndex > 0 && query === '';
  const initialScrollIndex = shouldSeedSelectedPosition
    ? selectedRowIndex
    : undefined;

  // Native FlatList doesn't always measure its full content when placed inside
  // a compact Modal/Sheet. Reserve a viewport for every visible row (up to the
  // established scroll cap) so entries after the first cannot be clipped.
  // The row estimate matches getItemLayout and includes vertical list padding.
  const estimatedListHeight =
    filteredRows.length * itemHeight + theme.tokens.spacing[2] * 2;
  const listViewportHeight = Math.min(
    SELECT_LIST_MAX_HEIGHT,
    estimatedListHeight
  );

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setOpenCycle((cycle) => cycle + 1);
    }

    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const renderRow = ({
    item,
    index,
  }: {
    item: SelectCollectionRow;
    index: number;
  }) => {
    if (item.type === 'group') {
      if (item.selectable && context.multiple) {
        const enabledGroupValues = item.itemValues.filter((value) =>
          context.optionsByValue.get(value)
        );
        const selectedGroupCount = selectedOptions.filter((option) =>
          enabledGroupValues.includes(option.value)
        ).length;

        return (
          <SelectGroupActionRow
            label={item.label}
            selectLabel={item.selectLabel}
            selectedCount={selectedGroupCount}
            itemCount={enabledGroupValues.length}
            onPress={() => selectGroup(enabledGroupValues)}
          />
        );
      }

      return <SelectGroupLabelRow label={item.label} />;
    }

    if (item.type === 'separator') {
      return <SelectSeparatorRow />;
    }

    const isSelected = selectedValues.includes(item.option.value);
    const maxReached =
      !isSelected &&
      typeof maxSelected === 'number' &&
      selectedValues.length >= maxSelected;

    return (
      <SelectItemRow
        option={item.option}
        isSelected={isSelected}
        isDisabled={Boolean(item.option.disabled || maxReached)}
        itemIndex={index}
        selectedValues={selectedValues}
        multiple={context.multiple}
        optionStyle={optionStyle}
        onSelect={selectOption}
      />
    );
  };

  const body = (
    <>
      <View
        style={styles.toolbar}
        accessible
        accessibilityRole='toolbar'
        accessibilityLabel={`${resolvedLabel} selection actions`}
      >
        <Pressable
          onPress={closeContent}
          hitSlop={8}
          style={styles.toolbarAction}
          accessibilityRole='button'
          accessibilityLabel='Close selection'
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>

        <Text style={styles.title} numberOfLines={1} accessibilityRole='header'>
          {resolvedLabel}
        </Text>

        <Pressable
          onPress={closeContent}
          hitSlop={8}
          style={styles.toolbarAction}
          accessibilityRole='button'
          accessibilityLabel='Done'
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>

      {searchable && <SelectSearchField />}

      {loading && filteredRows.length === 0 ? (
        <SelectLoadingState />
      ) : filteredRows.length === 0 ? (
        <SelectEmptyState />
      ) : (
        <FlatList
          key={`select-list-${openCycle}`}
          data={filteredRows}
          keyExtractor={(item) => item.key}
          renderItem={renderRow}
          style={[styles.list, { height: listViewportHeight }]}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps='handled'
          initialScrollIndex={initialScrollIndex}
          initialNumToRender={
            typeof context.virtual === 'object'
              ? context.virtual.initialNumToRender
              : 12
          }
          windowSize={
            typeof context.virtual === 'object' ? context.virtual.windowSize : 7
          }
          getItemLayout={(_data, index) => ({
            length: itemHeight,
            offset: itemHeight * index,
            index,
          })}
        />
      )}
    </>
  );

  if (resolvedPresentation === 'sheet') {
    return (
      <SelectSheet
        visible={isOpen}
        onClose={closeContent}
        outsidePressProps={getOutsidePressProps({
          accessibilityLabel: 'Dismiss select',
        })}
        zIndex={zIndex}
        contentStyle={contentStyle}
      >
        {body}
      </SelectSheet>
    );
  }

  if (resolvedPresentation === 'popover') {
    return (
      <SelectPopover
        visible={isOpen}
        onClose={closeContent}
        outsidePressProps={getOutsidePressProps({
          accessibilityLabel: 'Dismiss select',
        })}
        position={position}
        zIndex={zIndex}
        onFloatingLayout={onFloatingLayout}
        matchTriggerWidth={matchTriggerWidth}
        triggerWidth={triggerWidth}
        contentStyle={contentStyle}
      >
        {body}
      </SelectPopover>
    );
  }

  return (
    <SelectModal
      visible={isOpen}
      onClose={closeContent}
      outsidePressProps={getOutsidePressProps({
        accessibilityLabel: 'Dismiss select',
      })}
      zIndex={zIndex}
      contentStyle={contentStyle}
    >
      {body}
    </SelectModal>
  );
};

SelectContentSurface.displayName = 'Select.ContentSurface';
