import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import {
  getDiscoveryContentFindings,
  LEGACY_DISCOVERY_COMPONENTS,
  type DiscoveryContentCandidate,
  type DiscoveryPlatform,
} from './component-discovery-contract';

export type ComponentDiscoveryAudit = {
  findings: string[];
  adopted: boolean;
  exempt: boolean;
};

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function property(
  object: ts.ObjectLiteralExpression | undefined,
  name: string
): ts.Expression | undefined {
  const member = object?.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) &&
      propertyName(candidate.name) === name
  );
  return member?.initializer;
}

function objectLiteral(
  expression: ts.Expression | undefined
): ts.ObjectLiteralExpression | undefined {
  return expression && ts.isObjectLiteralExpression(expression)
    ? expression
    : undefined;
}

function stringLiteral(expression: ts.Expression | undefined) {
  return expression &&
    (ts.isStringLiteral(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression))
    ? expression.text
    : undefined;
}

function stringArray(expression: ts.Expression | undefined) {
  if (!expression || !ts.isArrayLiteralExpression(expression)) {
    return undefined;
  }
  const items = expression.elements.map((item) => stringLiteral(item));
  return items.every((item): item is string => item !== undefined)
    ? items
    : undefined;
}

type MetadataAuthority = {
  metadata?: ts.ObjectLiteralExpression;
  findings: string[];
};

function staticObjectFindings(
  object: ts.ObjectLiteralExpression,
  field: string
): string[] {
  const findings: string[] = [];
  const keys = new Set<string>();

  for (const member of object.properties) {
    if (ts.isSpreadAssignment(member)) {
      findings.push(field + ' contains unprovable spread');
      continue;
    }
    if (!ts.isPropertyAssignment(member)) {
      findings.push(field + ' contains unprovable property');
      continue;
    }
    const name = propertyName(member.name);
    if (!name) {
      findings.push(field + ' contains unprovable property name');
      continue;
    }
    if (keys.has(name)) {
      findings.push(field + ' has duplicate property: ' + name);
    }
    keys.add(name);
  }

  return findings;
}

