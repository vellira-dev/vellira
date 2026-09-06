import type { BaseAccordionContentProps } from '@vellira-ui/types';
import type { ReactNode } from 'react';

export type AccordionContentProps = BaseAccordionContentProps & {
  children?: ReactNode;
};
