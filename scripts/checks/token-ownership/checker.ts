import fs from 'node:fs';
import path from 'node:path';

import {
  componentMetadata,
  componentTokenLifecycle,
  semanticTokenLifecycle,
} from '@vellira-ui/metadata';

export type TokenOwnershipFindingCode =
  | 'theme-component-family-drift'
  | 'theme-semantic-namespace-drift'
  | 'unclassified-component-family'
  | 'missing-public-component-family'
  | 'unclassified-semantic-namespace'
  | 'missing-public-semantic-namespace'
  | 'missing-component-metadata-owner'
  | 'invalid-current-component-owner';

export type TokenOwnershipFinding = {
  code: TokenOwnershipFindingCode;
  message: string;
  path: string;
};

export type TokenOwnershipReport = {
  schemaVersion: 1;
  componentFamilies: string[];
  semanticNamespaces: string[];
  findings: TokenOwnershipFinding[];
};

const THEMES = ['light', 'dark', 'highContrast'] as const;

function readBarrelExports(filePath: string) {
  const source = fs.readFileSync(filePath, 'utf8');
  const exports = new Set<string>();

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(
      /^export\s+\{\s*[$\w]+(?:\s+as\s+([$\w]+))?\s*\}\s+from/
    );

    if (!match) continue;

    const directName = line.match(/^export\s+\{\s*([$\w]+)/)?.[1];
    const exportedName = match[1] ?? directName;

    if (exportedName) exports.add(exportedName);
  }

  return [...exports].sort();
}

function sameValues(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function componentTokenExportName(componentName: string) {
  return `${componentName[0].toLowerCase()}${componentName.slice(1)}`;
}

function pushInventoryFindings(params: {
  actual: readonly string[];
  expectedPublic: ReadonlySet<string>;
  unclassifiedCode:
    | 'unclassified-component-family'
    | 'unclassified-semantic-namespace';
  missingCode:
    | 'missing-public-component-family'
    | 'missing-public-semantic-namespace';
  path: string;
  findings: TokenOwnershipFinding[];
}) {
  const actualSet = new Set(params.actual);

  for (const name of params.actual) {
    if (!params.expectedPublic.has(name)) {
      params.findings.push({
        code: params.unclassifiedCode,
        message: `Public token namespace "${name}" has no public lifecycle entry.`,
        path: params.path,
      });
    }
  }

  for (const name of [...params.expectedPublic].sort()) {
    if (!actualSet.has(name)) {
      params.findings.push({
        code: params.missingCode,
        message: `Lifecycle marks "${name}" public, but the token barrel does not export it.`,
        path: params.path,
      });
    }
  }
}

export function checkTokenOwnership(root: string): TokenOwnershipReport {
  const findings: TokenOwnershipFinding[] = [];
  const componentInventories = new Map<string, string[]>();
  const semanticInventories = new Map<string, string[]>();

  for (const theme of THEMES) {
    const componentBarrel = path.join(
      root,
      'packages',
      'tokens',
      'src',
      theme,
      'components',
      'index.ts'
    );
    const semanticBarrel = path.join(
      root,
      'packages',
      'tokens',
      'src',
      theme,
      'semantic',
      'index.ts'
    );

    componentInventories.set(theme, readBarrelExports(componentBarrel));
    semanticInventories.set(theme, readBarrelExports(semanticBarrel));
  }

  const componentFamilies = componentInventories.get('light') ?? [];
  const semanticNamespaces = semanticInventories.get('light') ?? [];

  for (const theme of THEMES.slice(1)) {
    const componentInventory = componentInventories.get(theme) ?? [];
    const semanticInventory = semanticInventories.get(theme) ?? [];

    if (!sameValues(componentFamilies, componentInventory)) {
      findings.push({
        code: 'theme-component-family-drift',
        message: `${theme} component-token families differ from light.`,
        path: `packages/tokens/src/${theme}/components/index.ts`,
      });
    }

    if (!sameValues(semanticNamespaces, semanticInventory)) {
      findings.push({
        code: 'theme-semantic-namespace-drift',
        message: `${theme} semantic namespaces differ from light.`,
        path: `packages/tokens/src/${theme}/semantic/index.ts`,
      });
    }
  }

  const publicComponentFamilies = new Set(
    Object.entries(componentTokenLifecycle)
      .filter(([, entry]) => entry.public)
      .map(([name]) => componentTokenExportName(name))
  );
  const publicSemanticNamespaces = new Set(
    Object.entries(semanticTokenLifecycle)
      .filter(([, entry]) => entry.public)
      .map(([name]) => name)
  );

  pushInventoryFindings({
    actual: componentFamilies,
    expectedPublic: publicComponentFamilies,
    unclassifiedCode: 'unclassified-component-family',
    missingCode: 'missing-public-component-family',
    path: 'packages/tokens/src/light/components/index.ts',
    findings,
  });
  pushInventoryFindings({
    actual: semanticNamespaces,
    expectedPublic: publicSemanticNamespaces,
    unclassifiedCode: 'unclassified-semantic-namespace',
    missingCode: 'missing-public-semantic-namespace',
    path: 'packages/tokens/src/light/semantic/index.ts',
    findings,
  });

  const metadataNames = new Set(componentMetadata.map((entry) => entry.name));

  for (const [family, lifecycle] of Object.entries(componentTokenLifecycle)) {
    if (lifecycle.status !== 'current') continue;

    if (lifecycle.owner !== family) {
      findings.push({
        code: 'invalid-current-component-owner',
        message: `Current component-token family "${family}" must be owned by canonical component metadata of the same name, not "${lifecycle.owner}".`,
        path: 'packages/metadata/src/tokenLifecycle.ts',
      });
      continue;
    }

    if (!metadataNames.has(lifecycle.owner)) {
      findings.push({
        code: 'missing-component-metadata-owner',
        message: `Current component-token family "${family}" references missing component metadata owner "${lifecycle.owner}".`,
        path: 'packages/metadata/src/tokenLifecycle.ts',
      });
    }
  }

  return {
    schemaVersion: 1,
    componentFamilies,
    semanticNamespaces,
    findings,
  };
}
