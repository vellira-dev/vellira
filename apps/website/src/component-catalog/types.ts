import type {
  ComponentLifecycle,
  ComponentPlatform,
} from '@vellira-ui/metadata';

export type { ComponentPlatform } from '@vellira-ui/metadata';

export type ComponentCategory =
  | 'general'
  | 'layout'
  | 'forms'
  | 'navigation'
  | 'overlays'
  | 'feedback'
  | 'data-display';

export const componentCategoryOrder = [
  'general',
  'layout',
  'forms',
  'navigation',
  'overlays',
  'feedback',
  'data-display',
] as const satisfies readonly ComponentCategory[];

export const componentCategoryLabels: Record<ComponentCategory, string> = {
  general: 'General',
  layout: 'Layout',
  forms: 'Forms',
  navigation: 'Navigation',
  overlays: 'Overlays',
  feedback: 'Feedback',
  'data-display': 'Data display',
};

export type ComponentStatus = ComponentLifecycle;

export type ComponentCatalogEntry = {
  slug: string;
  name: string;
  description: string;
  status: ComponentStatus;
  order: number;
  category: ComponentCategory;
  platforms: readonly ComponentPlatform[];
  docs: Partial<Record<ComponentPlatform, string>>;
};

export type ComponentCatalogPresentationEntry = Omit<
  ComponentCatalogEntry,
  'status' | 'platforms'
> & {
  component: string;
};
