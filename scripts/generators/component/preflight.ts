import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import type { ComponentGenerationPlan } from './plan';
import { getComponentProfile } from './profiles';
import { assertComponentTokenLifecycleCanMaterialize } from './token-lifecycle-contract';
import {
  canonicalAssetExists,
  canonicalAssetPath,
  canonicalIconExports,
  canonicalIconSourcePath,
  canonicalTokenPaths,
  canonicalTokenRegistryPath,
} from '../../design-resources/authority';

export type ComponentPreflightResult =
  | {
      ok: true;
      existingTargets: string[];
    }
  | {
      ok: false;
      errors: string[];
    };

type ComponentDependencyPlatform = 'react' | 'react-native';

function validateCanonicalPackageDependency(
  root: string,
  packageName: string,
  errors: string[]
) {
  if (!packageName.startsWith('@vellira-ui/')) {
    return;
  }

  const packageDir = packageName.slice('@vellira-ui/'.length);
  const packageJsonPath = path.join(
    root,
    'packages',
    packageDir,
    'package.json'
  );

  if (!fs.existsSync(packageJsonPath)) {
    errors.push(
      `missing-canonical-package-dependency: package="${packageName}" expected="${packageJsonPath}"`
    );
    return;
  }

  try {
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8')
    ) as {
      name?: unknown;
    };

    if (packageJson.name !== packageName) {
      errors.push(
        `invalid-canonical-package-dependency: package="${packageName}" manifest="${packageJsonPath}"`
      );
    }
  } catch {
    errors.push(
      `invalid-canonical-package-dependency: package="${packageName}" manifest="${packageJsonPath}"`
    );
  }
}

