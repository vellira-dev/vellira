import fs from 'node:fs';
import path from 'node:path';

import type {
  ComponentCapability,
  ComponentMetadata,
  ComponentPlatform,
} from '@vellira-ui/metadata';

import { qualityRoot } from '../root';

import type { ComponentQualityRule } from '../types';

import { createRuleFinding as finding } from './finding';

type SourceSnapshot = {
  componentDir: string;
  indexSource: string;
  typesSource: string;
  implementationSource: string;
  runtimeSource: string;
  combinedSource: string;
};

const capabilityPatterns: Partial<
  Record<ComponentCapability, readonly RegExp[]>
> = {
  disabled: [/\bdisabled\b/i, /\bisDisabled\b/],
  required: [/\brequired\b/i, /\bisRequired\b/],
  invalid: [/\binvalid\b/i, /\bisInvalid\b/, /\berror\b/i],
  loading: [/\bloading\b/i, /\bisLoading\b/],
  'compound-api': [
    /\bObject\.assign\b/,
    /\bRoot\b/,
    /\bTrigger\b/,
    /\bContent\b/,
    /\bItem\b/,
  ],
};

function platformPackage(platform: ComponentPlatform) {
  return platform === 'react' ? 'react' : 'react-native';
}

function readIfExists(filePath: string) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function componentDirectory(
  root: string,
  metadata: ComponentMetadata,
  platform: ComponentPlatform
) {
  return path.join(
    root,
    'packages',
    platformPackage(platform),
    'src',
    metadata.layer,
    metadata.name
  );
}

function shouldIncludeSourceFile(fileName: string) {
  return (
    /\.(ts|tsx)$/.test(fileName) &&
    !/(\.test|\.stories|\.spec)\.(ts|tsx)$/.test(fileName)
  );
}

function collectSourceFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  const entries = fs.readdirSync(directory, { withFileTypes: true });

  return entries
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectSourceFiles(fullPath);
      }

      return shouldIncludeSourceFile(entry.name) ? [fullPath] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function readSourceSnapshot(
  root: string,
  metadata: ComponentMetadata,
  platform: ComponentPlatform
): SourceSnapshot {
  const componentDir = componentDirectory(root, metadata, platform);

  if (!fs.existsSync(componentDir)) {
    return {
      componentDir,
      indexSource: '',
      typesSource: '',
      implementationSource: '',
      runtimeSource: '',
      combinedSource: '',
    };
  }

  const sourceFiles = collectSourceFiles(componentDir);
  const combinedSource = sourceFiles
    .map((filePath) => readIfExists(filePath))
    .join('\n');
  const runtimeSource = sourceFiles
    .filter((filePath) => {
      const fileName = path.basename(filePath);
      return fileName !== 'types.ts' && fileName !== 'index.ts';
    })
    .map((filePath) => readIfExists(filePath))
    .join('\n');

  return {
    componentDir,
    indexSource: readIfExists(path.join(componentDir, 'index.ts')),
    typesSource: readIfExists(path.join(componentDir, 'types.ts')),
    implementationSource:
      readIfExists(path.join(componentDir, `${metadata.name}.tsx`)) ||
      readIfExists(path.join(componentDir, `${metadata.name}.ts`)),
    runtimeSource,
    combinedSource,
  };
}

function hasLinkedRootPropsContract(
  snapshot: SourceSnapshot,
  componentName: string
) {
  const propsName = `${componentName}Props`;
  const rootPropsName = `${componentName}RootProps`;

  if (!snapshot.runtimeSource.includes(rootPropsName)) {
    return false;
  }

  const rootTypesSource = readIfExists(
    path.join(snapshot.componentDir, 'Root', 'types.ts')
  );
  const directAliases = [
    `export type ${propsName} = ${rootPropsName};`,
    `export type ${rootPropsName} = ${propsName};`,
    `export interface ${propsName} extends ${rootPropsName}`,
    `export interface ${rootPropsName} extends ${propsName}`,
  ];

  return directAliases.some(
    (alias) =>
      snapshot.typesSource.includes(alias) || rootTypesSource.includes(alias)
  );
}

