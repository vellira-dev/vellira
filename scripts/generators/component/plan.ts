import path from 'node:path';

import type {
  ComponentAssetRequirement,
  ComponentCapability,
  ComponentDependencies,
  ComponentDependencySet,
  ComponentIconRequirement,
  ComponentTokenContract,
} from '@vellira-ui/metadata';
import type {
  ComponentGeneratorOptions,
  ComponentLayerArg,
  ComponentPlatformArg,
  ComponentProfileArg,
  FormControlKindArg,
} from './cli';
import { resolveComponentTypeOwnership } from './type-ownership';

import type { ComponentTypeOwnership } from './type-ownership';

export type ComponentTargetPackage = 'react' | 'react-native';

export type ComponentGenerationTarget = {
  packageName: ComponentTargetPackage;
  componentDir: string;
  barrelFile: string;
  packageBarrelFile: string;
  publicApiTestFile: string;
  isNative: boolean;
};

export type ComponentTokenThemeTarget = {
  theme: 'light' | 'dark' | 'highContrast';
  componentFile: string;
  barrelFile: string;
};

export type ComponentGenerationPlan = {
  root: string;
  componentName: string;
  layer: ComponentLayerArg;
  category: ComponentGeneratorOptions['category'];
  profile: ComponentProfileArg;
  control: FormControlKindArg;
  typeOwnership: ComponentTypeOwnership;
  capabilities: readonly ComponentCapability[];
  dependencies: ComponentDependencies;
  icons: readonly ComponentIconRequirement[];
  tokens: readonly string[];
  assets: readonly ComponentAssetRequirement[];
  componentTokens: ComponentTokenContract | false;
  force: boolean;
  parts: readonly string[];
  targets: readonly ComponentGenerationTarget[];
  sharedTypesFile: string;
  sharedTypesBarrelFile: string;
  metadataFile: string;
  metadataBarrelFile: string;
  tokenFactoryFile: string;
  tokenFactoryBarrelFile: string;
  tokenThemeTargets: readonly ComponentTokenThemeTarget[];
  docsRoot: string;
  docsContractFile: string;
  docsContractRegistryFile: string;
};

export function shouldGenerateVisualScaffold(
  plan: Pick<ComponentGenerationPlan, 'profile'>
) {
  return plan.profile !== 'compound' && plan.profile !== 'overlay';
}

function resolveComponentTokenContract(
  options: ComponentGeneratorOptions
): ComponentTokenContract | false {
  if (options.componentTokens !== undefined) {
    return options.componentTokens;
  }

  if (
    options.profile === 'form-control' &&
    (options.control ?? 'value') === 'boolean'
  ) {
    return 'boolean-control';
  }

  return 'standard';
}

function normalizeDependencySet(
  value: ComponentDependencySet | undefined
): ComponentDependencySet {
  return {
    ...(value?.packages && value.packages.length > 0
      ? { packages: [...new Set(value.packages)].sort() }
      : {}),
    ...(value?.components && value.components.length > 0
      ? { components: [...new Set(value.components)].sort() }
      : {}),
  };
}

function resolvePlanDependencies(params: {
  dependencies: ComponentDependencies | undefined;
  typeOwnership: ComponentTypeOwnership;
}): ComponentDependencies {
  const packages = new Set(params.dependencies?.packages ?? []);

  if (params.typeOwnership === 'shared') {
    packages.add('@vellira-ui/types');
  }

  const platforms = Object.fromEntries(
    Object.entries(params.dependencies?.platforms ?? {})
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([platform, dependencySet]) => [
        platform,
        normalizeDependencySet(dependencySet),
      ])
      .filter(
        ([, dependencySet]) =>
          Object.keys(dependencySet as ComponentDependencySet).length > 0
      )
  ) as ComponentDependencies['platforms'];

  return {
    ...(packages.size > 0 ? { packages: [...packages].sort() } : {}),
    ...((params.dependencies?.components?.length ?? 0) > 0
      ? {
          components: [
            ...new Set(params.dependencies?.components ?? []),
          ].sort(),
        }
      : {}),
    ...(Object.keys(platforms ?? {}).length > 0 ? { platforms } : {}),
  };
}

