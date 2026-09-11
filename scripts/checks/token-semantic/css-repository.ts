import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { canonicalCssVariableNames } from '../../design-resources/authority';
import type { FindingInput, RuleResult } from './contract';
import { componentAncestorProviderVariables } from './css-component-provider';
import { shikiProviderVariables } from './css-external-provider';
import { auditCssReferences, declaredCssVariables } from './css-references';
import { createScssVariableExpressionResolver } from './css-sass-expression';

const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.open-next',
  '.turbo',
  '.vitepress',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'storybook-static',
  'vendor',
]);

function kebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

type ComponentBoundary = {
  rootPath: string;
  componentName: string;
  nestedStyle: boolean;
};

function componentBoundary(sourcePath: string): ComponentBoundary | null {
  const match = sourcePath.match(
    /^packages\/react\/src\/(components|primitives|patterns)\/([^/]+)\/(.+)$/
  );
  if (!match) return null;

  const [, category, componentName, remainder] = match;
  if (!category || !componentName || !remainder) return null;
  return {
    rootPath: `packages/react/src/${category}/${componentName}`,
    componentName,
    nestedStyle: remainder.includes('/'),
  };
}

function runtimeCustomPropertyAssignments(
  sourcePath: string,
  source: string,
  prefix: string | null
): ReadonlySet<string> {
  const variables = new Set<string>();
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  function visit(node: ts.Node): void {
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isStringLiteral(node.name) ||
        ts.isNoSubstitutionTemplateLiteral(node.name)) &&
      node.name.text.startsWith('--') &&
      (prefix === null || node.name.text.startsWith(prefix))
    ) {
      variables.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return variables;
}

function sourceImportsStylesheet(
  root: string,
  providerPath: string,
  stylePath: string,
  source: string
): boolean {
  const sourceFile = ts.createSourceFile(
    providerPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    providerPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const providerDirectory = path.dirname(path.join(root, providerPath));
  const absoluteStylePath = path.resolve(root, stylePath);

  return sourceFile.statements.some((statement) => {
    if (!ts.isImportDeclaration(statement)) return false;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) return false;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith('.')) return false;
    return path.resolve(providerDirectory, specifier) === absoluteStylePath;
  });
}

function sameBasenameRuntimeProviderVariables(
  root: string,
  sourcePath: string
): ReadonlySet<string> {
  const styleMatch = sourcePath.match(/^(.*)\.(?:css|scss)$/);
  if (!styleMatch?.[1]) return new Set();

  const variables = new Set<string>();
  for (const extension of ['.ts', '.tsx']) {
    const providerPath = `${styleMatch[1]}${extension}`;
    const absolutePath = path.join(root, providerPath);
    if (!fs.existsSync(absolutePath)) continue;
    const source = fs.readFileSync(absolutePath, 'utf8');
    if (!sourceImportsStylesheet(root, providerPath, sourcePath, source)) {
      continue;
    }
    for (const variable of runtimeCustomPropertyAssignments(
      providerPath,
      source,
      null
    )) {
      variables.add(variable);
    }
  }
  return variables;
}

function applicationWideProviderVariables(
  root: string,
  sourcePath: string,
  cache: Map<string, ReadonlySet<string>>
): ReadonlySet<string> {
  if (!sourcePath.startsWith('apps/website/')) return new Set();

  const cacheKey = 'apps/website';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const globalsPath = 'apps/website/src/styles/globals.css';
  const layoutPath = 'apps/website/src/app/layout.tsx';
  const absoluteGlobalsPath = path.join(root, globalsPath);
  const absoluteLayoutPath = path.join(root, layoutPath);
  const variables = new Set<string>();

  if (
    fs.existsSync(absoluteGlobalsPath) &&
    fs.existsSync(absoluteLayoutPath) &&
    /(?:import\s+['"]\.\.\/styles\/globals\.css['"]|from\s+['"]\.\.\/styles\/globals\.css['"])/.test(
      fs.readFileSync(absoluteLayoutPath, 'utf8')
    )
  ) {
    const globalsSource = fs.readFileSync(absoluteGlobalsPath, 'utf8');
    for (const variable of declaredCssVariables(globalsPath, globalsSource)) {
      variables.add(variable);
    }
  }

  cache.set(cacheKey, variables);
  return variables;
}

function componentProviderVariables(
  root: string,
  sourcePath: string,
  runtimeCache: Map<string, ReadonlySet<string>>
): ReadonlySet<string> {
  const boundary = componentBoundary(sourcePath);
  if (!boundary) return new Set();

  const prefix = `--${kebabCase(boundary.componentName)}-`;
  const variables = new Set<string>();

  if (boundary.nestedStyle) {
    for (const providerPath of [
      `${boundary.rootPath}/${boundary.componentName}.module.scss`,
      `${boundary.rootPath}/${boundary.componentName}.module.css`,
    ]) {
      const absolutePath = path.join(root, providerPath);
      if (!fs.existsSync(absolutePath)) continue;
      const providerSource = fs.readFileSync(absolutePath, 'utf8');
      for (const variable of declaredCssVariables(
        providerPath,
        providerSource
      )) {
        if (variable.startsWith(prefix)) variables.add(variable);
      }
    }
  }

  let runtimeVariables = runtimeCache.get(boundary.rootPath);
  if (!runtimeVariables) {
    const discovered = new Set<string>();
    const componentRoot = path.join(root, boundary.rootPath);

    function walkRuntimeSources(directory: string) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          walkRuntimeSources(absolutePath);
          continue;
        }
        if (
          !entry.isFile() ||
          !/\.(ts|tsx)$/.test(entry.name) ||
          /\.(?:test|stories)\.(?:ts|tsx)$/.test(entry.name) ||
          entry.name.endsWith('.d.ts')
        ) {
          continue;
        }
        const runtimeSourcePath = path
          .relative(root, absolutePath)
          .split(path.sep)
          .join('/');
        const source = fs.readFileSync(absolutePath, 'utf8');
        for (const variable of runtimeCustomPropertyAssignments(
          runtimeSourcePath,
          source,
          prefix
        )) {
          discovered.add(variable);
        }
      }
    }

    walkRuntimeSources(componentRoot);
    runtimeVariables = discovered;
    runtimeCache.set(boundary.rootPath, runtimeVariables);
  }

  for (const variable of runtimeVariables) variables.add(variable);
  return variables;
}