export const publicApiSurfaceRule: ComponentQualityRule = {
  definition: {
    id: 'api.public-surface',
    dimension: 'public-api',
    severity: 'required',
    evaluation: 'automated',
    description:
      'Checks that the component exposes its public symbol and that its Props contract is tied to the callable implementation.',
  },
  evaluate(context) {
    const snapshot = readSourceSnapshot(
      qualityRoot(context),
      context.metadata,
      context.platform
    );
    const propsName = `${context.metadata.name}Props`;
    const hasComponentExport = snapshot.indexSource.includes(
      context.metadata.name
    );
    const hasPropsContract = snapshot.typesSource.includes(propsName);
    const propsTypeCallableComponent =
      snapshot.runtimeSource.includes(propsName) ||
      hasLinkedRootPropsContract(snapshot, context.metadata.name);

    if (hasComponentExport && hasPropsContract && propsTypeCallableComponent) {
      return finding(publicApiSurfaceRule, context, 'pass', undefined, [
        path.relative(qualityRoot(context), snapshot.componentDir),
        propsName,
      ]);
    }

    const missing = [
      !hasComponentExport ? `public export for ${context.metadata.name}` : null,
      !hasPropsContract ? `top-level type contract ${propsName}` : null,
      hasPropsContract && !propsTypeCallableComponent
        ? `${propsName} linkage to the callable/root implementation`
        : null,
    ].filter((value): value is string => value !== null);

    return finding(
      publicApiSurfaceRule,
      context,
      'fail',
      `Missing ${missing.join(' and ')}.`,
      [path.relative(qualityRoot(context), snapshot.componentDir)]
    );
  },
};

function lowerCamel(value: string) {
  return `${value[0]?.toLowerCase() ?? ''}${value.slice(1)}`;
}

export const sharedTypeContractRule: ComponentQualityRule = {
  definition: {
    id: 'api.shared-type-contract',
    dimension: 'public-api',
    severity: 'required',
    evaluation: 'automated',
    description:
      'Checks canonical @vellira-ui/types ownership without imposing one renderer adapter shape.',
  },
  evaluate(context) {
    const root = qualityRoot(context);
    const snapshot = readSourceSnapshot(
      root,
      context.metadata,
      context.platform
    );
    const sharedFileName = lowerCamel(context.metadata.name);
    const sharedTypeFile = path.join(
      root,
      'packages',
      'types',
      'src',
      `${sharedFileName}.ts`
    );
    const sharedTypeBarrel = path.join(
      root,
      'packages',
      'types',
      'src',
      'index.ts'
    );
    const sharedSource = readIfExists(sharedTypeFile);
    const barrelSource = readIfExists(sharedTypeBarrel);
    const expectedSharedExport = `export * from './${sharedFileName}';`;
    const dependencies = context.metadata.dependencies?.packages ?? [];
    const declaresSharedDependency = dependencies.includes('@vellira-ui/types');
    const hasSharedFile = fs.existsSync(sharedTypeFile);
    const hasSharedBarrelExport = barrelSource.includes(expectedSharedExport);
    const expectsSharedOwnership =
      declaresSharedDependency || hasSharedFile || hasSharedBarrelExport;

    if (!expectsSharedOwnership) {
      return finding(sharedTypeContractRule, context, 'not-applicable');
    }

    const missing: string[] = [];

    if (!declaresSharedDependency) {
      missing.push('metadata dependency on @vellira-ui/types');
    }

    if (!hasSharedFile || sharedSource.trim().length === 0) {
      missing.push('canonical shared type module');
    }

    if (!hasSharedBarrelExport) {
      missing.push('shared types barrel export');
    }

    if (!snapshot.combinedSource.includes('@vellira-ui/types')) {
      missing.push('renderer derivation/import from @vellira-ui/types');
    }

    return missing.length === 0
      ? finding(sharedTypeContractRule, context, 'pass', undefined, [
          path.relative(root, sharedTypeFile),
          path.relative(root, snapshot.componentDir),
        ])
      : finding(
          sharedTypeContractRule,
          context,
          'fail',
          `Canonical shared type ownership is incomplete: ${missing.join(', ')}.`,
          [
            path.relative(root, sharedTypeFile),
            path.relative(root, snapshot.componentDir),
          ]
        );
  },
};

