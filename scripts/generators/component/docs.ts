import fs from 'node:fs';
import path from 'node:path';

import type {
  ComponentMetadata,
  ComponentPlatform,
} from '@vellira-ui/metadata';

import type { ComponentDocsContract } from '../../../apps/docs/src/component-docs';
import { validateComponentDocs } from '../../../apps/docs/src/component-docs';
import { generateApiDocs, section } from '../../generate-api-docs';
import { generateComponentDocs } from '../component-docs/generate-component-docs';

import type { ComponentGenerationPlan } from './plan';
import { getComponentProfile } from './profiles';
import { getGeneratedPublicPartPropTypeNames } from './public-api';

export type ComponentDocsGenerationTarget = {
  platform: ComponentPlatform;
  docsFile: string;
};

export type ComponentApiDocsTarget = {
  platform: ComponentPlatform;
  apiFile: string;
};

type GeneratedApiDocSectionSpec = {
  typeName: string;
  heading: string;
  sourceFile: string;
};

const docsDirectoryByPlatform = {
  react: 'react',
  'react-native': 'react-native',
} as const satisfies Record<ComponentPlatform, string>;

const apiPackageByPlatform = {
  react: 'web',
  'react-native': 'native',
} as const satisfies Record<ComponentPlatform, 'web' | 'native'>;

const apiPackageDirByPlatform = {
  react: 'packages/react',
  'react-native': 'packages/react-native',
} as const satisfies Record<ComponentPlatform, string>;

export function getComponentDocsContractVariable(componentName: string) {
  return `${componentName[0].toLowerCase()}${componentName.slice(1)}Docs`;
}

export function getComponentDocsTargets(
  plan: ComponentGenerationPlan
): ComponentDocsGenerationTarget[] {
  return plan.targets.map((target) => ({
    platform: target.packageName,
    docsFile: path.join(
      plan.docsRoot,
      docsDirectoryByPlatform[target.packageName],
      `${slugifyComponentName(plan.componentName)}.md`
    ),
  }));
}

export function getComponentApiDocsTargets(
  plan: ComponentGenerationPlan
): ComponentApiDocsTarget[] {
  return plan.targets.map((target) => ({
    platform: target.packageName,
    apiFile: path.join(
      plan.root,
      apiPackageDirByPlatform[target.packageName],
      'API.md'
    ),
  }));
}

export function resolvePlanCapabilities(plan: ComponentGenerationPlan) {
  const profile = getComponentProfile(plan.profile);

  return [...new Set([...profile.capabilities, ...plan.capabilities])];
}

function getGeneratedDocsDescription(
  plan: ComponentGenerationPlan,
  platform: ComponentPlatform
) {
  const platformLabel = platform === 'react' ? 'React' : 'React Native';
  const capabilityLabels = resolvePlanCapabilities(plan).map((capability) =>
    capability.replaceAll('-', ' ')
  );
  const coverage =
    capabilityLabels.length > 0
      ? ` Coverage includes ${capabilityLabels.join(', ')}.`
      : '';

  return `${plan.componentName} is a Vellira ${plan.profile.replaceAll('-', ' ')} component for ${platformLabel}.${coverage}`;
}

function getGeneratedDocsSummary(
  plan: ComponentGenerationPlan,
  platform: ComponentPlatform
) {
  const platformLabel = platform === 'react' ? 'React' : 'React Native';

  return `Use ${plan.componentName} in ${platformLabel} ${plan.category.replaceAll('-', ' ')} interfaces when you need the canonical Vellira behavior and styling for this component.`;
}

export function createComponentDocsContractFromPlan(
  plan: ComponentGenerationPlan
): ComponentDocsContract {
  return {
    component: plan.componentName,
    platforms: Object.fromEntries(
      plan.targets.map((target) => {
        const platform = target.packageName;

        return [
          platform,
          {
            title:
              platform === 'react'
                ? `${plan.componentName} - React`
                : `${plan.componentName} - React Native`,
            description: getGeneratedDocsDescription(plan, platform),
            summary: getGeneratedDocsSummary(plan, platform),
            storybook: {
              story: 'Default',
              title: storybookTitle(plan),
            },
          },
        ];
      })
    ),
  };
}

