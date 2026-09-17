import type { CompoundSlotComponent } from '@vellira-ui/core';
import type { ReactNode, RefObject } from 'react';
import type { LayoutChangeEvent, TextInputInstance } from 'react-native';

import type {
  OverlayOutsidePressProps,
  OverlayOutsidePressPropsOptions,
} from '../../../hooks';
import type { SelectOption, SelectPresentation, SelectProps } from '../types';

export type SelectSlot =
  | 'trigger'
  | 'value'
  | 'icon'
  | 'content'
  | 'search'
  | 'group'
  | 'label'
  | 'item'
  | 'itemIcon'
  | 'itemDescription'
  | 'itemBadge'
  | 'separator'
  | 'empty'
  | 'loading';

export type SelectSlotComponent<TComponent = unknown> = CompoundSlotComponent<
  TComponent,
  SelectSlot
>;

export type SelectCollectionOption = SelectOption & {
  asChild?: boolean;
  children?: ReactNode;
};

export type SelectCollectionRow =
  | {
      type: 'group';
      key: string;
      label: string;
      selectable?: boolean;
      selectLabel?: string;
      itemValues: string[];
    }
  | { type: 'separator'; key: string }
  | { type: 'item'; key: string; option: SelectCollectionOption };

export type ParsedSelectChildren = {
  options: SelectCollectionOption[];
  rows: SelectCollectionRow[];
  searchable: boolean;
  searchPlaceholder?: string;
  empty?: ReactNode;
  loading?: ReactNode;
};

export type ResolveSelectAccessibilityParams = {
  accessibilityLabel?: string;
  accessibilityHint?: string;
  label?: string;
  description?: ReactNode;
  error?: ReactNode;
  invalid: boolean;
  placeholder: string;
  selectedLabel?: string;
  hasFieldContext: boolean;
  fieldDescribedBy?: string;
};

export type SelectContextValue = {
  color: NonNullable<SelectProps['color']>;
  variant: NonNullable<SelectProps['variant']>;
  isOpen: boolean;
  loading: boolean;
  searchable: boolean;
  multiple: boolean;
  maxSelected?: number;
  virtual: SelectProps['virtual'];
  resolvedLabel: string;
  resolvedPresentation: Exclude<SelectPresentation, 'auto'>;
  zIndex: number;
  position: {
    top: number;
    left: number;
  };
  onFloatingLayout: (event: LayoutChangeEvent) => void;
  matchTriggerWidth: boolean;
  triggerWidth?: number;
  selectedValues: string[];
  selectedOptions: SelectOption[];
  optionsByValue: Map<string, SelectOption>;
  filteredRows: SelectCollectionRow[];
  selectedRowIndex: number;
  itemHeight: number;
  query: string;
  searchPlaceholder: string;
  searchInputRef: RefObject<TextInputInstance | null>;
  empty: ReactNode;
  loadingContent: ReactNode;
  closeContent: () => void;
  getOutsidePressProps: (
    options?: OverlayOutsidePressPropsOptions
  ) => OverlayOutsidePressProps;
  selectOption: (option: SelectOption) => void;
  selectGroup: (values: string[]) => void;
  setQuery: (query: string) => void;
  renderOption: NonNullable<SelectProps['renderOption']> | undefined;
  contentStyle: SelectProps['contentStyle'];
  optionStyle: SelectProps['optionStyle'];
  searchStyle: SelectProps['searchStyle'];
};
