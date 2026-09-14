export { ComponentsPageHero } from './shared/ComponentsPageHero';
export { ComponentSidebar } from './shared/ComponentSidebar';
export { ComponentExplorer } from './shared/ComponentExplorer';
export { ComponentHeader } from './shared/ComponentHeader';
export { ComponentsHeader } from './shared/ComponentsHeader';
export { ComponentPlayground } from './shared/ComponentPlayground';
export { ComponentPlatformView } from './shared/ComponentPlatformView';
export { ComponentCodeBlock } from './shared/ComponentCodeBlock';
export { ComponentApi, type ComponentApiProp } from './shared/ComponentApi';
export { RelatedComponents } from './shared/RelatedComponents';
export { ComponentsCatalog } from './shared/ComponentsCatalog';
export { ComponentNavigationShell } from './shared/ComponentNavigationShell';
export {
  ComponentExamples,
  type ComponentExampleItem,
} from './shared/ComponentExamples';
export {
  ComponentDemoStateProvider,
  useComponentDemoState,
} from './shared/ComponentDemoStateProvider';
export {
  ComponentNavigationProvider,
  useComponentNavigation,
} from './shared/ComponentNavigationProvider';
export {
  ComponentAccessibility,
  type AccessibilityItem,
} from './shared/ComponentAccessibility';

export { componentGroups } from './registry/componentGroups';
export { webComponents } from './registry/components';
export { getComponentBySlug } from './registry/getComponentBySlug';

export { ComponentNavigationTrigger } from './shared/ComponentNavigationTrigger';

export type {
  ComponentCatalogEntry,
  ComponentCatalogPresentationEntry,
  ComponentCategory,
  ComponentPlatform,
  ComponentStatus,
} from './types';