export function renderComponentDocsContract(plan: ComponentGenerationPlan) {
  const contract = createComponentDocsContractFromPlan(plan);
  const platforms = plan.targets
    .map((target) => {
      const platform = target.packageName;
      const platformDocs = contract.platforms[platform];

      if (!platformDocs) {
        throw new Error(`Missing generated docs contract for ${platform}.`);
      }

      return `    ${JSON.stringify(platform)}: {
      title: ${JSON.stringify(platformDocs.title)},
      description: ${JSON.stringify(platformDocs.description)},
      summary: ${JSON.stringify(platformDocs.summary)},
      storybook: {
        story: 'Default',
        title: ${JSON.stringify(platformDocs.storybook?.title)},
      },
    },`;
    })
    .join('\n');

  return `import { defineComponentDocs } from './defineComponentDocs';

export const ${getComponentDocsContractVariable(plan.componentName)} = defineComponentDocs({
  component: ${JSON.stringify(plan.componentName)},
  platforms: {
${platforms}
  },
});
`;
}

export function registerComponentDocsContract(params: {
  registryFile: string;
  componentName: string;
  updatedFiles: string[];
}) {
  const { registryFile, componentName, updatedFiles } = params;
  const variableName = getComponentDocsContractVariable(componentName);
  const importLine = `import { ${variableName} } from './${componentName}.docs';`;

  let content = fs.readFileSync(registryFile, 'utf8');

  if (!content.includes(importLine)) {
    const importMatches = [...content.matchAll(/^import .*;$/gm)];

    if (importMatches.length > 0) {
      const lastImport = importMatches.at(-1);

      if (!lastImport || lastImport.index === undefined) {
        throw new Error('Unable to locate component docs imports.');
      }

      const insertAt = lastImport.index + lastImport[0].length;

      content =
        content.slice(0, insertAt) +
        `\n${importLine}` +
        content.slice(insertAt);
    } else {
      content = `${importLine}\n\n${content}`;
    }
  }

  const registryMarker = 'export const componentDocsContracts = [';
  const registryStart = content.indexOf(registryMarker);

  if (registryStart === -1) {
    throw new Error(
      `Missing componentDocsContracts registry in ${registryFile}`
    );
  }

  const registryEnd = content.indexOf('] as const;', registryStart);

  if (registryEnd === -1) {
    throw new Error(
      `Invalid componentDocsContracts registry in ${registryFile}`
    );
  }

  const registryBodyStart = registryStart + registryMarker.length;
  const registryBody = content.slice(registryBodyStart, registryEnd);
  const registryEntries = registryBody
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!registryEntries.includes(variableName)) {
    registryEntries.push(variableName);

    const normalizedRegistry = `${registryMarker}\n${registryEntries
      .map((entry) => `  ${entry},`)
      .join('\n')}\n`;

    content =
      content.slice(0, registryStart) +
      normalizedRegistry +
      content.slice(registryEnd);
  }

  fs.writeFileSync(registryFile, content);

  if (!updatedFiles.includes(registryFile)) {
    updatedFiles.push(registryFile);
  }
}

export async function generateComponentDocumentation(params: {
  root: string;
  plan: ComponentGenerationPlan;
  metadata: ComponentMetadata;
  createdFiles: string[];
  updatedFiles: string[];
}) {
  const { root, plan, metadata, createdFiles, updatedFiles } = params;
  const contract = createComponentDocsContractFromPlan(plan);
  const validation = validateComponentDocs(contract, metadata);

  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
  }

  ensureApiDocPlaceholders(plan);

  const apiResult = await generateApiDocs({
    rootDir: root,
    silent: true,
    sections: plan.targets.flatMap((target) =>
      getGeneratedApiDocSectionSpecs(plan).map((apiSection) =>
        section(
          apiPackageByPlatform[target.packageName],
          apiSection.heading,
          apiSection.typeName,
          apiSection.sourceFile
        )
      )
    ),
  });

  updatedFiles.push(
    ...apiResult.changedFiles
      .map((filePath) => path.join(root, filePath))
      .filter((filePath) => !updatedFiles.includes(filePath))
  );

  const docsResult = await generateComponentDocs({
    root,
    force: plan.force,
    componentName: plan.componentName,
    metadata: [metadata],
    contracts: [validation.value],
  });

  createdFiles.push(
    ...docsResult.changedFiles
      .map((filePath) => path.join(root, filePath))
      .filter((filePath) => !createdFiles.includes(filePath))
  );
}

