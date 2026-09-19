import type {
  ComponentAssetRequirement,
  ComponentCapability,
  ComponentDependencies,
  ComponentIconRequirement,
  ComponentPlatform,
  ComponentSemanticCapability,
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
  semanticCapabilities?: readonly ComponentSemanticCapability[];
  platformSemanticCapabilities?: Partial<
    Record<ComponentPlatform, readonly ComponentSemanticCapability[]>
  >;
  typeOwnership?: ComponentTypeOwnership;
  dependencies?: ComponentDependencies;
  icons?: readonly ComponentIconRequirement[];
  tokens?: readonly string[];
  assets?: readonly ComponentAssetRequirement[];
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

function renderDependencySet(
  dependencySet: {
    packages?: readonly string[];
    components?: readonly string[];
  },
  indent: string
) {
  const lines = [
    dependencySet.packages && dependencySet.packages.length > 0
      ? `${indent}packages: [${dependencySet.packages
          .map(renderSingleQuotedString)
          .join(', ')}],`
      : null,
    dependencySet.components && dependencySet.components.length > 0
      ? `${indent}components: [${dependencySet.components
          .map(renderSingleQuotedString)
          .join(', ')}],`
      : null,
  ].filter(Boolean);

  return lines.join('\n');
}

function renderSemanticCapabilityArray(
  field: string,
  values: readonly ComponentSemanticCapability[] | undefined
) {
  if (!values || values.length === 0) {
    return '';
  }

  return `  ${field}: [
${values.map((value) => `    ${renderSingleQuotedString(value)},`).join('\n')}
  ],
`;
}

function renderPlatformSemanticCapabilities(
  capabilities:
    | Partial<Record<ComponentPlatform, readonly ComponentSemanticCapability[]>>
    | undefined
) {
  const entries = Object.entries(capabilities ?? {})
    .filter(([, values]) => values && values.length > 0)
    .sort(([left], [right]) => left.localeCompare(right));

  if (entries.length === 0) {
    return '';
  }

  return `  platformSemanticCapabilities: {
${entries
  .map(
    ([platform, values]) =>
      `    ${renderSingleQuotedString(platform)}: [${(values ?? [])
        .map(renderSingleQuotedString)
        .join(', ')}],`
  )
  .join('\n')}
  },
`;
}

function renderDependencies(dependencies: ComponentDependencies | undefined) {
  if (!dependencies) {
    return '';
  }

  const root = renderDependencySet(dependencies, '    ');
  const platformEntries = Object.entries(dependencies.platforms ?? {})
    .map(([platform, dependencySet]) => {
      if (!dependencySet) return null;
      const rendered = renderDependencySet(dependencySet, '        ');
      if (!rendered) return null;
      return `      ${renderSingleQuotedString(platform)}: {\n${rendered}\n      },`;
    })
    .filter(Boolean)
    .join('\n');
  const body = [
    root || null,
    platformEntries ? `    platforms: {\n${platformEntries}\n    },` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return body ? `  dependencies: {\n${body}\n  },\n` : '';
}

export function renderMetadataTemplate({
  componentName,
  layer,
  category,
  platforms,
  profile,
  capabilities,
  semanticCapabilities = [],
  platformSemanticCapabilities = {},
  typeOwnership,
  dependencies,
  icons = [],
  tokens = [],
  assets = [],
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
  const dependencyPackages = new Set(dependencies?.packages ?? []);

  if (ownsSharedTypes) {
    dependencyPackages.add('@vellira-ui/types');
  }

  const dependenciesText = renderDependencies({
    ...(dependencyPackages.size > 0
      ? { packages: [...dependencyPackages].sort() }
      : {}),
    ...(dependencies?.components
      ? { components: dependencies.components }
      : {}),
    ...(dependencies?.platforms ? { platforms: dependencies.platforms } : {}),
  });
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
    assets.length === 0
      ? null
      : `    assets: [\n${assets
          .map(
            (asset) =>
              `      {\n        path: ${renderSingleQuotedString(asset.path)},\n        purpose: ${renderSingleQuotedString(asset.purpose)},\n      },`
          )
          .join('\n')}\n    ],`,
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
${renderSemanticCapabilityArray('semanticCapabilities', semanticCapabilities)}${renderPlatformSemanticCapabilities(platformSemanticCapabilities)}${dependenciesText}  requirements: {
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
