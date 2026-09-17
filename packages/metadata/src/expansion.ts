import type { ComponentIntentTargetV1 } from './componentIntent';

export type ComponentExpansionRole =
  'foundational' | 'form-control' | 'composition-dependency' | 'catalog';

export interface ComponentExpansionTarget extends ComponentIntentTargetV1 {
  role: ComponentExpansionRole;

  /**
   * Existing components expected to be available before this target is
   * considered implementation-ready.
   */
  dependsOn?: readonly string[];
}
