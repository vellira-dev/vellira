import type {
  BaseDropdownContentProps,
  BaseDropdownItemProps,
  BaseDropdownProps,
  BaseDropdownSearchProps,
  BaseDropdownTriggerProps,
  FloatingPlacement,
  TextWrap,
} from '@vellira-ui/types';
import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export type DropdownPresentation = 'auto' | 'sheet' | 'modal' | 'popover';

export type DropdownSelectEvent = {
  /** Prevents the dropdown from performing its default select behavior. */
  preventDefault: () => void;
  /** Whether default select behavior has been prevented. */
  defaultPrevented: boolean;
};

export interface DropdownProps extends BaseDropdownProps {
  /** Trigger, content, and optional compound dropdown children. */
  children?: ReactNode;
  /** Visible trigger label when no custom trigger is provided. */
  label?: ReactNode;

  /** Custom trigger content. */
  trigger?: ReactNode;
  /** Icon rendered before the trigger label. */
  icon?: ReactNode;
  /** Icon rendered to indicate expanded state. */
  arrowIcon?: ReactNode;
  /** Shows or hides the trigger arrow icon. */
  showArrow?: boolean;

  /** Presentation mode used for dropdown content. */
  presentation?: DropdownPresentation;
  /** Floating placement used by popover presentation. */
  placement?: FloatingPlacement;
  /** Distance between the trigger and floating content. */
  offset?: number;
  /** Content shown while dropdown items are loading. */
  loadingText?: ReactNode;
  /** Content shown when no items match the current query. */
  empty?: ReactNode;

  /** Style applied to the root container. */
  style?: StyleProp<ViewStyle>;
  /** Style applied to the trigger container. */
  triggerStyle?: StyleProp<ViewStyle>;
  /** Style applied to dropdown content. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Optional native background behind popover items (e.g. an injected BlurView). */
  popoverBackground?: ReactNode;
  /** Style applied to each item row. */
  itemStyle?: StyleProp<ViewStyle>;
  /** Style applied to trigger and item text. */
  textStyle?: StyleProp<TextStyle>;

  /** Accessible name announced for the dropdown trigger. */
  accessibilityLabel?: string;
  /** Additional accessibility hint for the dropdown trigger. */
  accessibilityHint?: string;
}

export interface DropdownTriggerProps extends BaseDropdownTriggerProps {
  /** Composes trigger behavior onto a single child element. */
  asChild?: boolean;
  /** Trigger content. */
  children?: ReactNode;
}

export interface DropdownContentProps extends BaseDropdownContentProps {
  /** Dropdown item and slot content. */
  children?: ReactNode;
  /** Style applied to dropdown content. */
  style?: StyleProp<ViewStyle>;
  /** Presentation mode used for this content. */
  presentation?: DropdownPresentation;
}

export interface DropdownSearchProps extends BaseDropdownSearchProps {
  /** Accessible name for the search input. */
  accessibilityLabel?: string;
}

export interface DropdownItemProps extends BaseDropdownItemProps {
  /** Item label or custom item content. */
  children: ReactNode;
  /** Composes item behavior onto a single child element. */
  asChild?: boolean;
  /** Value associated with this item for selection and filtering. */
  value?: string;
  /** Icon rendered before the item label. */
  icon?: ReactNode;
  /** Controls wrapping behavior for item text. */
  textWrap?: TextWrap;
  /** Called when this item is selected. */
  onSelect?: (event: DropdownSelectEvent) => void;
}

export type DropdownSeparatorProps = object;

export interface DropdownGroupProps {
  /** Grouped dropdown items. */
  children?: ReactNode;
}

export interface DropdownLabelProps {
  /** Label content for a dropdown group. */
  children?: ReactNode;
}

export interface DropdownEmptyProps {
  /** Empty state content. */
  children?: ReactNode;
}

export interface DropdownLoadingProps {
  /** Loading state content. */
  children?: ReactNode;
}