function getTargetPackages(
  platform: ComponentPlatformArg
): ComponentTargetPackage[] {
  switch (platform) {
    case 'web':
      return ['react'];
    case 'native':
      return ['react-native'];
    case 'both':
      return ['react', 'react-native'];
  }
}

export function createComponentGenerationPlan(params: {
  root: string;
  options: ComponentGeneratorOptions;
}): ComponentGenerationPlan {
  const { root, options } = params;

  const typeOwnership = resolveComponentTypeOwnership(options);
  const dependencies = resolvePlanDependencies({
    dependencies: options.dependencies,
    typeOwnership,
  });
  const targets = getTargetPackages(options.platform).map((packageName) => ({
    packageName,
    isNative: packageName === 'react-native',
    componentDir: path.join(
      root,
      'packages',
      packageName,
      'src',
      options.layer,
      options.componentName
    ),
    barrelFile: path.join(
      root,
      'packages',
      packageName,
      'src',
      options.layer,
      'index.ts'
    ),
    packageBarrelFile: path.join(
      root,
      'packages',
      packageName,
      'src',
      'index.ts'
    ),
    publicApiTestFile: path.join(
      root,
      'packages',
      packageName,
      'src',
      'public-api.test.ts'
    ),
  }));

  const sharedTypesFileName = `${options.componentName[0].toLowerCase()}${options.componentName.slice(1)}.ts`;
  const tokenComponentFileName = `${options.componentName[0].toLowerCase()}${options.componentName.slice(1)}.ts`;

  const tokenThemeTargets: ComponentTokenThemeTarget[] = [
    'light',
    'dark',
    'highContrast',
  ].map((theme) => ({
    theme: theme as ComponentTokenThemeTarget['theme'],
    componentFile: path.join(
      root,
      'packages',
      'tokens',
      'src',
      theme,
      'components',
      tokenComponentFileName
    ),
    barrelFile: path.join(
      root,
      'packages',
      'tokens',
      'src',
      theme,
      'components',
      'index.ts'
    ),
  }));

  return {
    root,
    componentName: options.componentName,
    layer: options.layer,
    category: options.category,
    profile: options.profile,
    control: options.control ?? 'value',
    typeOwnership,
    capabilities: options.capabilities ?? [],
    dependencies,
    icons: options.icons ?? [],
    tokens: options.tokens ?? [],
    assets: options.assets ?? [],
    componentTokens: resolveComponentTokenContract(options),
    parts: options.parts,
    force: options.force,
    targets,

    sharedTypesFile: path.join(
      root,
      'packages',
      'types',
      'src',
      sharedTypesFileName
    ),

    sharedTypesBarrelFile: path.join(
      root,
      'packages',
      'types',
      'src',
      'index.ts'
    ),

    metadataFile: path.join(
      root,
      'packages',
      'metadata',
      'src',
      'components',
      `${options.componentName}.metadata.ts`
    ),

    metadataBarrelFile: path.join(
      root,
      'packages',
      'metadata',
      'src',
      'components',
      'index.ts'
    ),

    tokenFactoryFile: path.join(
      root,
      'packages',
      'tokens',
      'src',
      'factories',
      'components',
      `create${options.componentName}Tokens.ts`
    ),

    tokenFactoryBarrelFile: path.join(
      root,
      'packages',
      'tokens',
      'src',
      'factories',
      'index.ts'
    ),

    tokenThemeTargets,

    docsRoot: path.join(root, 'apps', 'docs', 'src'),

    docsContractFile: path.join(
      root,
      'apps',
      'docs',
      'src',
      'component-docs',
      `${options.componentName}.docs.ts`
    ),

    docsContractRegistryFile: path.join(
      root,
      'apps',
      'docs',
      'src',
      'component-docs',
      'index.ts'
    ),
  };
}
