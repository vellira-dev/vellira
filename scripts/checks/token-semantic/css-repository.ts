import fs from 'node:fs';
import path from 'node:path';

import { canonicalCssVariableNames } from '../../design-resources/authority';
import type { FindingInput, RuleResult } from './contract';
import { auditCssReferences, declaredCssVariables } from './css-references';

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

function componentRootProviderVariables(
  root: string,
  sourcePath: string
): ReadonlySet<string> {
  const match = sourcePath.match(
    /^packages\/react\/src\/(components|primitives|patterns)\/([^/]+)\/(.+)$/
  );
  if (!match) return new Set();

  const [, category, componentName, remainder] = match;
  if (!category || !componentName || !remainder.includes('/')) return new Set();

  const componentRoot = `packages/react/src/${category}/${componentName}`;
  const providerCandidates = [
    `${componentRoot}/${componentName}.module.scss`,
    `${componentRoot}/${componentName}.module.css`,
  ];
  const prefix = `--${kebabCase(componentName)}-`;
  const variables = new Set<string>();

  for (const providerPath of providerCandidates) {
    const absolutePath = path.join(root, providerPath);
    if (!fs.existsSync(absolutePath)) continue;
    const providerSource = fs.readFileSync(absolutePath, 'utf8');
    for (const variable of declaredCssVariables(providerPath, providerSource)) {
      if (variable.startsWith(prefix)) variables.add(variable);
    }
  }

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
      const providerVariables = componentRootProviderVariables(
        root,
        sourcePath
      );
      checked += 1;
      findings.push(
        ...auditCssReferences(
          sourcePath,
          source,
          canonicalVariables,
          providerVariables
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
      'Authored CSS/SCSS static var() references in apps/packages with component-root inheritance providers for nested React component styles. Imported providers, application-level providers, and dynamic references still require integration.',
    checked,
    findings,
  };
}