function metadataObject(
  source: string,
  functionName: 'defineComponentMetadata' | 'defineComponentPageMetadata',
  expectedName?: string
): MetadataAuthority {
  const file = ts.createSourceFile(
    'component-metadata.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const findings: string[] = [];
  const exportedCalls = file.statements.flatMap((statement) => {
    if (
      !ts.isVariableStatement(statement) ||
      !statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
    ) {
      return [];
    }

    return [...statement.declarationList.declarations].filter((declaration) => {
      const expression = declaration.initializer;
      return (
        expression !== undefined &&
        ts.isCallExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === functionName
      );
    });
  });
  const defaultExports = file.statements.filter(ts.isExportAssignment);

  let expression: ts.Expression | undefined;
  if (functionName === 'defineComponentPageMetadata') {
    if (
      defaultExports.length !== 1 ||
      defaultExports[0].isExportEquals ||
      exportedCalls.length > 0
    ) {
      findings.push('website metadata needs one default-exported authority');
    } else {
      expression = defaultExports[0].expression;
    }
  } else if (
    exportedCalls.length !== 1 ||
    !ts.isIdentifier(exportedCalls[0].name) ||
    exportedCalls[0].name.text !== expectedName ||
    defaultExports.length > 0
  ) {
    findings.push('canonical metadata needs one named-exported authority');
  } else {
    expression = exportedCalls[0].initializer;
  }

  if (file.statements.some(ts.isExportDeclaration)) {
    findings.push('metadata export aliases are unsupported');
  }
  if (
    !expression ||
    !ts.isCallExpression(expression) ||
    !ts.isIdentifier(expression.expression) ||
    expression.expression.text !== functionName ||
    expression.arguments.length !== 1 ||
    !ts.isObjectLiteralExpression(expression.arguments[0])
  ) {
    findings.push('exported metadata must use a static definition call');
    return { findings };
  }

  const metadata = expression.arguments[0];
  findings.push(...staticObjectFindings(metadata, 'metadata'));

  if (functionName === 'defineComponentPageMetadata') {
    const discovery = objectLiteral(property(metadata, 'discovery'));
    if (discovery) {
      findings.push(...staticObjectFindings(discovery, 'discovery'));

      const notes = objectLiteral(property(discovery, 'platformNotes'));
      if (notes) {
        findings.push(
          ...staticObjectFindings(notes, 'discovery.platformNotes')
        );
      }

      const patterns = property(discovery, 'patterns');
      if (patterns && ts.isArrayLiteralExpression(patterns)) {
        for (const [index, pattern] of patterns.elements.entries()) {
          const item = objectLiteral(pattern);
          if (item) {
            findings.push(
              ...staticObjectFindings(item, 'discovery.patterns[' + index + ']')
            );
          }
        }
      }
    }
  }

  return { metadata, findings };
}

function canonicalEvidence(
  componentName: string,
  source: string | undefined
): {
  stable: boolean;
  platforms: readonly DiscoveryPlatform[];
  findings: string[];
} {
  const findings: string[] = [];

  if (source === undefined) {
    return {
      stable: false,
      platforms: [],
      findings: ['canonical metadata file is missing'],
    };
  }

  const exportName =
    componentName[0].toLowerCase() + componentName.slice(1) + 'Metadata';
  const authority = metadataObject(
    source,
    'defineComponentMetadata',
    exportName
  );
  findings.push(...authority.findings);
  const metadata = authority.metadata;
  if (!metadata) {
    return { stable: false, platforms: [], findings };
  }

  if (stringLiteral(property(metadata, 'name')) !== componentName) {
    findings.push('canonical metadata name does not match component directory');
  }

  const status = stringLiteral(property(metadata, 'status'));
  if (
    !status ||
    !['experimental', 'beta', 'stable', 'deprecated'].includes(status)
  ) {
    findings.push('canonical lifecycle status is missing or invalid');
  }

  const platformValues = stringArray(property(metadata, 'platforms'));
  if (
    !platformValues ||
    platformValues.length === 0 ||
    platformValues.some(
      (item) => item !== 'react' && item !== 'react-native'
    ) ||
    new Set(platformValues).size !== platformValues.length
  ) {
    findings.push('canonical platforms are missing or invalid');
  }

  const platforms =
    findings.length === 0 ? (platformValues as DiscoveryPlatform[]) : [];

  return { stable: status === 'stable', platforms, findings };
}

function discoveryContent(object: ts.ObjectLiteralExpression) {
  const patternsNode = property(object, 'patterns');
  const patterns =
    patternsNode && ts.isArrayLiteralExpression(patternsNode)
      ? patternsNode.elements.map((item) => {
          const pattern = objectLiteral(item);
          return {
            id: stringLiteral(property(pattern, 'id')),
            title: stringLiteral(property(pattern, 'title')),
            description: stringLiteral(property(pattern, 'description')),
          };
        })
      : undefined;
  const platformNotes = objectLiteral(property(object, 'platformNotes'));

  return {
    status: stringLiteral(property(object, 'status')) as
      DiscoveryContentCandidate['status'] | undefined,
    summary: stringLiteral(property(object, 'summary')),
    description: stringLiteral(property(object, 'description')),
    whenToUse: stringArray(property(object, 'whenToUse')),
    patterns,
    platformNotes: platformNotes
      ? {
          react: stringArray(property(platformNotes, 'react')),
          'react-native': stringArray(property(platformNotes, 'react-native')),
        }
      : undefined,
    missingEvidence: stringArray(property(object, 'missingEvidence')),
  } satisfies DiscoveryContentCandidate;
}

/**
 * Both full-catalog CI and the targeted component-generator check use this
 * deterministic source-level validation. Dynamic/unknown declarations fail
 * closed instead of being executed or silently treated as absent.
 */
export function auditComponentDiscoverySources(params: {
  componentName: string;
  canonicalSource: string | undefined;
  pageSource: string | undefined;
}): ComponentDiscoveryAudit {
  const { componentName, canonicalSource, pageSource } = params;
  const canonical = canonicalEvidence(componentName, canonicalSource);
  const findings = [...canonical.findings];

  if (pageSource === undefined) {
    findings.push('website component metadata file is missing');
    return { findings, adopted: false, exempt: false };
  }

  const authority = metadataObject(pageSource, 'defineComponentPageMetadata');
  findings.push(...authority.findings);
  const metadata = authority.metadata;
  if (!metadata) {
    return { findings, adopted: false, exempt: false };
  }

  const discoveryNode = property(metadata, 'discovery');
  const adopted = discoveryNode !== undefined;
  const isLegacy = LEGACY_DISCOVERY_COMPONENTS.some(
    (name) => name === componentName
  );

  if (!adopted && isLegacy) {
    return {
      findings,
      adopted: false,
      exempt: true,
    };
  }

  if (adopted && isLegacy) {
    findings.push(
      'discovery was adopted; remove its temporary #1136 exemption'
    );
  }

  // Never downgrade validation when canonical lifecycle/platform evidence
  // cannot be proven, even if website metadata looks complete.
  if (canonical.findings.length > 0) {
    return { findings, adopted, exempt: false };
  }

  const discovery = objectLiteral(discoveryNode);
  if (adopted && !discovery) {
    findings.push('discovery must be a static object');
  } else {
    findings.push(
      ...getDiscoveryContentFindings({
        discovery: discovery ? discoveryContent(discovery) : undefined,
        stable: canonical.stable,
        platforms: canonical.platforms,
      })
    );
  }

  return { findings, adopted, exempt: false };
}

export function auditComponentDiscoveryFile(
  root: string,
  componentName: string
): ComponentDiscoveryAudit {
  const pageFile = path.join(
    root,
    'apps/website/src/component-catalog/components',
    componentName,
    'metadata.ts'
  );
  const canonicalFile = path.join(
    root,
    'packages/metadata/src/components',
    componentName + '.metadata.ts'
  );

  return auditComponentDiscoverySources({
    componentName,
    canonicalSource: fs.existsSync(canonicalFile)
      ? fs.readFileSync(canonicalFile, 'utf8')
      : undefined,
    pageSource: fs.existsSync(pageFile)
      ? fs.readFileSync(pageFile, 'utf8')
      : undefined,
  });
}

export function auditComponentDiscoveryCatalog(root = process.cwd()) {
  const componentsRoot = path.join(
    root,
    'apps/website/src/component-catalog/components'
  );

  if (!fs.existsSync(componentsRoot)) {
    return {
      checked: 0,
      adopted: 0,
      exempt: 0,
      findings: ['website component catalog directory is missing'],
    };
  }

  // A directory without metadata.ts must be reported, not removed from the
  // inventory before Discovery authority is checked.
  const directories = fs
    .readdirSync(componentsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const findings: string[] = [];
  let adopted = 0;
  let exempt = 0;

  if (directories.length === 0) {
    findings.push('website component inventory is empty');
  }

  for (const componentName of directories) {
    const result = auditComponentDiscoveryFile(root, componentName);
    findings.push(
      ...result.findings.map((finding) => componentName + ': ' + finding)
    );
    adopted += result.adopted ? 1 : 0;
    exempt += result.exempt ? 1 : 0;
  }

  for (const componentName of LEGACY_DISCOVERY_COMPONENTS) {
    if (!directories.includes(componentName)) {
      findings.push(componentName + ': stale #1136 legacy discovery exemption');
    }
  }

  return { checked: directories.length, adopted, exempt, findings };
}
