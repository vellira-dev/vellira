import fs from 'node:fs';
import path from 'node:path';

import type {
  ComponentCapability,
  ComponentPlatform,
} from '@vellira-ui/metadata';

export type ComponentPresentationScenario =
  | 'basic'
  | 'multiple'
  | 'controlled'
  | 'uncontrolled'
  | 'collapsible'
  | 'disabled'
  | 'required'
  | 'invalid'
  | 'loading'
  | 'rich-content';

export const componentPresentationScenarioOrder = [
  'basic',
  'multiple',
  'controlled',
  'uncontrolled',
  'collapsible',
  'disabled',
  'required',
  'invalid',
  'loading',
  'rich-content',
] as const satisfies readonly ComponentPresentationScenario[];

const scenarioByCapability: Partial<
  Record<ComponentCapability, ComponentPresentationScenario>
> = {
  multiple: 'multiple',
  controlled: 'controlled',
  uncontrolled: 'uncontrolled',
  collapsible: 'collapsible',
  disabled: 'disabled',
  required: 'required',
  invalid: 'invalid',
  loading: 'loading',
};

const scenarioTitle: Record<ComponentPresentationScenario, string> = {
  basic: 'Basic',
  multiple: 'Multiple',
  controlled: 'Controlled',
  uncontrolled: 'Uncontrolled',
  collapsible: 'Collapsible',
  disabled: 'Disabled',
  required: 'Required',
  invalid: 'Invalid',
  loading: 'Loading',
  'rich-content': 'Rich content',
};

const scenarioDescription: Record<ComponentPresentationScenario, string> = {
  basic: 'Basic component usage.',
  multiple: 'Multiple values or sections active at the same time.',
  controlled: 'State controlled by the parent application.',
  uncontrolled: 'State initialized and then managed by the component.',
  collapsible: 'An active item can collapse back to an empty state.',
  disabled: 'Disabled state with interaction unavailable.',
  required: 'Required state for form participation.',
  invalid: 'Invalid state with validation semantics.',
  loading: 'Loading state while work is in progress.',
  'rich-content': 'Production-style content with a richer composition.',
};

export function deriveComponentPresentationScenarios(params: {
  profile: string;
  capabilities: readonly ComponentCapability[];
}): ComponentPresentationScenario[] {
  const required = new Set<ComponentPresentationScenario>(['basic']);

  for (const capability of params.capabilities) {
    const scenario = scenarioByCapability[capability];

    if (scenario) {
      required.add(scenario);
    }
  }

  if (
    params.profile === 'compound' &&
    params.capabilities.includes('compound-api')
  ) {
    required.add('rich-content');
  }

  return componentPresentationScenarioOrder.filter((scenario) =>
    required.has(scenario)
  );
}

export function getComponentPresentationScenarioTitle(
  scenario: ComponentPresentationScenario
) {
  return scenarioTitle[scenario];
}

export function getComponentPresentationScenarioDescription(
  scenario: ComponentPresentationScenario
) {
  return scenarioDescription[scenario];
}

function readCanonicalComponentMetadataSource(params: {
  root: string;
  componentName: string;
}) {
  const metadataFile = path.join(
    params.root,
    'packages',
    'metadata',
    'src',
    'components',
    `${params.componentName}.metadata.ts`
  );

  if (!fs.existsSync(metadataFile)) {
    return null;
  }

  return fs.readFileSync(metadataFile, 'utf8');
}

export function readCanonicalComponentCapabilities(params: {
  root: string;
  componentName: string;
}): readonly ComponentCapability[] | null {
  const source = readCanonicalComponentMetadataSource(params);

  if (source === null) {
    return null;
  }

  const capabilityBlock = source.match(/\bcapabilities:\s*\[([\s\S]*?)\]/)?.[1];

  if (!capabilityBlock) {
    return [];
  }

  return [
    ...new Set(
      [...capabilityBlock.matchAll(/['"]([^'"]+)['"]/g)].map(
        (match) => match[1] as ComponentCapability
      )
    ),
  ];
}

export function readCanonicalComponentPlatforms(params: {
  root: string;
  componentName: string;
}): readonly ComponentPlatform[] | null {
  const source = readCanonicalComponentMetadataSource(params);

  if (source === null) {
    return null;
  }

  const platformBlock = source.match(/\bplatforms:\s*\[([\s\S]*?)\]/)?.[1];

  if (!platformBlock) {
    return [];
  }

  const supported = new Set<ComponentPlatform>(['react', 'react-native']);

  return [
    ...new Set(
      [...platformBlock.matchAll(/['"]([^'"]+)['"]/g)]
        .map((match) => match[1])
        .filter((platform): platform is ComponentPlatform =>
          supported.has(platform as ComponentPlatform)
        )
    ),
  ];
}