function componentFamilyProviderCandidates(
  root: string,
  sourcePath: string,
  cache: Map<string, ReadonlySet<string>>
): ReadonlySet<string> {
  const boundary = componentBoundary(sourcePath);
  if (!boundary) return new Set();

  const cached = cache.get(boundary.rootPath);
  if (cached) return cached;

  const prefix = `--${kebabCase(boundary.componentName)}-`;
  const variables = new Set<string>();
  const componentRoot = path.join(root, boundary.rootPath);

  function walkStyles(directory: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walkStyles(absolutePath);
        continue;
      }
      if (!entry.isFile() || !/\.(?:css|scss)$/.test(entry.name)) continue;
      const providerPath = path
        .relative(root, absolutePath)
        .split(path.sep)
        .join('/');
      const providerSource = fs.readFileSync(absolutePath, 'utf8');
      for (const variable of declaredCssVariables(
        providerPath,
        providerSource
      )) {
        if (variable.startsWith(prefix)) variables.add(variable);
      }
    }
  }

  walkStyles(componentRoot);
  cache.set(boundary.rootPath, variables);
  return variables;
}

export function checkTokenCssReferences(root: string): RuleResult {
  const variables = canonicalCssVariableNames(root);
  if (!variables || variables.size === 0) {
    throw new Error(
      'Missing, malformed, or empty generated CSS-variable registry.'
    );
  }
  const findings: FindingInput[] = [];
  const runtimeProviderCache = new Map<string, ReadonlySet<string>>();
  const familyProviderCache = new Map<string, ReadonlySet<string>>();
  const applicationProviderCache = new Map<string, ReadonlySet<string>>();
  const ancestorProviderCache = new Map<string, ReadonlySet<string>>();
  const externalProviderCache = new Map<string, ReadonlySet<string>>();
  let checked = 0;

  function walk(
    directory: string,
    canonicalVariables: ReadonlySet<string>
  ): void {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (ignoredDirectories.has(entry.name)) continue;
      const absolutePath = path.join(directory, entry.name);
      const sourcePath = path
        .relative(root, absolutePath)
        .split(path.sep)
        .join('/');
      if (entry.isSymbolicLink()) {
        findings.push({
          ruleId: 'tokens.consumer-reference',
          code: 'unscanned-source-symlink',
          severity: 'warning',
          sourcePath,
          tokenPath: null,
          line: null,
          column: null,
          layer: 'consumer',
          theme: null,
          platform: 'web',
          evidence: 'A source symlink was not followed by the static scan.',
          expected: 'An explicitly classified source/provider boundary.',
          migrationStatus: 'not-applicable',
          suggestedAction: 'Classify the symlink before completing coverage.',
        });
        continue;
      }
      if (entry.isDirectory()) {
        walk(absolutePath, canonicalVariables);
        continue;
      }
      if (!entry.isFile() || !/\.(css|scss)$/.test(entry.name)) continue;
      if (sourcePath === 'packages/tokens/src/generated/tokens.css') continue;
      const source = fs.readFileSync(absolutePath, 'utf8');
      const providerVariables = new Set([
        ...componentProviderVariables(root, sourcePath, runtimeProviderCache),
        ...componentAncestorProviderVariables(
          root,
          sourcePath,
          ancestorProviderCache
        ),
        ...sameBasenameRuntimeProviderVariables(root, sourcePath),
        ...applicationWideProviderVariables(
          root,
          sourcePath,
          applicationProviderCache
        ),
        ...shikiProviderVariables(
          root,
          sourcePath,
          source,
          externalProviderCache
        ),
      ]);
      const candidateProviderVariables = componentFamilyProviderCandidates(
        root,
        sourcePath,
        familyProviderCache
      );
      const resolveDynamicVariable = createScssVariableExpressionResolver(
        sourcePath,
        source
      );
      checked += 1;
      findings.push(
        ...auditCssReferences(
          sourcePath,
          source,
          canonicalVariables,
          providerVariables,
          candidateProviderVariables,
          resolveDynamicVariable
        )
      );
    }
  }
  // Missing maintained roots are errors, never an empty successful scan.
  for (const name of ['apps', 'packages']) {
    walk(path.join(root, name), variables);
  }
  if (checked === 0) {
    throw new Error('No maintained CSS/SCSS files were scanned.');
  }
  return {
    coverage: 'partial',
    scope:
      'Authored CSS/SCSS references in apps/packages with canonical/static providers, imported same-basename runtime providers, statically proven component/website/Shiki ownership, and bounded Sass list/@each/mixin expansion. General Sass evaluation, escaped identifiers, and other external provider contracts remain incomplete.',
    checked,
    findings,
  };
}