function supportsControlled(source: string) {
  return (
    /\buseControllableState\b/.test(source) ||
    (/\b(value|checked|open)\b/.test(source) &&
      /\b(onValueChange|onChange|onCheckedChange|onOpenChange)\b/.test(source))
  );
}

function supportsUncontrolled(source: string) {
  return (
    /\buseControllableState\b/.test(source) ||
    /\b(defaultValue|defaultChecked|defaultOpen)\b/.test(source)
  );
}

export const controlledContractRule: ComponentQualityRule = {
  definition: {
    id: 'api.controlled-contract',
    dimension: 'behavior',
    severity: 'required',
    evaluation: 'automated',
    description:
      'Checks controlled and uncontrolled contracts when declared in metadata.',
  },
  evaluate(context) {
    const capabilities = context.metadata.capabilities ?? [];
    const expectsControlled = capabilities.includes('controlled');
    const expectsUncontrolled = capabilities.includes('uncontrolled');

    if (!expectsControlled && !expectsUncontrolled) {
      return finding(controlledContractRule, context, 'not-applicable');
    }

    const source = readSourceSnapshot(
      qualityRoot(context),
      context.metadata,
      context.platform
    ).combinedSource;
    const missing: string[] = [];

    if (expectsControlled && !supportsControlled(source)) {
      missing.push('controlled value/change contract');
    }
    if (expectsUncontrolled && !supportsUncontrolled(source)) {
      missing.push('uncontrolled default-value contract');
    }

    return missing.length === 0
      ? finding(controlledContractRule, context, 'pass')
      : finding(
          controlledContractRule,
          context,
          'fail',
          `Metadata declares ${missing.join(
            ' and '
          )}, but matching source evidence was not found.`
        );
  },
};

export const declaredCapabilitiesRule: ComponentQualityRule = {
  definition: {
    id: 'api.declared-capabilities',
    dimension: 'behavior',
    severity: 'required',
    evaluation: 'automated',
    description:
      'Checks deterministic source evidence for declared V1 capabilities.',
  },
  evaluate(context) {
    const declared = (context.metadata.capabilities ?? []).filter(
      (capability) =>
        capability !== 'controlled' &&
        capability !== 'uncontrolled' &&
        capabilityPatterns[capability] !== undefined
    );

    if (declared.length === 0) {
      return finding(declaredCapabilitiesRule, context, 'not-applicable');
    }

    const source = readSourceSnapshot(
      qualityRoot(context),
      context.metadata,
      context.platform
    ).combinedSource;
    const missing = declared.filter((capability) => {
      const patterns = capabilityPatterns[capability] ?? [];
      return !patterns.some((pattern) => pattern.test(source));
    });

    if (missing.length === 0) {
      return finding(
        declaredCapabilitiesRule,
        context,
        'pass',
        undefined,
        declared
      );
    }

    return finding(
      declaredCapabilitiesRule,
      context,
      'fail',
      `Declared capabilities are missing matching source evidence: ${missing.join(
        ', '
      )}.`,
      missing
    );
  },
};

export const apiFeatureQualityRules: readonly ComponentQualityRule[] = [
  publicApiSurfaceRule,
  sharedTypeContractRule,
  controlledContractRule,
  declaredCapabilitiesRule,
];
