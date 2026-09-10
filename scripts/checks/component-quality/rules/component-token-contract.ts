import fs from 'node:fs';
import path from 'node:path';

import { createComponentGenerationPlan } from '../../../generators/component/plan';
import { renderComponentTokenFactoryBarrelExport } from '../../../generators/component/templates';
import { qualityRoot } from '../root';
import type {
  ComponentQualityRule,
  ComponentQualityRuleContext,
} from '../types';
import { createRuleFinding } from './finding';

function lowerCamel(value: string) {
  return `${value[0].toLowerCase()}${value.slice(1)}`;
}

function kebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d+)/g, '$1-$2')
    .toLowerCase();
}

function collectStyleFiles(
  directory: string,
  platform: 'react' | 'react-native'
): string[] {
  if (!fs.existsSync(directory)) return [] as string[];

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const filePath = path.join(directory, entry.name);

      if (entry.isDirectory()) return collectStyleFiles(filePath, platform);

      if (platform === 'react') {
        return /\.(?:css|scss)$/.test(entry.name) ? [filePath] : [];
      }

      return /\.styles\.ts$/.test(entry.name) ? [filePath] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function createTokenContractPlan(context: ComponentQualityRuleContext) {
  return createComponentGenerationPlan({
    root: qualityRoot(context),
    options: {
      componentName: context.metadata.name,
      platform: context.platform === 'react' ? 'web' : 'native',
      layer: context.metadata.layer,
      category: context.metadata.category,
      profile: context.metadata.profile,
      capabilities: context.metadata.capabilities ?? [],
      dependencies: context.metadata.dependencies,
      icons: context.metadata.requirements.icons ?? [],
      tokens: context.metadata.requirements.tokens ?? [],
      assets: context.metadata.requirements.assets ?? [],
      componentTokens: context.metadata.requirements.componentTokens,
      parts: [],
      force: false,
      dryRun: false,
      check: false,
    },
  });
}

function contractViolations(context: ComponentQualityRuleContext) {
  const root = qualityRoot(context);
  const componentName = context.metadata.name;
  const tokenName = lowerCamel(componentName);
  const violations: string[] = [];
  const plan = createTokenContractPlan(context);
  const factoryFile = plan.tokenFactoryFile;
  const factoryBarrel = plan.tokenFactoryBarrelFile;
  const expectedFactoryExport =
    renderComponentTokenFactoryBarrelExport(componentName);

  if (!fs.existsSync(factoryFile)) {
    violations.push(
      `missing component token factory: ${path.relative(root, factoryFile)}`
    );
  }

  const factoryBarrelSource = fs.existsSync(factoryBarrel)
    ? fs.readFileSync(factoryBarrel, 'utf8')
    : '';

  if (!factoryBarrelSource.includes(expectedFactoryExport)) {
    violations.push(
      `missing component token factory export: ${path.relative(root, factoryBarrel)}`
    );
  }

  for (const theme of ['light', 'dark', 'highContrast'] as const) {
    const tokenFile = path.join(
      root,
      'packages',
      'tokens',
      'src',
      theme,
      'components',
      `${tokenName}.ts`
    );
    const barrelFile = path.join(
      root,
      'packages',
      'tokens',
      'src',
      theme,
      'components',
      'index.ts'
    );
    const expectedExport = `export { ${tokenName}Tokens as ${tokenName} } from './${tokenName}.js';`;

    if (!fs.existsSync(tokenFile)) {
      violations.push(
        `missing ${theme} component tokens: ${path.relative(root, tokenFile)}`
      );
    }

    const barrelSource = fs.existsSync(barrelFile)
      ? fs.readFileSync(barrelFile, 'utf8')
      : '';

    if (!barrelSource.includes(expectedExport)) {
      violations.push(
        `missing ${theme} component token export: ${path.relative(root, barrelFile)}`
      );
    }
  }

  const componentDir = path.join(
    root,
    'packages',
    context.platform === 'react' ? 'react' : 'react-native',
    'src',
    context.metadata.layer,
    componentName
  );
  const styleFiles = collectStyleFiles(componentDir, context.platform);
  const styleSource = styleFiles
    .map((filePath) => fs.readFileSync(filePath, 'utf8'))
    .join('\n');
  const canonicalStyleFile = path.join(
    componentDir,
    context.platform === 'react'
      ? `${componentName}.module.scss`
      : `${componentName}.styles.ts`
  );
  const canonicalStyleEvidence = fs.existsSync(canonicalStyleFile)
    ? path.relative(root, canonicalStyleFile).replaceAll('\\', '/')
    : undefined;

  if (styleFiles.length === 0) {
    violations.push(
      `missing component style surface: ${path.relative(root, componentDir)}`
    );
  } else if (context.platform === 'react') {
    const expectedPrefix = `var(--${kebabCase(componentName)}-`;

    if (!styleSource.includes(expectedPrefix)) {
      violations.push(
        canonicalStyleEvidence
          ? `${canonicalStyleEvidence} — missing Web component-token usage: expected CSS variables with prefix --${kebabCase(componentName)}-`
          : `missing Web component-token usage: expected CSS variables with prefix --${kebabCase(componentName)}-`
      );
    }
  } else {
    const expectedUsage = `theme.components.${tokenName}`;

    if (!styleSource.includes(expectedUsage)) {
      violations.push(
        canonicalStyleEvidence
          ? `${canonicalStyleEvidence} — missing React Native component-token usage: expected ${expectedUsage}`
          : `missing React Native component-token usage: expected ${expectedUsage}`
      );
    }
  }

  return violations;
}

export const componentTokenContractRule: ComponentQualityRule = {
  definition: {
    id: 'conformity.component-token-contract',
    dimension: 'design-system',
    severity: 'required',
    evaluation: 'automated',
    description:
      'Requires declared component-owned token factories, light/dark/high-contrast registrations, and platform-specific runtime consumption.',
  },
  completionGuidance(context) {
    const tokenName = lowerCamel(context.metadata.name);

    return {
      summary:
        'Complete the component-owned token contract before production review; generic semantic token usage alone is not sufficient.',
      evidence:
        context.platform === 'react'
          ? [
              `create${context.metadata.name}Tokens factory`,
              'light/dark/highContrast component token definitions and barrel exports',
              `Web styles consume --${kebabCase(context.metadata.name)}-* component variables`,
            ]
          : [
              `create${context.metadata.name}Tokens factory`,
              'light/dark/highContrast component token definitions and barrel exports',
              `React Native styles consume theme.components.${tokenName}`,
            ],
    };
  },
  evaluate(context) {
    if (!context.metadata.requirements.componentTokens) {
      return createRuleFinding(
        componentTokenContractRule,
        context,
        'not-applicable'
      );
    }

    const violations = contractViolations(context);

    return violations.length === 0
      ? createRuleFinding(componentTokenContractRule, context, 'pass')
      : createRuleFinding(
          componentTokenContractRule,
          context,
          'fail',
          'Component token contract is incomplete. Generic semantic token usage does not satisfy component-owned theming requirements.',
          violations.slice(0, 12)
        );
  },
};

export const componentTokenContractQualityRules = [
  componentTokenContractRule,
] as const satisfies readonly ComponentQualityRule[];
