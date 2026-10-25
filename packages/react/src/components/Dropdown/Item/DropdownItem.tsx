import {
  cloneElement,
  isValidElement,
  type MouseEvent,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
  useRef,
  useState,
} from 'react';

import { Check, ChevronRight } from '@vellira-ui/icons';

import {
  createDropdownSlot,
  getItemCompoundSlots,
} from '../internal/DropdownCollection';
import { useDropdownContext } from '../internal/DropdownContext';
import type { DropdownCollectionItem } from '../internal/types';
import type { DropdownItemProps, DropdownSelectEvent } from '../types';

import type { DropdownItemRowProps } from './types';

import styles from './DropdownItem.module.scss';

import { cn } from '#utils/cn';
import { devWarning } from '#utils/devWarning';

export const DropdownItem = createDropdownSlot<DropdownItemProps>(
  'item',
  'Dropdown.Item'
);

type DropdownItemChildProps = {
  'aria-checked'?: boolean;
  'aria-controls'?: string;
  'aria-disabled'?: boolean;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: string;
  'data-active'?: boolean;
  'data-state'?: string;
  children?: ReactNode;
  className?: string;
  id?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  role?: string;
  tabIndex?: number;
};

export const DropdownItemRow = ({ item, itemIndex }: DropdownItemRowProps) => {
  const context = useDropdownContext();
  const subOpenTimerRef = useRef<number | undefined>(undefined);
  const [uncontrolledChecked, setUncontrolledChecked] = useState(
    item.type === 'checkbox' ? (item.props.defaultChecked ?? false) : false
  );
  const isActive = context.activeIndex === itemIndex;
  const isSubOpen = context.openSubId === item.id;
  const isCheckbox = item.type === 'checkbox';
  const isRadio = item.type === 'radio';
  const isSubTrigger = item.type === 'subTrigger';
  const isChecked = isCheckbox
    ? (item.props.checked ?? uncontrolledChecked)
    : isRadio
      ? (item.groupProps?.value ?? context.radioValues[item.groupId]) ===
        item.props.value
      : false;
  const disabled = context.loading || item.disabled;
  const props = item.props;
  const slots = getItemCompoundSlots(props.children);
  const icon = slots.icon ?? props.icon;
  const description =
    slots.description ??
    ('description' in props ? props.description : undefined);
  const badge = slots.badge ?? ('badge' in props ? props.badge : undefined);
  const shortcut = slots.shortcut ?? props.shortcut;
  const content = slots.content.length ? slots.content : props.children;
  const itemColor = 'color' in props ? props.color : undefined;
  const href = item.type === 'item' ? item.props.href : undefined;
  const target = item.type === 'item' ? item.props.target : undefined;
  const download = item.type === 'item' ? item.props.download : undefined;
  const itemId = context.getItemId(itemIndex);
  const role = isCheckbox
    ? 'menuitemcheckbox'
    : isRadio
      ? 'menuitemradio'
      : 'menuitem';
  const rel =
    item.type === 'item' && target === '_blank' && !item.props.rel
      ? 'noreferrer noopener'
      : item.type === 'item'
        ? item.props.rel
        : undefined;
  const Component = href ? 'a' : 'li';
  const hasIndicator = isCheckbox || isRadio;
  const child =
    props.asChild && isValidElement<DropdownItemChildProps>(props.children)
      ? (props.children as ReactElement<DropdownItemChildProps>)
      : undefined;
  const itemClassName = cn(
    styles.item,
    styles[context.size],
    {
      [styles.active]: isActive,
      [styles.disabled]: disabled,
      [styles.checked]: isChecked,
    },
    itemColor && itemColor !== 'default' ? styles[itemColor] : undefined,
    props.className
  );

  devWarning(
    !props.asChild || Boolean(child),
    'Dropdown.Item: asChild requires a single valid React element child.'
  );

  const handleSelect = (event: MouseEvent<HTMLElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }

    if (isCheckbox && item.type === 'checkbox') {
      const nextChecked = !isChecked;
      setUncontrolledChecked(nextChecked);
      item.props.onCheckedChange?.(nextChecked);
    }

    context.selectItem(item, createDropdownSelectEvent(event));
  };

  const handleMouseEnter: MouseEventHandler<HTMLElement> = () => {
    if (disabled) return;

    context.setActiveIndex(itemIndex);

    if (isSubTrigger) {
      window.clearTimeout(subOpenTimerRef.current);
      subOpenTimerRef.current = window.setTimeout(
        () => context.setOpenSubId(item.id),
        120
      );
    } else {
      window.clearTimeout(subOpenTimerRef.current);
      context.setOpenSubId(undefined);
    }
  };

  const handleMouseLeave: MouseEventHandler<HTMLElement> = () => {
    window.clearTimeout(subOpenTimerRef.current);
  };

  if (child) {
    return (
      <>
        {cloneElement(child, {
          id: itemId,
          role,
          tabIndex: disabled ? -1 : 0,
          'aria-disabled': disabled || undefined,
          'aria-checked': isCheckbox || isRadio ? isChecked : undefined,
          'aria-haspopup': isSubTrigger ? 'menu' : undefined,
          'aria-expanded': isSubTrigger ? isSubOpen : undefined,
          'aria-controls':
            isSubTrigger && isSubOpen ? `${itemId}-submenu` : undefined,
          'data-active': isActive || undefined,
          'data-state': isSubOpen ? 'open' : undefined,
          className: cn(child.props.className, itemClassName),
          onClick: (event) => {
            child.props.onClick?.(event);

            if (!event.defaultPrevented) {
              handleSelect(event);
            }
          },
          onMouseEnter: (event) => {
            child.props.onMouseEnter?.(event);

            if (!event.defaultPrevented) {
              handleMouseEnter(event);
            }
          },
          onMouseLeave: (event) => {
            child.props.onMouseLeave?.(event);

            if (!event.defaultPrevented) {
              handleMouseLeave(event);
            }
          },
        })}

        {renderSubMenu(item, itemId, isSubTrigger, isSubOpen, () =>
          context.setOpenSubId(item.id)
        )}
      </>
    );
  }

  return (
    <>
      <Component
        id={itemId}
        role={role}
        href={Component === 'a' && !disabled ? href : undefined}
        target={Component === 'a' && !disabled ? target : undefined}
        rel={Component === 'a' ? rel : undefined}
        download={Component === 'a' && !disabled ? download : undefined}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-checked={isCheckbox || isRadio ? isChecked : undefined}
        aria-haspopup={isSubTrigger ? 'menu' : undefined}
        aria-expanded={isSubTrigger ? isSubOpen : undefined}
        aria-controls={
          isSubTrigger && isSubOpen ? `${itemId}-submenu` : undefined
        }
        data-active={isActive || undefined}
        data-state={isSubOpen ? 'open' : undefined}
        className={itemClassName}
        onClick={handleSelect}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {icon && <span className={styles.itemIcon}>{icon}</span>}

        <span className={styles.itemText}>
          <span className={styles.itemLabel}>{content}</span>
          {description && (
            <span className={styles.itemDescription}>{description}</span>
          )}
        </span>

        {badge && <span className={styles.itemBadge}>{badge}</span>}

        {shortcut && <span className={styles.itemShortcut}>{shortcut}</span>}

        {hasIndicator && (
          <span className={styles.indicator} aria-hidden='true'>
            {isChecked ? <Check /> : null}
          </span>
        )}

        {isSubTrigger && (
          <span className={styles.itemShortcut} aria-hidden='true'>
            <ChevronRight />
          </span>
        )}
      </Component>

      {renderSubMenu(item, itemId, isSubTrigger, isSubOpen, () =>
        context.setOpenSubId(item.id)
      )}
    </>
  );
};

