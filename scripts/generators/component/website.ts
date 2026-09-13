import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  deriveComponentPresentationScenarios,
  getComponentPresentationScenarioDescription,
  getComponentPresentationScenarioTitle,
  readCanonicalComponentCapabilities,
  type ComponentPresentationScenario,
} from '../component-presentation';
import { getCatalogPaths } from '../component-page/helpers/paths';

import type { ComponentCategoryArg, ComponentProfileArg } from './cli';

export type WebsiteComponentProfile =
  'primitive' | 'form-control' | 'compound' | 'overlay';

export type ComponentWebsiteGenerationResult = {
  createdFiles: string[];
  updatedFiles: string[];
};

type ManagedWebsiteSnapshot = Map<string, Buffer>;

export function resolveWebsiteComponentProfile(
  profile: ComponentProfileArg
): WebsiteComponentProfile {
  return profile === 'base' ? 'primitive' : profile;
}

function readComponentTypeSources(params: {
  root: string;
  componentName: string;
}) {
  const sharedFile = `${params.componentName[0].toLowerCase()}${params.componentName.slice(1)}.ts`;
  const candidates = [
    path.join(params.root, 'packages/types/src', sharedFile),
    ...['react', 'react-native'].flatMap((packageName) =>
      ['primitives', 'components', 'patterns'].map((layer) =>
        path.join(
          params.root,
          'packages',
          packageName,
          'src',
          layer,
          params.componentName,
          'types.ts'
        )
      )
    ),
  ];

  return candidates
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => fs.readFileSync(filePath, 'utf8'))
    .join('\n');
}

function sourceHasProp(source: string, propName: string) {
  return new RegExp(`\\b${propName}\\??\\s*:`).test(source);
}

function getScenarioProps(params: {
  scenario: ComponentPresentationScenario;
  profile: ComponentProfileArg;
  source: string;
}) {
  const { scenario, profile, source } = params;
  const props: string[] = [];
  const hasType = sourceHasProp(source, 'type');
  const booleanControl = sourceHasProp(source, 'checked');

  if (
    profile === 'compound' &&
    hasType &&
    scenario !== 'multiple'
  ) {
    props.push("type='single'");
  }

  switch (scenario) {
    case 'basic':
    case 'rich-content':
      break;
    case 'multiple':
      if (hasType) {
        props.push("type='multiple'");
      }
      if (sourceHasProp(source, 'defaultValue')) {
        props.push("defaultValue={['item-1', 'item-2']}");
      }
      break;
    case 'controlled':
      if (booleanControl) {
        props.push('checked');
      } else if (sourceHasProp(source, 'value')) {
        props.push(
          profile === 'compound' ? "value='item-1'" : "value='Example value'"
        );
      }
      break;
    case 'uncontrolled':
      if (booleanControl && sourceHasProp(source, 'defaultChecked')) {
        props.push('defaultChecked');
      } else if (sourceHasProp(source, 'defaultValue')) {
        props.push(
          profile === 'compound'
            ? "defaultValue='item-1'"
            : "defaultValue='Example value'"
        );
      }
      break;
    case 'collapsible':
      if (sourceHasProp(source, 'collapsible')) {
        props.push('collapsible');
      }
      if (sourceHasProp(source, 'defaultValue')) {
        props.push("defaultValue='item-1'");
      }
      break;
    case 'disabled':
    case 'required':
    case 'invalid':
    case 'loading':
      if (sourceHasProp(source, scenario)) {
        props.push(scenario);
      }
      break;
  }

  return props;
}

