import fs from 'node:fs';
import path from 'node:path';

import { maintainedComponentFactories } from '../../../packages/tokens/src/token-architecture';
import type { FindingInput, RuleResult } from './contract';

const factoryNamePattern = /^create[A-Z][A-Za-z0-9]*Tokens$/;

function finding(
  code: string,
  sourcePath: string,
  evidence: string,
  expected: string
): FindingInput {
  return {
    ruleId: 'tokens.factory-convention',
    code,
    severity: 'error',
    sourcePath,
    tokenPath: null,
    line: null,
    column: null,
    layer: 'component-factory',
    theme: null,
    platform: null,
    evidence,
    expected,
    migrationStatus: 'not-applicable',
    suggestedAction:
      'Restore the canonical create<Component>Tokens factory responsibility and path.',
  };
}

export function checkTokenFactoryConventions(root: string): RuleResult {
  const findings: FindingInput[] = [];
  const factoriesRoot = path.join(root, 'packages/tokens/src/factories');
  const componentsRoot = path.join(factoriesRoot, 'components');
  const expectedSources = new Set<string>();

  for (const factory of maintainedComponentFactories) {
    const expectedSource = `packages/tokens/src/factories/components/${factory.name}.ts`;
    expectedSources.add(expectedSource);

    if (!factoryNamePattern.test(factory.name) || factory.name.includes('Palette')) {
      findings.push(
        finding(
          'invalid-canonical-factory-name',
          factory.source,
          `Maintained factory is named ${factory.name}.`,
          'create<Component>Tokens'
        )
      );
    }

    if (factory.source !== expectedSource) {
      findings.push(
        finding(
          'invalid-canonical-factory-path',
          factory.source,
          `${factory.name} is registered at ${factory.source}.`,
          expectedSource
        )
      );
    }

    if (!fs.existsSync(path.join(root, expectedSource))) {
      findings.push(
        finding(
          'missing-canonical-factory-source',
          expectedSource,
          `${factory.name} is registered but its canonical source is missing.`,
          expectedSource
        )
      );
    }
  }

  const componentFiles = fs
    .readdirSync(componentsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) =>
      path.posix.join(
        'packages/tokens/src/factories/components',
        entry.name
      )
    );

  for (const source of componentFiles) {
    if (!expectedSources.has(source)) {
      findings.push(
        finding(
          'unregistered-component-factory',
          source,
          'A full-component factory exists outside maintainedComponentFactories.',
          'Every full-component factory must be registered in maintainedComponentFactories.'
        )
      );
    }
  }

  for (const entry of fs.readdirSync(factoriesRoot, { withFileTypes: true })) {
    if (
      entry.isFile() &&
      entry.name !== 'index.ts' &&
      /^create[A-Z].*Tokens\.ts$/.test(entry.name)
    ) {
      findings.push(
        finding(
          'root-factory-bypass',
          `packages/tokens/src/factories/${entry.name}`,
          'A full-component factory bypasses the components responsibility directory.',
          'Full-component factories belong under factories/components.'
        )
      );
    }
  }

  return {
    coverage: 'partial',
    scope:
      'Canonical maintained full-component factory naming, registration, source existence, responsibility directory, and unregistered full-factory detection. Palette-helper classification and semantic-adapter responsibility remain to be connected.',
    checked: maintainedComponentFactories.length + componentFiles.length,
    findings,
  };
}