DropdownItemRow.displayName = 'DropdownItemRow';

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

function renderSubMenu(
  item: DropdownCollectionItem,
  itemId: string,
  isSubTrigger: boolean,
  isSubOpen: boolean,
  onMouseEnter: () => void
) {
  if (!isSubTrigger || !isSubOpen || item.type !== 'subTrigger') return null;
  if (item.subEntries.length === 0) return null;

  return (
    <ul
      id={`${itemId}-submenu`}
      role='menu'
      aria-labelledby={itemId}
      className={styles.subContent}
      onMouseEnter={onMouseEnter}
    >
      {item.subEntries.map((entry) => {
        if (entry.type === 'label') {
          return (
            <li key={entry.id} role='presentation' className={styles.subLabel}>
              {entry.props.children}
            </li>
          );
        }

        if (entry.type === 'separator') {
          return (
            <li
              key={entry.id}
              role='separator'
              className={styles.subSeparator}
              aria-hidden='true'
            />
          );
        }

        if (entry.type !== 'item') return null;

        return (
          <SubMenuItemRow
            key={entry.item.id}
            item={entry.item}
            itemIndex={entry.itemIndex}
            id={`${itemId}-${entry.itemIndex}`}
          />
        );
      })}
    </ul>
  );
}

function SubMenuItemRow({
  id,
  item,
  itemIndex,
}: {
  id: string;
  item: DropdownCollectionItem;
  itemIndex: number;
}) {
  const context = useDropdownContext();
  const [uncontrolledChecked, setUncontrolledChecked] = useState(
    item.type === 'checkbox' ? (item.props.defaultChecked ?? false) : false
  );
  const isCheckbox = item.type === 'checkbox';
  const isRadio = item.type === 'radio';
  const isChecked = isCheckbox
    ? (item.props.checked ?? uncontrolledChecked)
    : isRadio
      ? (item.groupProps?.value ?? context.radioValues[item.groupId]) ===
        item.props.value
      : false;
  const props = item.props;
  const slots = getItemCompoundSlots(props.children);
  const icon = slots.icon ?? props.icon;
  const description =
    slots.description ??
    ('description' in props ? props.description : undefined);
  const badge = slots.badge ?? ('badge' in props ? props.badge : undefined);
  const shortcut = slots.shortcut ?? props.shortcut;
  const content = slots.content.length ? slots.content : props.children;
  const itemColor = 'color' in props ? props.color : undefined;
  const disabled = context.loading || item.disabled;
  const isActive = context.activeSubIndex === itemIndex;
  const href = item.type === 'item' ? item.props.href : undefined;
  const target = item.type === 'item' ? item.props.target : undefined;
  const download = item.type === 'item' ? item.props.download : undefined;
  const role = isCheckbox
    ? 'menuitemcheckbox'
    : isRadio
      ? 'menuitemradio'
      : 'menuitem';
  const rel =
    item.type === 'item' && target === '_blank' && !item.props.rel
      ? 'noreferrer noopener'
      : item.type === 'item'
        ? item.props.rel
        : undefined;
  const Component = href ? 'a' : 'li';
  const hasIndicator = isCheckbox || isRadio;

  const handleSelect = (event: MouseEvent<HTMLElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }

    if (isCheckbox && item.type === 'checkbox') {
      const nextChecked = !isChecked;
      setUncontrolledChecked(nextChecked);
      item.props.onCheckedChange?.(nextChecked);
    }

    context.selectItem(item, createDropdownSelectEvent(event));
  };

  return (
    <Component
      id={id}
      role={role}
      href={Component === 'a' && !disabled ? href : undefined}
      target={Component === 'a' && !disabled ? target : undefined}
      rel={Component === 'a' ? rel : undefined}
      download={Component === 'a' && !disabled ? download : undefined}
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      aria-checked={isCheckbox || isRadio ? isChecked : undefined}
      data-active={isActive || undefined}
      className={cn(
        styles.item,
        { [styles.active]: isActive },
        styles[context.size],
        {
          [styles.disabled]: disabled,
          [styles.checked]: isChecked,
        },
        itemColor && itemColor !== 'default' ? styles[itemColor] : undefined
      )}
      onClick={handleSelect}
      onMouseEnter={() => {
        if (!disabled) context.setActiveSubIndex(itemIndex);
      }}
    >
      {hasIndicator && (
        <span className={styles.indicator} aria-hidden='true'>
          {isChecked ? <Check /> : null}
        </span>
      )}

      {icon && <span className={styles.itemIcon}>{icon}</span>}

      <span className={styles.itemText}>
        <span className={styles.itemLabel}>{content}</span>
        {description && (
          <span className={styles.itemDescription}>{description}</span>
        )}
      </span>

      {badge && <span className={styles.itemBadge}>{badge}</span>}
      {shortcut && <span className={styles.itemShortcut}>{shortcut}</span>}
    </Component>
  );
}
