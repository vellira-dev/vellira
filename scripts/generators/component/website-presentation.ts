import fs from 'node:fs';
import path from 'node:path';

import type { ComponentCapability } from '@vellira-ui/metadata';

import {
  deriveComponentPresentationScenarios,
  type ComponentPresentationScenario,
} from '../component-presentation';
import {
  existsInPackage,
  extractPlatformProps,
} from '../component-page/extractors/source';

import type { ComponentProfileArg } from './cli';

export type EffectiveWebsitePresentationScenario = {
  scenario: ComponentPresentationScenario;
  props: string[];
};

function readComponentApiPropNames(params: {
  root: string;
  componentName: string;
}) {
  const propNames = new Set<string>();

  for (const platform of ['react', 'react-native'] as const) {
    const packageSourceRoot = path.join(
      params.root,
      'packages',
      platform,
      'src'
    );

    if (
      !fs.existsSync(packageSourceRoot) ||
      !existsInPackage({
        root: params.root,
        packageName: platform,
        componentName: params.componentName,
      })
    ) {
      continue;
    }

    for (const prop of extractPlatformProps({
      root: params.root,
      componentName: params.componentName,
      platform,
    })) {
      propNames.add(prop.name);
    }
  }

  return propNames;
}

function getScenarioProps(params: {
  scenario: ComponentPresentationScenario;
  profile: ComponentProfileArg;
  propNames: ReadonlySet<string>;
}): string[] | null {
  const { scenario, profile, propNames } = params;
  const props: string[] = [];
  const hasType = propNames.has('type');
  const booleanControl = propNames.has('checked');

  switch (scenario) {
    case 'basic':
    case 'rich-content':
      break;
    case 'multiple':
      if (hasType) {
        props.push("type='multiple'");
      }
      if (propNames.has('defaultValue')) {
        props.push("defaultValue={['item-1', 'item-2']}");
      }
      return props.length > 0 ? props : null;
    case 'controlled':
      if (booleanControl) {
        props.push('checked');
      } else if (propNames.has('value')) {
        props.push(
          profile === 'compound' ? "value='item-1'" : "value='Example value'"
        );
      } else {
        return null;
      }
      break;
    case 'uncontrolled':
      if (booleanControl && propNames.has('defaultChecked')) {
        props.push('defaultChecked');
      } else if (propNames.has('defaultValue')) {
        props.push(
          profile === 'compound'
            ? "defaultValue='item-1'"
            : "defaultValue='Example value'"
        );
      } else {
        return null;
      }
      break;
    case 'collapsible':
      if (!propNames.has('collapsible')) {
        return null;
      }
      props.push('collapsible');
      if (propNames.has('defaultValue')) {
        props.push("defaultValue='item-1'");
      }
      break;
    case 'disabled':
    case 'required':
    case 'invalid':
    case 'loading':
      if (!propNames.has(scenario)) {
        return null;
      }
      props.push(scenario);
      break;
  }

  return props;
}

export function getEffectiveWebsitePresentationScenarios(params: {
  root: string;
  componentName: string;
  profile: ComponentProfileArg;
  capabilities: readonly ComponentCapability[];
}): EffectiveWebsitePresentationScenario[] {
  const propNames = readComponentApiPropNames(params);

  return deriveComponentPresentationScenarios({
    profile: params.profile,
    capabilities: params.capabilities,
  }).flatMap((scenario) => {
    const props = getScenarioProps({
      scenario,
      profile: params.profile,
      propNames,
    });

    return props === null ? [] : [{ scenario, props }];
  });
}