function readCanonicalComponentDependencyPlatforms(params: {
  metadataFile: string;
  componentName: string;
  errors: string[];
}): Set<ComponentDependencyPlatform> | null {
  let source: string;

  try {
    source = fs.readFileSync(params.metadataFile, 'utf8');
  } catch {
    params.errors.push(
      `invalid-component-dependency-metadata: component="${params.componentName}" metadata="${params.metadataFile}"`
    );
    return null;
  }

  const sourceFile = ts.createSourceFile(
    params.metadataFile,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let metadataObject: ts.ObjectLiteralExpression | null = null;

  const visit = (node: ts.Node) => {
    if (metadataObject) {
      return;
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineComponentMetadata'
    ) {
      const [argument] = node.arguments;

      if (argument && ts.isObjectLiteralExpression(argument)) {
        metadataObject = argument;
        return;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const resolvedMetadataObject =
    metadataObject as ts.ObjectLiteralExpression | null;

  if (!resolvedMetadataObject) {
    params.errors.push(
      `invalid-component-dependency-metadata: component="${params.componentName}" metadata="${params.metadataFile}" — expected defineComponentMetadata({...})`
    );
    return null;
  }

  const platformsProperty = resolvedMetadataObject.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      ((ts.isIdentifier(property.name) && property.name.text === 'platforms') ||
        (ts.isStringLiteral(property.name) &&
          property.name.text === 'platforms'))
  );

  if (
    !platformsProperty ||
    !ts.isPropertyAssignment(platformsProperty) ||
    !ts.isArrayLiteralExpression(platformsProperty.initializer)
  ) {
    params.errors.push(
      `invalid-component-dependency-metadata: component="${params.componentName}" metadata="${params.metadataFile}" — expected a literal platforms array`
    );
    return null;
  }

  const platforms = new Set<ComponentDependencyPlatform>();

  for (const element of platformsProperty.initializer.elements) {
    if (
      !ts.isStringLiteral(element) ||
      (element.text !== 'react' && element.text !== 'react-native')
    ) {
      params.errors.push(
        `invalid-component-dependency-metadata: component="${params.componentName}" metadata="${params.metadataFile}" — platforms must contain only react or react-native string literals`
      );
      return null;
    }

    platforms.add(element.text);
  }

  if (platforms.size === 0) {
    params.errors.push(
      `invalid-component-dependency-metadata: component="${params.componentName}" metadata="${params.metadataFile}" — platforms must not be empty`
    );
    return null;
  }

  return platforms;
}

function validateDependencySet(params: {
  root: string;
  packages?: readonly string[];
  components?: readonly string[];
  componentName: string;
  requiredPlatforms?: readonly ComponentDependencyPlatform[];
  errors: string[];
}) {
  for (const packageName of params.packages ?? []) {
    validateCanonicalPackageDependency(params.root, packageName, params.errors);
  }

  for (const componentName of params.components ?? []) {
    if (componentName === params.componentName) {
      params.errors.push(
        `invalid-component-dependency: component="${params.componentName}" cannot depend on itself`
      );
      continue;
    }

    const metadataFile = path.join(
      params.root,
      'packages',
      'metadata',
      'src',
      'components',
      `${componentName}.metadata.ts`
    );

    if (!fs.existsSync(metadataFile)) {
      params.errors.push(
        `missing-component-dependency: component="${componentName}" expected="${metadataFile}"`
      );
      continue;
    }

    const availablePlatforms = readCanonicalComponentDependencyPlatforms({
      metadataFile,
      componentName,
      errors: params.errors,
    });

    if (!availablePlatforms) {
      continue;
    }

    for (const platform of params.requiredPlatforms ?? []) {
      if (!availablePlatforms.has(platform)) {
        params.errors.push(
          `unsupported-component-dependency-platform: component="${componentName}" requiredPlatform="${platform}" metadata="${metadataFile}"`
        );
      }
    }
  }
}

export function validateComponentGenerationAuthorities(
  plan: ComponentGenerationPlan
): string[] {
  const errors: string[] = [];
  const selectedPlatforms = plan.targets.map(
    (target) => target.packageName as ComponentDependencyPlatform
  );
  const selectedPlatformSet = new Set(selectedPlatforms);

  validateDependencySet({
    root: plan.root,
    packages: plan.dependencies.packages,
    components: plan.dependencies.components,
    componentName: plan.componentName,
    requiredPlatforms: selectedPlatforms,
    errors,
  });

  for (const [platform, dependencies] of Object.entries(
    plan.dependencies.platforms ?? {}
  )) {
    if (!selectedPlatformSet.has(platform as ComponentDependencyPlatform)) {
      errors.push(
        `invalid-platform-dependency: platform="${platform}" is not selected for component="${plan.componentName}"`
      );
      continue;
    }

    validateDependencySet({
      root: plan.root,
      packages: dependencies?.packages,
      components: dependencies?.components,
      componentName: plan.componentName,
      requiredPlatforms: [platform as ComponentDependencyPlatform],
      errors,
    });
  }

  for (const asset of plan.assets) {
    const assetPath = canonicalAssetPath({
      root: plan.root,
      assetPath: asset.path,
    });

    if (!assetPath) {
      errors.push(
        `invalid-design-asset-path: path="${asset.path}" purpose="${asset.purpose}" — expected a canonical brand/, fonts/, or styles/ asset path`
      );
      continue;
    }

    if (
      !canonicalAssetExists({
        root: plan.root,
        assetPath: asset.path,
      })
    ) {
      errors.push(
        `missing-design-asset: path="${asset.path}" purpose="${asset.purpose}" expected="${assetPath}"`
      );
    }
  }

  if (plan.icons.length > 0) {
    for (const target of plan.targets) {
      const platform = target.packageName;
      const registryPath = canonicalIconSourcePath({
        root: plan.root,
        platform,
      });
      const exports = canonicalIconExports({
        root: plan.root,
        platform,
      });

      if (!exports) {
        errors.push(
          `missing-icon-resource-registry: component="${plan.componentName}" platform="${platform}" registry="${registryPath}"`
        );
        continue;
      }

      for (const requirement of plan.icons) {
        if (!exports.has(requirement.name)) {
          errors.push(
            `missing-icon-resource: name="${requirement.name}" purpose="${requirement.purpose}" platform="${platform}" — expected canonical export from @vellira-ui/icons`
          );
        }
      }
    }
  }

  if (plan.tokens.length > 0) {
    const registryPath = canonicalTokenRegistryPath(plan.root);
    const tokenPaths = canonicalTokenPaths(plan.root);

    if (!tokenPaths) {
      errors.push(
        `missing-design-token-registry: component="${plan.componentName}" registry="${registryPath}"`
      );
    } else {
      for (const target of plan.targets) {
        for (const token of plan.tokens) {
          if (!tokenPaths.has(token)) {
            errors.push(
              `missing-design-token: path="${token}" component="${plan.componentName}" part="component" platform="${target.packageName}" — expected canonical token path in @vellira-ui/tokens`
            );
          }
        }
      }
    }
  }

  return errors;
}

export function validateComponentGenerationPlan(
  plan: ComponentGenerationPlan,
  options: {
    allowExistingTargets?: boolean;
  } = {}
): ComponentPreflightResult {
  const errors: string[] = [];
  const existingTargets: string[] = [];
  const profile = getComponentProfile(plan.profile);
  errors.push(...validateComponentGenerationAuthorities(plan));
  if (plan.componentTokens !== false) {
    try {
      assertComponentTokenLifecycleCanMaterialize(
        plan.componentName,
        plan.root
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  for (const target of plan.targets) {
    if (!fs.existsSync(target.barrelFile)) {
      errors.push(`Missing layer barrel file: ${target.barrelFile}`);
    }

    if (fs.existsSync(target.componentDir)) {
      existingTargets.push(target.componentDir);
    }
  }

  if (
    profile.supportsParts &&
    plan.parts.length > 0 &&
    !plan.parts.includes('Root')
  ) {
    errors.push(
      `Component profile "${plan.profile}" requires a Root part when parts are provided.`
    );
  }

  if (!profile.supportsParts && plan.parts.length > 0) {
    errors.push(
      `Component parts are not supported by the ${plan.profile} profile.`
    );
  }

  if (plan.typeOwnership === 'shared') {
    if (!fs.existsSync(plan.sharedTypesBarrelFile)) {
      errors.push(
        `Missing shared types barrel file: ${plan.sharedTypesBarrelFile}`
      );
    }

    if (fs.existsSync(plan.sharedTypesFile)) {
      existingTargets.push(plan.sharedTypesFile);
    }
  }

  if (!fs.existsSync(plan.metadataBarrelFile)) {
    errors.push(`Missing metadata barrel file: ${plan.metadataBarrelFile}`);
  } else {
    const metadataBarrel = fs.readFileSync(plan.metadataBarrelFile, 'utf8');

    if (!metadataBarrel.includes('export const componentMetadata = [')) {
      errors.push(
        `Missing componentMetadata registry in ${plan.metadataBarrelFile}`
      );
    } else if (!metadataBarrel.includes('] as const;')) {
      errors.push(
        `Invalid componentMetadata registry in ${plan.metadataBarrelFile}`
      );
    }

    const metadataName = `${plan.componentName[0].toLowerCase()}${plan.componentName.slice(1)}Metadata`;

    const metadataImport = `import { ${metadataName} } from './${plan.componentName}.metadata';`;
    const metadataRegistryEntry = `  ${metadataName},`;

    const hasMetadataImport = metadataBarrel.includes(metadataImport);
    const hasMetadataRegistryEntry = metadataBarrel.includes(
      metadataRegistryEntry
    );

    if (
      (hasMetadataImport || hasMetadataRegistryEntry) &&
      !fs.existsSync(plan.metadataFile)
    ) {
      errors.push(
        `Conflicting metadata registration for ${plan.componentName} in ${plan.metadataBarrelFile}`
      );
    }
  }

  if (!fs.existsSync(plan.docsContractRegistryFile)) {
    errors.push(
      `Missing component docs registry file: ${plan.docsContractRegistryFile}`
    );
  } else {
    const docsRegistry = fs.readFileSync(plan.docsContractRegistryFile, 'utf8');

    if (!docsRegistry.includes('export const componentDocsContracts = [')) {
      errors.push(
        `Missing componentDocsContracts registry in ${plan.docsContractRegistryFile}`
      );
    } else if (!docsRegistry.includes('] as const;')) {
      errors.push(
        `Invalid componentDocsContracts registry in ${plan.docsContractRegistryFile}`
      );
    }
  }

  if (fs.existsSync(plan.metadataFile)) {
    existingTargets.push(plan.metadataFile);
  }

  if (fs.existsSync(plan.docsContractFile)) {
    existingTargets.push(plan.docsContractFile);
  }

  if (plan.componentTokens !== false) {
    if (fs.existsSync(plan.tokenFactoryFile)) {
      existingTargets.push(plan.tokenFactoryFile);
    }

    for (const tokenTarget of plan.tokenThemeTargets) {
      if (fs.existsSync(tokenTarget.componentFile)) {
        existingTargets.push(tokenTarget.componentFile);
      }
    }
  }

  if (
    existingTargets.length > 0 &&
    !plan.force &&
    !options.allowExistingTargets
  ) {
    errors.push(
      `Component already exists:\n${existingTargets
        .map((target) => `- ${target}`)
        .join('\n')}\nUse --force to overwrite existing component files.`
    );
  }

  return errors.length > 0
    ? {
        ok: false,
        errors,
      }
    : {
        ok: true,
        existingTargets,
      };
}
