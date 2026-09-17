import type { ComponentPlatform } from '@vellira-ui/metadata';

export type ComponentCheckName =
  | 'metadata'
  | 'intent-coverage'
  | 'type-ownership'
  | 'production-authorities'
  | 'component-tokens'
  | 'implementation'
  | 'types'
  | 'exports'
  | 'tests'
  | 'storybook'
  | 'website'
  | 'api-docs'
  | 'component-docs'
  | 'tokens'
  | 'accessibility';

export type ComponentCheckResult = {
  name: ComponentCheckName;
  platform?: ComponentPlatform;
  ok: boolean;
  details?: string;
};

export type ComponentCompletenessResult = {
  componentName: string;
  ready: boolean;
  checks: readonly ComponentCheckResult[];
};