function toTsString(value: string) {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function renderGeneratedPresentationMetadata(params: {
  root: string;
  componentName: string;
  profile: ComponentProfileArg;
  capabilities: readonly import('@vellira-ui/metadata').ComponentCapability[];
}) {
  const source = readComponentTypeSources(params);
  const scenarios = deriveComponentPresentationScenarios({
    profile: params.profile,
    capabilities: params.capabilities,
  });
  const examples = scenarios
    .map((scenario) => {
      const props = getScenarioProps({
        scenario,
        profile: params.profile,
        source,
      });

      return `    {
      title: ${toTsString(getComponentPresentationScenarioTitle(scenario))},
      description: ${toTsString(
        getComponentPresentationScenarioDescription(scenario)
      )},
      props: [${props.map(toTsString).join(', ')}],
    },`;
    })
    .join('\n');

  return `import { defineComponentPageMetadata } from '../../metadata';

export default defineComponentPageMetadata({
  profile: '${resolveWebsiteComponentProfile(params.profile)}',
  examples: [
${examples}
  ],
});
`;
}

function ensureGeneratedPresentationMetadata(params: {
  root: string;
  componentName: string;
  profile: ComponentProfileArg;
}) {
  const componentDir = path.join(
    params.root,
    'apps/website/src/component-catalog/components',
    params.componentName
  );
  const metadataFile = path.join(componentDir, 'metadata.ts');

  if (fs.existsSync(metadataFile)) {
    return null;
  }

  const capabilities = readCanonicalComponentCapabilities(params);

  if (capabilities === null) {
    return null;
  }

  fs.mkdirSync(componentDir, { recursive: true });
  fs.writeFileSync(
    metadataFile,
    renderGeneratedPresentationMetadata({
      ...params,
      capabilities,
    })
  );

  return metadataFile;
}

export function generateComponentWebsitePage(params: {
  root: string;
  componentName: string;
  profile: ComponentProfileArg;
  category: ComponentCategoryArg;
}): ComponentWebsiteGenerationResult {
  const root = path.resolve(params.root);

  const before = snapshotManagedWebsiteArtifacts({
    root,
    componentName: params.componentName,
  });
  const generatedMetadataFile = ensureGeneratedPresentationMetadata({
    root,
    componentName: params.componentName,
    profile: params.profile,
  });

  const result = spawnSync(
    'pnpm',
    [
      'create:component-page',
      params.componentName,
      '--force',
      `--profile=${resolveWebsiteComponentProfile(params.profile)}`,
      `--category=${params.category}`,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    }
  );

  if (result.error) {
    if (generatedMetadataFile) {
      fs.rmSync(generatedMetadataFile, { force: true });
    }

    throw new Error(
      `Website component page generation failed for ${params.componentName}: ${result.error.message}`
    );
  }

  if (result.status !== 0) {
    if (generatedMetadataFile) {
      fs.rmSync(generatedMetadataFile, { force: true });
    }

    const output = [result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n')
      .trim();

    throw new Error(
      [
        `Website component page generation failed for ${params.componentName}.`,
        output,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  const after = snapshotManagedWebsiteArtifacts({
    root,
    componentName: params.componentName,
  });

  const removedFiles = [...before.keys()]
    .filter((filePath) => !after.has(filePath))
    .sort();

  if (removedFiles.length > 0) {
    const relativeFiles = removedFiles.map((filePath) =>
      path.relative(root, filePath).split(path.sep).join('/')
    );

    throw new Error(
      [
        `Website component page generation removed managed artifacts unexpectedly for ${params.componentName}:`,
        ...relativeFiles.map((filePath) => `  - ${filePath}`),
      ].join('\n')
    );
  }

  const createdFiles = [...after.keys()]
    .filter((filePath) => !before.has(filePath))
    .sort();

  const updatedFiles = [...after.keys()]
    .filter((filePath) => {
      const previous = before.get(filePath);
      const current = after.get(filePath);

      return (
        previous !== undefined &&
        current !== undefined &&
        !previous.equals(current)
      );
    })
    .sort();

  return {
    createdFiles,
    updatedFiles,
  };
}

function snapshotManagedWebsiteArtifacts(params: {
  root: string;
  componentName: string;
}): ManagedWebsiteSnapshot {
  const { componentCatalogDir, catalogRegistryFile, componentsRegistryFile } =
    getCatalogPaths(params);

  const candidateFiles = [
    ...listFilesRecursively(componentCatalogDir),
    catalogRegistryFile,
    componentsRegistryFile,
  ];

  const snapshot: ManagedWebsiteSnapshot = new Map();

  for (const filePath of [...new Set(candidateFiles)].sort()) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const stat = fs.statSync(filePath);

    if (!stat.isFile()) {
      continue;
    }

    snapshot.set(filePath, fs.readFileSync(filePath));
  }

  return snapshot;
}

function listFilesRecursively(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs
    .readdirSync(directory, {
      withFileTypes: true,
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}
