import fs from 'node:fs';

import type { ComponentGenerationPlan } from './plan';
import { getComponentProfile } from './profiles';
import {
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

export function validateComponentGenerationPlan(
  plan: ComponentGenerationPlan,
  options: {
    allowExistingTargets?: boolean;
  } = {}
): ComponentPreflightResult {
  const errors: string[] = [];
  const existingTargets: string[] = [];
  const profile = getComponentProfile(plan.profile);

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
