import fs from 'node:fs';
import path from 'node:path';

import {
  auditGeneratedThemeTokenDependencySource,
  auditSemanticDependencyRepairSource,
} from '../../../packages/tokens/src/component-token-dependency-audit';
import {
  allowedComponentFactoryDependencyEdgesV1,
  componentTokenDependencyAuditV1,
  componentTokenDependencyPolicyV1,
  semanticDependencyRepairsV1,
  type ComponentPrimitiveColorUsage,
} from '../../../packages/tokens/src/component-token-dependencies';
import { maintainedComponentFactories } from '../../../packages/tokens/src/token-architecture';
import {
  componentTokenDependencyGeneratorRule,
  generatedThemeTokenDependencyAudit,
} from '../../generators/component/token-dependency-contract';
import type { FindingInput, RuleResult } from './contract';

const themes = ['light', 'dark', 'highContrast'] as const;

function finding(
  code: string,
  sourcePath: string,
  evidence: string,
  expected: string
): FindingInput {
  return {
    ruleId: 'tokens.semantic-dependency',
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
      'Use a semantic role by meaning or register the dependency/primitive exception in the canonical #888 authority.',
  };
}

function factoryNameForComponent(component: string) {
  return `create${component[0]!.toUpperCase()}${component.slice(1)}Tokens`;
}

function importedComponentFactoryModules(source: string) {
  return [
    ...source.matchAll(
      /from '\.\.\/\.\.\/factories\/components\/(create[A-Z][A-Za-z0-9]*Tokens)\.js';/g
    ),
  ].map((match) => match[1]!);
}

export function auditComponentDependencySource(input: {
  sourcePath: string;
  source: string;
  component: string;
  factory: string;
  primitiveColorUsage: readonly ComponentPrimitiveColorUsage[];
}): FindingInput[] {
  const findings: FindingInput[] = [];
  const importsPrimitiveColors = input.source.includes(
    '../../primitives/colors.js'
  );
  const classifiedPrimitiveUsage = input.primitiveColorUsage.some(
    (usage) => usage !== 'none'
  );

  if (importsPrimitiveColors !== classifiedPrimitiveUsage) {
    findings.push(
      finding(
        'primitive-color-classification-drift',
        input.sourcePath,
        importsPrimitiveColors
          ? 'Source imports primitive colors without a matching #888 classification.'
          : 'Authority classifies primitive color usage but the source no longer imports primitive colors.',
        'Primitive color usage and its explicit canonical classification must stay in lockstep.'
      )
    );
  }

  for (const usage of input.primitiveColorUsage) {
    if (
      usage !== 'none' &&
      !componentTokenDependencyPolicyV1.primitiveColors.allowedContexts.includes(
        usage
      )
    ) {
      findings.push(
        finding(
          'unknown-primitive-color-context',
          input.sourcePath,
          `${usage} is not a canonical primitive-color exception context.`,
          'Primitive-color exceptions must come from componentTokenDependencyPolicyV1.'
        )
      );
    }
  }

  for (const importedFactory of importedComponentFactoryModules(input.source)) {
    if (importedFactory === input.factory) continue;

    const edge = allowedComponentFactoryDependencyEdgesV1.find(
      ({ from, to }) =>
        from === input.component &&
        factoryNameForComponent(to) === importedFactory
    );
    if (!edge) {
      findings.push(
        finding(
          'unregistered-component-dependency',
          input.sourcePath,
          `${input.component} imports ${importedFactory} without a registered #888 edge.`,
          'Cross-component factory reuse requires an explicit allowedComponentFactoryDependencyEdgesV1 entry.'
        )
      );
    }
  }

  if (input.source.includes('../semantic/action.js')) {
    findings.push(
      finding(
        'deprecated-action-semantic-dependency',
        input.sourcePath,
        'Maintained component construction imports deprecated semantic/action.',
        'Maintained components must use current semantic authorities rather than compatibility action semantics.'
      )
    );
  }

  const usesExternalInputPalette =
    input.component !== 'input' &&
    input.source.includes('createInputColorPalette');
  const inputPaletteEdge = allowedComponentFactoryDependencyEdgesV1.find(
    ({ from, symbol }) =>
      from === input.component && symbol === 'createInputColorPalette'
  );
  if (usesExternalInputPalette !== Boolean(inputPaletteEdge)) {
    findings.push(
      finding(
        'input-palette-edge-drift',
        input.sourcePath,
        usesExternalInputPalette
          ? 'Source consumes createInputColorPalette without the canonical edge.'
          : 'Canonical createInputColorPalette edge exists but the source no longer consumes it.',
        'The registered Input palette dependency edge and source consumption must stay in lockstep.'
      )
    );
  }

  return findings;
}

