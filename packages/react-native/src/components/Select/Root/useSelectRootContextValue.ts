import { useMemo } from 'react';

import type { RefObject } from 'react';
import type { LayoutChangeEvent, TextInputInstance } from 'react-native';

import type {
  OverlayOutsidePressProps,
  OverlayOutsidePressPropsOptions,
} from '../../../hooks';
import type {
  SelectCollectionRow,
  SelectContextValue,
} from '../internal/types';
import type { SelectOption, SelectPresentation, SelectProps } from '../types';

type UseSelectRootContextValueParams = {
  color: NonNullable<SelectProps['color']>;
  variant: NonNullable<SelectProps['variant']>;
  isOpen: boolean;
  loading: boolean;
  searchable: boolean;
  multiple: boolean;
  maxSelected: number | undefined;
  virtual: SelectProps['virtual'];
  resolvedLabel: string;
  resolvedPresentation: Exclude<SelectPresentation, 'auto'>;
  zIndex: number;
  position: SelectContextValue['position'];
  onFloatingLayout: (event: LayoutChangeEvent) => void;
  matchTriggerWidth: boolean;
  triggerWidth: number | undefined;
  selectedValues: string[];
  selectedOptions: SelectOption[];
  optionsByValue: Map<string, SelectOption>;
  filteredRows: SelectCollectionRow[];
  selectedRowIndex: number;
  itemHeight: number;
  query: string;
  searchPlaceholder: string;
  searchInputRef: RefObject<TextInputInstance | null>;
  empty: SelectContextValue['empty'];
  loadingContent: SelectContextValue['loadingContent'];
  closeContent: () => void;
  getOutsidePressProps: (
    options?: OverlayOutsidePressPropsOptions
  ) => OverlayOutsidePressProps;
  selectOption: (option: SelectOption) => void;
  selectGroup: (values: string[]) => void;
  setQuery: (query: string) => void;
  renderOption: SelectProps['renderOption'];
  contentStyle: SelectProps['contentStyle'];
  optionStyle: SelectProps['optionStyle'];
  searchStyle: SelectProps['searchStyle'];
};

export function useSelectRootContextValue({
  color,
  variant,
  isOpen,
  loading,
  searchable,
  multiple,
  maxSelected,
  virtual,
  resolvedLabel,
  resolvedPresentation,
  zIndex,
  position,
  onFloatingLayout,
  matchTriggerWidth,
  triggerWidth,
  selectedValues,
  selectedOptions,
  optionsByValue,
  filteredRows,
  selectedRowIndex,
  itemHeight,
  query,
  searchPlaceholder,
  searchInputRef,
  empty,
  loadingContent,
  closeContent,
  getOutsidePressProps,
  selectOption,
  selectGroup,
  setQuery,
  renderOption,
  contentStyle,
  optionStyle,
  searchStyle,
}: UseSelectRootContextValueParams) {
  return useMemo<SelectContextValue>(
    () => ({
      color,
      variant,
      isOpen,
      loading,
      searchable,
      multiple,
      maxSelected,
      virtual,
      resolvedLabel,
      resolvedPresentation,
      zIndex,
      position,
      onFloatingLayout,
      matchTriggerWidth,
      triggerWidth,
      selectedValues,
      selectedOptions,
      optionsByValue,
      filteredRows,
      selectedRowIndex,
      itemHeight,
      query,
      searchPlaceholder,
      searchInputRef,
      empty,
      loadingContent,
      closeContent,
      getOutsidePressProps,
      selectOption,
      selectGroup,
      setQuery,
      renderOption,
      contentStyle,
      optionStyle,
      searchStyle,
    }),
    [
      color,
      variant,
      isOpen,
      loading,
      searchable,
      multiple,
      maxSelected,
      virtual,
      resolvedLabel,
      resolvedPresentation,
      zIndex,
      position,
      onFloatingLayout,
      matchTriggerWidth,
      triggerWidth,
      selectedValues,
      selectedOptions,
      optionsByValue,
      filteredRows,
      selectedRowIndex,
      itemHeight,
      query,
      searchPlaceholder,
      searchInputRef,
      empty,
      loadingContent,
      closeContent,
      getOutsidePressProps,
      selectOption,
      selectGroup,
      setQuery,
      renderOption,
      contentStyle,
      optionStyle,
      searchStyle,
    ]
  );
}
