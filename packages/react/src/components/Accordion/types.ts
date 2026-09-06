import type { BaseAccordionProps } from '@vellira-ui/types';
import type { ReactNode } from 'react';

type WithChildren<T> = T extends unknown
  ? T & {
      children?: ReactNode;
    }
  : never;

export type AccordionProps = WithChildren<BaseAccordionProps>;

export type { AccordionContentProps } from './Content';
export type { AccordionItemProps } from './Item';
export type { AccordionTriggerProps } from './Trigger';