export function checkTokenSemanticDependencies(root: string): RuleResult {
  const findings: FindingInput[] = [];
  let checked = 0;

  checked += 3;
  if (componentTokenDependencyPolicyV1.semanticRoles.default !== 'required') {
    findings.push(
      finding(
        'semantic-role-policy-weakened',
        'packages/tokens/src/component-token-dependencies.ts',
        `semanticRoles.default is ${componentTokenDependencyPolicyV1.semanticRoles.default}.`,
        'Semantic roles are required by default.'
      )
    );
  }
  if (
    componentTokenDependencyPolicyV1.primitiveColors.default !== 'prohibited'
  ) {
    findings.push(
      finding(
        'primitive-color-policy-weakened',
        'packages/tokens/src/component-token-dependencies.ts',
        `primitiveColors.default is ${componentTokenDependencyPolicyV1.primitiveColors.default}.`,
        'Primitive colors are prohibited by default.'
      )
    );
  }
  if (
    componentTokenDependencyPolicyV1.componentToComponent.default !==
    'prohibited'
  ) {
    findings.push(
      finding(
        'component-dependency-policy-weakened',
        'packages/tokens/src/component-token-dependencies.ts',
        `componentToComponent.default is ${componentTokenDependencyPolicyV1.componentToComponent.default}.`,
        'Component-to-component dependencies are prohibited unless explicitly registered.'
      )
    );
  }

  const maintainedFactories = new Set(
    maintainedComponentFactories.map(({ name }) => name)
  );
  const auditedFactories = new Set(
    componentTokenDependencyAuditV1.map(({ factory }) => factory)
  );
  checked += maintainedFactories.size + auditedFactories.size;
  for (const factory of maintainedFactories) {
    if (!auditedFactories.has(factory)) {
      findings.push(
        finding(
          'maintained-factory-missing-dependency-audit',
          'packages/tokens/src/component-token-dependencies.ts',
          `${factory} is maintained but absent from componentTokenDependencyAuditV1.`,
          'Every maintained factory must have one #888 dependency-audit entry.'
        )
      );
    }
  }
  for (const factory of auditedFactories) {
    if (!maintainedFactories.has(factory)) {
      findings.push(
        finding(
          'stale-dependency-audit-factory',
          'packages/tokens/src/component-token-dependencies.ts',
          `${factory} is audited but not maintained.`,
          'Dependency audit inventory must exactly match maintainedComponentFactories.'
        )
      );
    }
  }

  const componentNames = new Set(
    componentTokenDependencyAuditV1.map(({ component }) => String(component))
  );
  for (const edge of allowedComponentFactoryDependencyEdgesV1) {
    checked += 1;
    if (
      !componentNames.has(edge.from) ||
      !componentNames.has(edge.to) ||
      !edge.symbol.trim() ||
      !edge.reason.trim()
    ) {
      findings.push(
        finding(
          'invalid-registered-component-edge',
          'packages/tokens/src/component-token-dependencies.ts',
          `Invalid registered edge ${edge.from} -> ${edge.to} (${edge.symbol}).`,
          'Registered dependency edges must reference audited components and document a concrete symbol/reason.'
        )
      );
    }
  }

  for (const entry of componentTokenDependencyAuditV1) {
    checked += 1;
    if (entry.unresolved.length > 0) {
      findings.push(
        finding(
          'unresolved-dependency-audit-entry',
          'packages/tokens/src/component-token-dependencies.ts',
          `${entry.component} has unresolved dependency findings: ${entry.unresolved.join(', ')}.`,
          'The accepted #888 baseline requires every maintained component dependency audit to be resolved.'
        )
      );
    }

    for (const theme of themes) {
      checked += 1;
      const sourcePath = `packages/tokens/src/${theme}/components/${entry.file}`;
      const source = fs.readFileSync(path.join(root, sourcePath), 'utf8');
      findings.push(
        ...auditComponentDependencySource({
          sourcePath,
          source,
          component: entry.component,
          factory: entry.factory,
          primitiveColorUsage: entry.primitiveColorUsage,
        })
      );
    }
  }

  for (const repair of semanticDependencyRepairsV1) {
    checked += 1;
    const repairPaths = repair.paths as readonly string[];
    if (repairPaths.length === 0 || !repair.repair.trim()) {
      findings.push(
        finding(
          'invalid-dependency-repair-evidence',
          'packages/tokens/src/component-token-dependencies.ts',
          `${repair.component} has incomplete #888 repair evidence.`,
          'Semantic dependency repairs must identify affected paths and explain the semantic correction.'
        )
      );
    }

    const entry = componentTokenDependencyAuditV1.find(
      ({ component }) => component === repair.component
    );
    if (!entry) {
      findings.push(
        finding(
          'repair-component-missing-dependency-audit',
          'packages/tokens/src/component-token-dependencies.ts',
          `${repair.component} has repair evidence but no dependency-audit entry.`,
          'Every semantic repair must belong to a maintained audited component.'
        )
      );
      continue;
    }

    if (repair.target === 'factory') {
      checked += 1;
      const sourcePath = `packages/tokens/src/factories/components/${entry.factory}.ts`;
      const source = fs.readFileSync(path.join(root, sourcePath), 'utf8');
      for (const issue of auditSemanticDependencyRepairSource({
        repair,
        source,
        theme: null,
      })) {
        findings.push(
          finding(issue.code, sourcePath, issue.evidence, issue.expected)
        );
      }
      continue;
    }

    for (const theme of themes) {
      checked += 1;
      const sourcePath = `packages/tokens/src/${theme}/components/${entry.file}`;
      const source = fs.readFileSync(path.join(root, sourcePath), 'utf8');
      for (const issue of auditSemanticDependencyRepairSource({
        repair,
        source,
        theme,
      })) {
        findings.push(
          finding(issue.code, sourcePath, issue.evidence, issue.expected)
        );
      }
    }
  }

  checked += 2;
  if (
    componentTokenDependencyGeneratorRule !==
    componentTokenDependencyPolicyV1.generatorRule
  ) {
    findings.push(
      finding(
        'generator-dependency-rule-drift',
        'scripts/generators/component/token-dependency-contract.ts',
        'Generator V2 no longer exposes the canonical #888 generator rule.',
        'Generator V2 must consume componentTokenDependencyPolicyV1.generatorRule directly.'
      )
    );
  }
  if (
    generatedThemeTokenDependencyAudit !==
    auditGeneratedThemeTokenDependencySource
  ) {
    findings.push(
      finding(
        'generator-dependency-audit-drift',
        'scripts/generators/component/token-dependency-contract.ts',
        'Generator V2 no longer uses the canonical shared generated-theme dependency audit.',
        'Generator V2 and #890 must consume the same generated-theme dependency audit function.'
      )
    );
  }

  return {
    coverage: 'complete',
    scope:
      'Canonical #888 default policy, exact maintained audit inventory, primitive-color classification, registered component dependency edges, deprecated action protection, all maintained component theme sources, machine-checked accepted repair evidence, and Generator V2 consumption of the same shared generated-theme dependency audit.',
    checked,
    findings,
  };
}
