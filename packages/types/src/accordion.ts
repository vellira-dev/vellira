type AccordionSingleProps = {
  /** Selection mode for a single expanded item. */
  type?: 'single';
  /** Controlled expanded item value. */
  value?: string;
  /** Initial expanded item value for uncontrolled usage. */
  defaultValue?: string;
  /** Called when the expanded item changes. */
  onValueChange?: (value: string) => void;
  /** Allows the expanded item to collapse. */
  collapsible?: boolean;
  /** Disables every accordion item. */
  disabled?: boolean;
};

type AccordionMultipleProps = {
  /** Selection mode for multiple expanded items. */
  type: 'multiple';
  /** Controlled expanded item values. */
  value?: string[];
  /** Initial expanded item values for uncontrolled usage. */
  defaultValue?: string[];
  /** Called when the expanded items change. */
  onValueChange?: (value: string[]) => void;
  /** Collapsible is only meaningful in single selection mode. */
  collapsible?: never;
  /** Disables every accordion item. */
  disabled?: boolean;
};

export type BaseAccordionProps = AccordionSingleProps | AccordionMultipleProps;

export interface BaseAccordionItemProps {
  /** Stable item value used by the root selection state. */
  value: string;
  /** Disables this accordion item. */
  disabled?: boolean;
}

export interface BaseAccordionTriggerProps {
  /** Disables this accordion trigger. */
  disabled?: boolean;
}

export interface BaseAccordionContentProps {
  /** Keeps this content mounted even while its item is collapsed. */
  forceMount?: boolean;
}
