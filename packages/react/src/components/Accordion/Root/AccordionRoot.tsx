import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useId,
  useMemo,
  useState,
} from 'react';

import type { ReactElement, ReactNode } from 'react';

import { AccordionContent } from '../Content';
import { AccordionItem } from '../Item';
import { AccordionTrigger } from '../Trigger';
import type { AccordionProps } from '../types';

import styles from '../Accordion.module.scss';

type InternalProps = {
  className?: string;
  contentId?: string;
  disabled?: boolean;
  hidden?: boolean;
  expanded?: boolean;
  onActivate?: () => void;
};

type InternalItemProps = {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  value: string;
};

export function AccordionRoot(props: AccordionProps) {
  const { children, value, defaultValue, disabled = false } = props;
  const type = props.type ?? 'single';
  const collapsible =
    props.type === 'multiple' ? false : (props.collapsible ?? false);
  const instanceId = useId();
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState<string | string[]>(
    defaultValue ?? (type === 'multiple' ? [] : '')
  );
  const expandedValues = useMemo(() => {
    const selectedValues = (isControlled ? value : uncontrolledValue) ?? [];

    return Array.isArray(selectedValues)
      ? selectedValues
      : selectedValues
        ? [selectedValues]
        : [];
  }, [isControlled, uncontrolledValue, value]);

  const selectValue = useCallback(
    (itemValue: string) => {
      if (disabled) return;

      const isExpanded = expandedValues.includes(itemValue);

      if (props.type === 'multiple') {
        const nextValues = isExpanded
          ? expandedValues.filter((current) => current !== itemValue)
          : [...expandedValues, itemValue];

        if (!isControlled) setUncontrolledValue(nextValues);
        props.onValueChange?.(nextValues);
        return;
      }

      const nextValues = isExpanded
        ? collapsible
          ? []
          : expandedValues
        : [itemValue];
      const nextValue = nextValues[0] ?? '';

      if (!isControlled) setUncontrolledValue(nextValue);
      props.onValueChange?.(nextValue);
    },
    [
      collapsible,
      disabled,
      expandedValues,
      isControlled,
      props.onValueChange,
      props.type,
    ]
  );

  const enhanceItem = (node: ReactNode): ReactNode => {
    if (!isValidElement(node) || node.type !== AccordionItem) return node;

    const item = node as ReactElement<InternalItemProps>;
    const itemDisabled = disabled || Boolean(item.props.disabled);
    const expanded = expandedValues.includes(item.props.value);
    const contentId = `${instanceId}-accordion-content-${item.props.value}`;
    const itemChildren = Children.map(item.props.children, (child) => {
      if (!isValidElement(child)) return child;

      if (child.type === AccordionTrigger) {
        return cloneElement(child as ReactElement<InternalProps>, {
          contentId,
          disabled: itemDisabled,
          expanded,
          onActivate: itemDisabled
            ? undefined
            : () => selectValue(item.props.value),
        });
      }

      if (child.type === AccordionContent) {
        return cloneElement(child as ReactElement<InternalProps>, {
          contentId,
          hidden: !expanded,
        });
      }

      return child;
    });

    return cloneElement(item, {
      className: `${styles.item} ${expanded ? styles.expanded : ''}`,
      children: itemChildren,
    });
  };

  return (
    <div className={styles.root} data-disabled={disabled || undefined}>
      {Children.map(children, enhanceItem)}
    </div>
  );
}
