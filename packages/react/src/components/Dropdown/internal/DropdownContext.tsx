import { createContext, useContext } from 'react';

import type { DropdownColor, DropdownSize } from '@vellira-ui/types';
import type {
  CSSProperties,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
  RefCallback,
} from 'react';

import type {
  DropdownContentProps,
  DropdownSearchProps,
  DropdownSelectEvent,
} from '../types';

import type { DropdownCollectionItem, DropdownRenderEntry } from './types';

export type DropdownContextValue = {
  activeDescendantId?: string;
  activeIndex: number;
  activeSubIndex: number;
  closeOnSelect: boolean;
  color: DropdownColor;
  contentReadyToFocus: boolean;
  contentId: string;
  contentProps?: DropdownContentProps;
  disabled?: boolean;
  entries: DropdownRenderEntry[];
  getItemId: (index: number) => string;
  isOpen: boolean;
  items: DropdownCollectionItem[];
  loading?: boolean;
  loadingText?: ReactNode;
  empty?: ReactNode;
  maxWidth?: number | string;
  minWidth?: number | string;
  openSubId?: string;
  searchPlaceholder: string;
  searchProps?: DropdownSearchProps;
  searchValue: string;
  searchable: boolean;
  portal?: boolean;
  radioValues: Record<string, string | undefined>;
  onKeyDown: KeyboardEventHandler<HTMLElement>;
  selectItem: (
    item: DropdownCollectionItem,
    event: DropdownSelectEvent
  ) => void;
  setActiveIndex: (index: number) => void;
  setActiveSubIndex: (index: number) => void;
  setContentRef: RefCallback<HTMLElement>;
  setOpenSubId: (id: string | undefined) => void;
  setRadioValue: (groupId: string, value: string) => void;
  setSearchValue: (value: string) => void;
  size: DropdownSize;
  surfaceStyle: CSSProperties;
  triggerId: string;
};

export type DropdownTriggerContextValue = {
  disabled?: boolean;
  isOpen: boolean;
  contentId: string;
  triggerId: string;
  setTriggerRef: RefCallback<HTMLElement>;
  onClick: MouseEventHandler<HTMLElement>;
  onKeyDown: KeyboardEventHandler<HTMLElement>;
};

export type DropdownRadioGroupContextValue = {
  value?: string;
  setValue: (value: string) => void;
};

const DropdownContext = createContext<DropdownContextValue | null>(null);
const DropdownTriggerContext =
  createContext<DropdownTriggerContextValue | null>(null);
const DropdownRadioGroupContext =
  createContext<DropdownRadioGroupContextValue | null>(null);

export const DropdownProvider = DropdownContext.Provider;
export const DropdownTriggerProvider = DropdownTriggerContext.Provider;
export const DropdownRadioGroupProvider = DropdownRadioGroupContext.Provider;

export function useDropdownContext() {
  const context = useContext(DropdownContext);

  if (!context) {
    throw new Error(
      'Dropdown compound components must be used inside Dropdown.'
    );
  }

  return context;
}

export function useDropdownTriggerContext() {
  const context = useContext(DropdownTriggerContext);

  if (!context) {
    throw new Error('Dropdown.Trigger must be used inside Dropdown.');
  }

  return context;
}

export function useDropdownRadioGroupContext() {
  return useContext(DropdownRadioGroupContext);
}
