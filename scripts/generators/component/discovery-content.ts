import type {
  ComponentCapability,
  ComponentPlatform,
} from '@vellira-ui/metadata';

import {
  deriveComponentPresentationScenarios,
  getComponentPresentationScenarioDescription,
  getComponentPresentationScenarioTitle,
  type ComponentPresentationScenario,
} from '../component-presentation';
import type { ComponentCategoryArg, ComponentProfileArg } from './cli';

export type ComponentDiscoveryContentStatus =
  | 'complete'
  | 'needs-authored-intent';

export type ComponentDiscoveryPattern = {
  id: ComponentPresentationScenario;
  title: string;
  description: string;
};

export type ComponentDiscoveryContent = {
  status: ComponentDiscoveryContentStatus;
  summary: string;
  description: string;
  whenToUse: readonly string[];
  patterns: readonly ComponentDiscoveryPattern[];
  platformNotes: Partial<Record<ComponentPlatform, readonly string[]>>;
  missingEvidence: readonly string[];
};

const categoryUseCase: Record<ComponentCategoryArg, string> = {
  action: 'Use it when a user needs to trigger a clear application action.',
  form:
    'Use it when an interface needs explicit user input, selection, or form participation.',
  navigation:
    'Use it when users need to move between related views or sections.',
  overlay:
    'Use it when contextual or layered content should appear above the surrounding interface.',
  feedback:
    'Use it when the interface needs to communicate status, progress, or feedback.',
  'data-display':
    'Use it when structured application data needs a reusable visual presentation.',
  layout:
    'Use it when interface structure or spatial composition should follow a reusable layout contract.',
  utility:
    'Use it when a reusable UI behavior does not belong to a more specific component category.',
};

const profileUseCase: Partial<Record<ComponentProfileArg, string>> = {
  'form-control':
    'Prefer the canonical state and validation API instead of rebuilding form-control behavior in application code.',
  compound:
    'Use the compound parts when the interface needs explicit composition while preserving one component contract.',
  overlay:
    'Keep open state, focus, dismissal, and rendering behavior inside the documented overlay contract.',
};

const capabilityLabels: Partial<Record<ComponentCapability, string>> = {
  disabled: 'disabled state',
  required: 'required state',
  invalid: 'validation state',
  loading: 'loading state',
  keyboard: 'keyboard interaction',
  'focus-management': 'focus management',
  'compound-api': 'compound composition',
  multiple: 'multiple values',
  collapsible: 'collapsible behavior',
  portal: 'portal rendering',
  responsive: 'responsive behavior',
};

function formatFeatureCoverage(capabilities: readonly ComponentCapability[]) {
  const features: string[] = [];

  if (
    capabilities.includes('controlled') &&
    capabilities.includes('uncontrolled')
  ) {
    features.push('controlled and uncontrolled state');
  } else if (capabilities.includes('controlled')) {
    features.push('controlled state');
  } else if (capabilities.includes('uncontrolled')) {
    features.push('uncontrolled state');
  }

  for (const capability of capabilities) {
    const label = capabilityLabels[capability];

    if (label && !features.includes(label)) {
      features.push(label);
    }
  }

  if (features.length === 0) {
    return 'canonical Vellira behavior and styling';
  }

  if (features.length === 1) {
    return features[0];
  }

  if (features.length === 2) {
    return `${features[0]} and ${features[1]}`;
  }

  return `${features.slice(0, -1).join(', ')}, and ${features.at(-1)}`;
}

function platformLabel(platforms: readonly ComponentPlatform[]) {
  const hasReact = platforms.includes('react');
  const hasNative = platforms.includes('react-native');

  if (hasReact && hasNative) return 'React and React Native';
  if (hasReact) return 'React';
  if (hasNative) return 'React Native';

  return 'supported application';
}

function buildPlatformNotes(platforms: readonly ComponentPlatform[]) {
  const notes: Partial<Record<ComponentPlatform, readonly string[]>> = {};

  if (platforms.includes('react')) {
    notes.react = [
      'The React package uses web platform semantics; keep DOM, keyboard, and ARIA guidance scoped to behavior verified by the web implementation.',
    ];
  }

  if (platforms.includes('react-native')) {
    notes['react-native'] = [
      'The React Native package uses native rendering and accessibility props; browser-only DOM and keyboard behavior does not automatically apply.',
    ];
  }

  return notes;
}

export function deriveComponentDiscoveryContent(params: {
  componentName: string;
  category: ComponentCategoryArg;
  profile: ComponentProfileArg;
  capabilities: readonly ComponentCapability[];
  platforms: readonly ComponentPlatform[];
}): ComponentDiscoveryContent {
  const capabilities = [...new Set(params.capabilities)];
  const scenarios = deriveComponentPresentationScenarios({
    profile: params.profile,
    capabilities,
  });
  const patterns = scenarios.map((scenario) => ({
    id: scenario,
    title: getComponentPresentationScenarioTitle(scenario),
    description: getComponentPresentationScenarioDescription(scenario),
  }));
  const whenToUse = [
    categoryUseCase[params.category],
    ...(profileUseCase[params.profile]
      ? [profileUseCase[params.profile] as string]
      : []),
  ];
  const missingEvidence: string[] = [];

  if (patterns.every((pattern) => pattern.id === 'basic')) {
    missingEvidence.push(
      'No capability-grounded developer pattern is available beyond basic usage.'
    );
  }

  if (
    params.profile === 'compound' &&
    !capabilities.includes('compound-api')
  ) {
    missingEvidence.push(
      'Compound profile requires explicit compound-api evidence before composition guidance is considered complete.'
    );
  }

  const coverage = formatFeatureCoverage(capabilities);
  const platforms = platformLabel(params.platforms);

  return {
    status:
      missingEvidence.length === 0 ? 'complete' : 'needs-authored-intent',
    summary: `Use ${params.componentName} as the canonical Vellira ${params.category.replaceAll('-', ' ')} component across ${platforms}.`,
    description: `${params.componentName} for ${platforms} with ${coverage}.`,
    whenToUse,
    patterns,
    platformNotes: buildPlatformNotes(params.platforms),
    missingEvidence,
  };
}
