import type {
  ComponentCapability,
  ComponentIconRequirement,
  ComponentTokenContract,
} from '@vellira-ui/metadata';

import {
  hasSharedTypeSemantics,
  type ComponentTypeOwnership,
} from '../type-ownership';

import type { ComponentTemplateParams } from './component-types';

export type MetadataTemplateParams = ComponentTemplateParams & {
  layer: 'primitives' | 'components' | 'patterns';
  category:
    | 'action'
    | 'form'
    | 'navigation'
    | 'overlay'
    | 'feedback'
    | 'data-display'
    | 'layout'
    | 'utility';
  platforms: readonly ('react' | 'react-native')[];
  profile: 'base' | 'form-control' | 'compound' | 'overlay';
  capabilities: readonly ComponentCapability[];
  typeOwnership?: ComponentTypeOwnership;
  icons?: readonly ComponentIconRequirement[];
  tokens?: readonly string[];
  componentTokens?: ComponentTokenContract | false;
};

function renderSingleQuotedString(value: string) {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')}'`;
}

export function renderMetadataTemplate({
  componentName,
  layer,
  category,
  platforms,
  profile,
  capabilities,
  typeOwnership,
  icons = [],
  tokens = [],
  componentTokens = 'standard',
}: MetadataTemplateParams) {
  const metadataName = `${componentName[0].toLowerCase()}${componentName.slice(1)}Metadata`;
  const capabilitiesText =
    capabilities.length === 0
      ? '[]'
      : `[
${capabilities.map((capability) => `    '${capability}',`).join('\n')}
  ]`;
  const ownsSharedTypes =
    typeOwnership === 'shared' ||
    (typeOwnership === undefined && hasSharedTypeSemantics(capabilities));
  const dependenciesText = ownsSharedTypes
    ? `  dependencies: {
    packages: ['@vellira-ui/types'],
  },\n`
    : '';
  const resourceRequirementsText = [
    icons.length === 0
      ? null
      : `    icons: [
${icons
  .map(
    (icon) => `      {
        name: ${renderSingleQuotedString(icon.name)},
        purpose: ${renderSingleQuotedString(icon.purpose)},
      },`
  )
  .join('\n')}
    ],`,
    tokens.length === 0
      ? null
      : `    tokens: [${tokens.map(renderSingleQuotedString).join(', ')}],`,
  ]
    .filter(Boolean)
    .join('\n');

  const requirementsSuffix =
    resourceRequirementsText.length > 0 ? `\n${resourceRequirementsText}` : '';

  return `import { defineComponentMetadata } from '../defineComponentMetadata';

export const ${metadataName} = defineComponentMetadata({
  name: '${componentName}',
  layer: '${layer}',
  category: '${category}',
  platforms: [${platforms.map((platform) => `'${platform}'`).join(', ')}],
  profile: '${profile}',
  status: 'experimental',
  capabilities: ${capabilitiesText},
${dependenciesText}  requirements: {
    tests: true,
    storybook: true,
    docs: true,
    accessibility: true,
    componentTokens: ${
      componentTokens === false ? 'false' : `'${componentTokens}'`
    },${requirementsSuffix}
  },
});
`;
}
