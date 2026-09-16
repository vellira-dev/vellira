import type {
  ComponentCategory,
  ComponentLayer,
  ComponentPlatform,
  ComponentProfile,
  ComponentTokenContract,
} from './component';
import type { ComponentIntentDefinitionV1 } from './intent';

export type ComponentExpansionRole =
  'foundational' | 'form-control' | 'composition-dependency' | 'catalog';

export interface ComponentExpansionTarget {
  name: string;
  layer: ComponentLayer;
  category: ComponentCategory;
  platforms: readonly ComponentPlatform[];
  profile: ComponentProfile;
  /** Explicit production intent; expansion targets never infer a default. */
  componentTokens: ComponentTokenContract | false;
  role: ComponentExpansionRole;
  /** Approved semantic intent. Structural generation must not treat it as implementation evidence. */
  intent: ComponentIntentDefinitionV1;

  /**
   * Existing public component APIs that intentionally satisfy this target.
   *
   * Gap analysis must not propose this target when one of these APIs is
   * represented by the current catalog.
   */
  representedBy?: readonly string[];

  /**
   * Existing components expected to be available before this target is
   * considered implementation-ready.
   */
  dependsOn?: readonly string[];
}
