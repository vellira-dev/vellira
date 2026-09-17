import { useCallback, useId, useRef, useState } from 'react';

import type { TextInputInstance, ViewInstance } from 'react-native';

import {
  useOverlayDismiss,
  useOverlayFocusRestore,
  useOverlayPresentation,
} from '../../../hooks';
import { useSelectCollection } from '../../../hooks/behavior/select/useSelectCollection';
import { useSelectSearch } from '../../../hooks/behavior/select/useSelectSearch';
import { useNativeFloatingPosition } from '../../../managers';
import { useFormFieldContext } from '../../../patterns/FormField';
import { resolveSelectAccessibility } from '../internal/resolveSelectAccessibility';
import type { SelectProps } from '../types';

import { useSelectRootActions } from './useSelectRootActions';
import { useSelectRootContextValue } from './useSelectRootContextValue';
import { useSelectRootDisplayValue } from './useSelectRootDisplayValue';
import { useSelectRootSelection } from './useSelectRootSelection';

export function useSelectRootState(props: SelectProps) {
  const {
    label,
    description,
    error,
    invalid = false,
    required = false,
    disabled = false,
    placeholder = 'Select...',
    color = 'primary',
    variant = 'outline',
    size,
    clearable = false,
    searchable: searchableProp,
    searchPlaceholder,
    loading = false,
    loadingText = 'Loading...',
    onSearch,
    filterOptions,
    filter,
    empty,
    startIcon,
    endIcon,
    prefix,
    suffix,
    renderValue,
    renderOption,
    closeOnSelect,
    maxSelected,
    presentation = 'auto',
    placement = 'bottom-start',
    offset = 8,
    matchTriggerWidth = false,
    dismissOnBackdropPress = true,
    virtual,
    options: optionsProp,
    children,
    style,
    triggerStyle,
    textStyle,
    contentStyle,
    optionStyle,
    searchStyle,
    accessibilityLabel,
    accessibilityHint,
    testID,
  } = props;

  const field = useFormFieldContext();
  const overlayId = useId();
  const hasOwnField = Boolean(label || description || error);
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>();
  const triggerRef = useRef<ViewInstance | null>(null);
  const searchInputRef = useRef<TextInputInstance>(null);
  const selectedFocusValueRef = useRef<string | undefined>(undefined);
  const resolvedPresentation = useOverlayPresentation(presentation);
  const { position, updatePosition, onFloatingLayout } =
    useNativeFloatingPosition(placement, offset);

  const {
    options,
    rows,
    searchableFromChildren,
    searchPlaceholderFromChildren,
    emptyFromChildren,
    loadingFromChildren,
  } = useSelectCollection(children, optionsProp);

  const resolvedSize = size ?? field?.size ?? 'md';
  const isInvalid =
    invalid || Boolean(error) || (!hasOwnField && Boolean(field?.invalid));
  const isDisabled = disabled || (!hasOwnField && Boolean(field?.disabled));
  const isRequired = required || (!hasOwnField && Boolean(field?.required));

  const {
    setSelectedValue,
    selectedValues,
    selectedOption,
    selectedOptions,
    optionsByValue,
    isOpen,
    openDropdown,
    closeDropdown,
    selectValue,
  } = useSelectRootSelection({
    props,
    options,
    isDisabled,
  });

  const { restoreFocusAfterClose } = useOverlayFocusRestore({
    active: isOpen,
    triggerRef,
  });

  const closeAndFocusTrigger = useCallback(() => {
    closeDropdown();
    restoreFocusAfterClose();
  }, [closeDropdown, restoreFocusAfterClose]);

  const { query, setQuery, shouldSearch, filteredRows } = useSelectSearch({
    rows,
    isOpen,
    searchable: searchableProp,
    searchableFromChildren,
    onSearch,
    filterOptions,
    filter,
  });

  const openAndPositionDropdown = useCallback(() => {
    updatePosition(triggerRef);
    openDropdown();
  }, [openDropdown, updatePosition]);

  const selectedFocusValue = selectedValues.includes(
    selectedFocusValueRef.current ?? ''
  )
    ? selectedFocusValueRef.current
    : selectedValues[0];
  const selectedRowIndex = Math.max(
    0,
    filteredRows.findIndex(
      (row) => row.type === 'item' && row.option.value === selectedFocusValue
    )
  );
  const itemHeight =
    typeof virtual === 'object' ? (virtual.estimatedItemSize ?? 46) : 46;

  const displayValue = useSelectRootDisplayValue({
    multiple: Boolean(props.multiple),
    placeholder,
    renderValue,
    selectedOption,
    selectedOptions,
    selectedValues,
  });

  const { resolvedLabel, resolvedHint, announce } = resolveSelectAccessibility({
    accessibilityLabel,
    accessibilityHint,
    label: !hasOwnField ? undefined : label,
    description: !hasOwnField ? field?.description : description,
    error: !hasOwnField ? field?.error : error,
    invalid: isInvalid,
    placeholder,
    selectedLabel: selectedOption?.label,
    hasFieldContext: !hasOwnField && Boolean(field),
    fieldDescribedBy: field?.ariaDescribedBy,
  });

  const hasValue = selectedValues.length > 0;
  const dismiss = useOverlayDismiss({
    id: overlayId,
    active: isOpen,
    closeOnOutsidePress: dismissOnBackdropPress,
    requestClose: closeAndFocusTrigger,
  });

  const { clearValue, selectOption, selectGroup } = useSelectRootActions({
    multiple: Boolean(props.multiple),
    maxSelected,
    closeOnSelect,
    selectedValues,
    optionsByValue,
    selectedFocusValueRef,
    selectValue,
    setSelectedValue,
    announce,
    closeAndFocusTrigger,
  });

  const resolvedSearchPlaceholder =
    searchPlaceholder ?? searchPlaceholderFromChildren ?? 'Search...';

  const resolvedEmpty = empty ?? emptyFromChildren ?? 'Nothing found';
  const resolvedLoadingContent = loadingFromChildren ?? loadingText;

  const contextValue = useSelectRootContextValue({
    color,
    variant,
    isOpen,
    loading,
    searchable: shouldSearch,
    multiple: Boolean(props.multiple),
    maxSelected,
    virtual,
    resolvedLabel,
    resolvedPresentation,
    zIndex: dismiss.zIndex,
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
    searchPlaceholder: resolvedSearchPlaceholder,
    searchInputRef,
    empty: resolvedEmpty,
    loadingContent: resolvedLoadingContent,
    closeContent: dismiss.requestClose,
    getOutsidePressProps: dismiss.getOutsidePressProps,
    selectOption,
    selectGroup,
    setQuery,
    renderOption,
    contentStyle,
    optionStyle,
    searchStyle,
  });

  return {
    contextValue,
    displayValue,
    field,
    hasOwnField,
    hasValue,
    isDisabled,
    isInvalid,
    isOpen,
    isRequired,
    clearValue,
    openDropdown: openAndPositionDropdown,
    resolvedHint,
    resolvedLabel,
    resolvedSize,
    setTriggerWidth,
    triggerRef,
    controlProps: {
      clearable,
      color,
      endIcon,
      loading,
      prefix,
      startIcon,
      suffix,
      testID,
      textStyle,
      triggerStyle,
      variant,
    },
    formFieldProps: {
      description,
      error,
      label,
      style,
    },
  };
}