function getGeneratedApiDocSectionSpecs(
  plan: ComponentGenerationPlan
): GeneratedApiDocSectionSpec[] {
  const rootSection: GeneratedApiDocSectionSpec = {
    typeName: `${plan.componentName}Props`,
    heading:
      getGeneratedPublicPartPropTypeNames(plan).length > 0
        ? `### ${plan.componentName} Props`
        : `## ${plan.componentName}`,
    sourceFile: `src/${plan.layer}/${plan.componentName}/types.ts`,
  };
  const partSections = getGeneratedPublicPartPropTypeNames(plan).map(
    (typeName) => {
      const partName = typeName.slice(
        plan.componentName.length,
        -'Props'.length
      );

      return {
        typeName,
        heading: `### ${plan.componentName}.${partName} Props`,
        sourceFile: `src/${plan.layer}/${plan.componentName}/${partName}/types.ts`,
      };
    }
  );

  return [rootSection, ...partSections];
}

export function getGeneratedApiDocSections(plan: ComponentGenerationPlan) {
  return plan.targets.flatMap((target) =>
    getGeneratedApiDocSectionSpecs(plan).map((apiSection) =>
      section(
        apiPackageByPlatform[target.packageName],
        apiSection.heading,
        apiSection.typeName,
        apiSection.sourceFile
      )
    )
  );
}

export function createComponentMetadataFromPlan(
  plan: ComponentGenerationPlan
): ComponentMetadata {
  const resourceRequirements = {
    ...(plan.tokens.length > 0 ? { tokens: plan.tokens } : {}),
    ...(plan.icons.length > 0 ? { icons: plan.icons } : {}),
    ...(plan.assets.length > 0 ? { assets: plan.assets } : {}),
  };

  return {
    name: plan.componentName,
    layer: plan.layer,
    category: plan.category,
    platforms: plan.targets.map((target) => target.packageName),
    profile: plan.profile,
    status: 'experimental',
    capabilities: resolvePlanCapabilities(plan),
    ...(Object.keys(plan.dependencies).length > 0
      ? { dependencies: plan.dependencies }
      : {}),
    requirements: {
      tests: true,
      storybook: true,
      docs: true,
      accessibility: true,
      componentTokens: plan.componentTokens,
      ...resourceRequirements,
    },
  };
}

function ensureApiDocPlaceholders(plan: ComponentGenerationPlan) {
  for (const target of plan.targets) {
    const platform = target.packageName;
    const apiDocPath = getComponentApiDocsTargets(plan).find(
      (apiTarget) => apiTarget.platform === platform
    )?.apiFile;

    if (!apiDocPath || !fs.existsSync(apiDocPath)) {
      throw new Error(`Missing API documentation file: ${apiDocPath}`);
    }

    const content = fs.readFileSync(apiDocPath, 'utf8');
    const sections = getGeneratedApiDocSections({
      ...plan,
      targets: [target],
    });
    const missingSections = sections.filter(
      (apiSection) =>
        !content.includes(`<!-- api-docgen:start ${apiSection.id} -->`)
    );

    if (missingSections.length === 0) {
      continue;
    }

    const hasComponentHeading = content
      .split(/\r?\n/)
      .some((line) => line.trim() === `## ${plan.componentName}`);
    const hasHeading = (heading: string) =>
      content.split(/\r?\n/).some((line) => line.trim() === heading);

    const placeholderContent = [
      hasComponentHeading ? '' : `## ${plan.componentName}`,
      ...missingSections.map((apiSection) =>
        [
          hasHeading(apiSection.heading) ? '' : apiSection.heading,
          `<!-- api-docgen:start ${apiSection.id} -->`,
          `<!-- api-docgen:end ${apiSection.id} -->`,
        ]
          .filter(Boolean)
          .join('\n')
      ),
    ]
      .filter(Boolean)
      .join('\n\n');

    fs.writeFileSync(
      apiDocPath,
      `${content.trimEnd()}\n\n${placeholderContent}\n`
    );
  }
}

function storybookTitle(plan: ComponentGenerationPlan) {
  return `${plan.layer[0].toUpperCase()}${plan.layer.slice(1)}/${
    plan.componentName
  }`;
}

function slugifyComponentName(componentName: string) {
  return componentName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
