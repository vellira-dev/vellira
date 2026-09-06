import type { BaseAccordionItemProps } from '@vellira-ui/types';
import type { ReactNode } from 'react';

export type AccordionItemProps = BaseAccordionItemProps & {
  children?: ReactNode;
};
