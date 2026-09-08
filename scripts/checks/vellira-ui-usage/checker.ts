import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { componentMetadata } from '../../../packages/metadata/src/components/index';
import {
  canonicalCssVariableNames,
  canonicalIconExports,
} from '../../design-resources/authority';
import { velliraUiUsageExceptions } from './exceptions';
import type {
  AppliedVelliraUiUsageException,
  VelliraUiUsageException,
  VelliraUiUsageFinding,
  VelliraUiUsageReport,
  VelliraUiUsageRuleId,
} from './types';

const SCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const STYLE_EXTENSIONS = new Set(['.css', '.scss']);
const SCANNED_EXTENSIONS = new Set([...SCRIPT_EXTENSIONS, ...STYLE_EXTENSIONS]);
const IGNORED_SEGMENTS = new Set([
  '.next',
  'coverage',
  'dist',
  'node_modules',
  'storybook-static',
  'vendor',
]);

const CANONICAL_COMPONENTS: ReadonlySet<string> = new Set<string>(
  componentMetadata.map((metadata) => metadata.name)
);

const DIRECT_PRIMITIVE_ALTERNATIVES = {
  button: 'Button',
  select: 'Select',
} as const;

const COMPONENT_NAME_ALIASES: Readonly<Record<string, string>> = {
  Dialog: 'Modal',
  Field: 'FormField',
  Menu: 'Dropdown',
};

const NON_TEXT_INPUT_TYPES = new Set(['color', 'file', 'hidden', 'range']);
const COLOR_STYLE_PROPERTIES = new Set([
  'background',
  'backgroundColor',
  'border',
  'borderColor',
  'color',
  'fill',
  'outline',
  'outlineColor',
  'stroke',
]);
const CSS_COLOR_PROPERTIES =
  /^(?:background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|box-shadow|color|fill|outline(?:-color)?|stroke|text-shadow)$/;
const RAW_COLOR_VALUE = /#[0-9a-fA-F]{3,8}\b|(?:rgb|rgba|hsl|hsla)\([^()]*\)/;
const THIRD_PARTY_ICON_PACKAGES =
  /^(?:@heroicons\/|lucide(?:-react)?$|react-icons(?:\/|$))/;
const THIRD_PARTY_UI_PACKAGES =
  /^(?:@chakra-ui\/|@headlessui\/|@mui\/|@radix-ui\/|antd$|react-aria-components$|react-bootstrap$|semantic-ui-react$)/;

export interface VelliraUiUsageAuthorities {
  canonicalIcons: ReadonlySet<string>;
  canonicalCssVariables: ReadonlySet<string>;
}

interface VelliraUiUsageCheckOptions {
  authorities?: VelliraUiUsageAuthorities;
  exceptions?: readonly VelliraUiUsageException[];
}

export function runVelliraUiUsageCheck(
  rootDir = process.cwd(),
  options: VelliraUiUsageCheckOptions = {}
): VelliraUiUsageReport {
  const root = path.resolve(rootDir);
  const appsRoot = path.join(root, 'apps');
  const files = fs.existsSync(appsRoot) ? listSourceFiles(appsRoot) : [];
  const authorities = options.authorities ?? loadCanonicalAuthorities(root);
  const exceptions = options.exceptions ?? velliraUiUsageExceptions;
  const candidateFindings: VelliraUiUsageFinding[] = [];
  const sources = files
    .map((filePath) => ({
      filePath,
      source: fs.readFileSync(filePath, 'utf8'),
    }))
    .filter(({ source }) => !isGeneratedSource(source));
  const authoredCssVariables = collectAuthoredCssVariables(sources);

  for (const { filePath, source } of sources) {
    const relativePath = portablePath(path.relative(root, filePath));
    const extension = path.extname(filePath);

    if (SCRIPT_EXTENSIONS.has(extension)) {
      candidateFindings.push(
        ...checkSourceFile(relativePath, source, authorities)
      );
    } else if (STYLE_EXTENSIONS.has(extension)) {
      candidateFindings.push(
        ...checkStyleFile(
          relativePath,
          source,
          authorities,
          authoredCssVariables
        )
      );
    }
  }

  candidateFindings.sort(compareFindings);
  const { findings, appliedExceptions } = applyExceptions(
    candidateFindings,
    exceptions
  );

  return {
    schemaVersion: '1',
    mode: 'audit',
    findings,
    exceptions: appliedExceptions,
    summary: {
      filesScanned: files.length,
      findings: findings.length,
      blockingFindings: findings.filter((finding) => finding.blocking).length,
      exceptionsApplied: appliedExceptions.length,
    },
  };
}

export function checkSourceFile(
  filePath: string,
  source: string,
  authorities: VelliraUiUsageAuthorities = emptyAuthorities()
): VelliraUiUsageFinding[] {
  if (!isMaintainedFirstPartyPath(filePath) || isGeneratedSource(source)) {
    return [];
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(filePath)
  );
  const findings: VelliraUiUsageFinding[] = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      findings.push(
        ...findingsForImport(filePath, sourceFile, node, authorities)
      );
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      const controlFinding = findingForIntrinsicElement(
        filePath,
        sourceFile,
        node,
        tagName
      );
      if (controlFinding) {
        findings.push(controlFinding);
      }

      if (tagName === 'svg') {
        findings.push(
          findingAtNode({
            ruleId: 'vellira-ui.noncanonical-icon',
            filePath,
            sourceFile,
            node,
            detected: 'svg',
            nextAction: 'request-missing-resource',
            message:
              'Inline authored <svg> bypasses the canonical Vellira icon source. Reuse a canonical icon export or route the missing glyph through the design-resource workflow.',
          })
        );
      }

      findings.push(...findingsForInlineStyle(filePath, sourceFile, node));
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return findings.sort(compareFindings);
}

export function checkStyleFile(
  filePath: string,
  source: string,
  authorities: VelliraUiUsageAuthorities,
  authoredCssVariables: ReadonlySet<string> = new Set<string>()
): VelliraUiUsageFinding[] {
  if (!isMaintainedFirstPartyPath(filePath) || isGeneratedSource(source)) {
    return [];
  }

  const findings: VelliraUiUsageFinding[] = [];
  const stripped = stripCssComments(source);
  const canonicalPrefixes = canonicalCssVariablePrefixes(
    authorities.canonicalCssVariables
  );

  for (const match of stripped.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\b/g)) {
    const variableName = match[1];
    const index = match.index + match[0].indexOf(variableName);

    const prefix = cssVariablePrefix(variableName);

    if (
      authorities.canonicalCssVariables.has(variableName) ||
      authoredCssVariables.has(variableName) ||
      prefix === null ||
      !canonicalPrefixes.has(prefix)
    ) {
      continue;
    }

    findings.push(
      findingAtText({
        ruleId: 'vellira-ui.missing-token-resource',
        filePath,
        source,
        index,
        detected: variableName,
        nextAction: 'request-missing-resource',
        message: `CSS variable ${variableName} uses a canonical Vellira token namespace but is absent from the canonical generated token registry. Use a registered token or request the missing token through the design-resource workflow.`,
      })
    );
  }

  const declarationPattern = /([A-Za-z-]+)\s*:\s*([^;{}\n]+)/g;
  for (const match of stripped.matchAll(declarationPattern)) {
    const property = match[1].toLowerCase();
    const value = match[2];
    if (!CSS_COLOR_PROPERTIES.test(property)) {
      continue;
    }

    const rawColor = value.match(RAW_COLOR_VALUE);
    if (!rawColor || rawColor.index === undefined) {
      continue;
    }

    const index = match.index + match[0].indexOf(value) + rawColor.index;
    findings.push(
      findingAtText({
        ruleId: 'vellira-ui.noncanonical-token-value',
        filePath,
        source,
        index,
        detected: rawColor[0],
        nextAction: 'request-missing-resource',
        message: `Hard-coded visual color ${rawColor[0]} bypasses canonical Vellira tokens in maintained first-party UI. Reuse a semantic token or request a missing token through the design-resource workflow.`,
      })
    );
  }

  return findings.sort(compareFindings);
}

function loadCanonicalAuthorities(root: string): VelliraUiUsageAuthorities {
  const webIcons = canonicalIconExports({ root, platform: 'react' });
  const nativeIcons = canonicalIconExports({ root, platform: 'react-native' });
  const canonicalCssVariables = canonicalCssVariableNames(root);

  if (!webIcons || !nativeIcons || !canonicalCssVariables) {
    throw new Error(
      'Vellira UI usage checker could not load canonical #760 icon/token authorities.'
    );
  }

  return {
    canonicalIcons: new Set([...webIcons, ...nativeIcons]),
    canonicalCssVariables,
  };
}

function findingsForImport(
  filePath: string,
  sourceFile: ts.SourceFile,
  node: ts.ImportDeclaration,
  authorities: VelliraUiUsageAuthorities
): VelliraUiUsageFinding[] {
  if (!ts.isStringLiteral(node.moduleSpecifier) || !node.importClause) {
    return [];
  }

  const moduleName = node.moduleSpecifier.text;
  if (moduleName.startsWith('@vellira-ui/')) {
    return [];
  }

  const importedNames = importBindingNames(node.importClause);
  const localModule = isLocalModuleSpecifier(moduleName);
  const findings: VelliraUiUsageFinding[] = [];

  for (const imported of importedNames) {
    const canonicalComponent = canonicalComponentForName(
      imported.importedName,
      imported.localName
    );

    if (
      canonicalComponent &&
      (localModule || THIRD_PARTY_UI_PACKAGES.test(moduleName))
    ) {
      findings.push(
        findingAtNode({
          ruleId: localModule
            ? 'vellira-ui.local-component-duplicate'
            : 'vellira-ui.third-party-bypass',
          filePath,
          sourceFile,
          node,
          detected: `${moduleName}:${imported.localName}`,
          canonicalAlternative: canonicalComponent,
          nextAction: 'reuse-existing',
          message: localModule
            ? `Local component ${imported.localName} from ${moduleName} duplicates canonical ${canonicalComponent}. Prefer the public Vellira component instead of maintaining a parallel app-local abstraction.`
            : `Third-party component ${imported.localName} from ${moduleName} bypasses canonical ${canonicalComponent}. Use the Vellira abstraction in maintained first-party UI.`,
        })
      );
    }

    const canonicalIcon = canonicalIconForImport(
      moduleName,
      imported.importedName,
      imported.localName,
      authorities.canonicalIcons
    );
    if (canonicalIcon) {
      findings.push(
        findingAtNode({
          ruleId: 'vellira-ui.noncanonical-icon',
          filePath,
          sourceFile,
          node,
          detected: `${moduleName}:${imported.localName}`,
          canonicalAlternative: canonicalIcon,
          nextAction: 'reuse-existing',
          message: `Icon ${imported.localName} is sourced from ${moduleName} even though canonical Vellira icon ${canonicalIcon} exists. Import it from the canonical icon surface instead.`,
        })
      );
    }
  }

  return findings;
}

function importBindingNames(importClause: ts.ImportClause): Array<{
  importedName: string;
  localName: string;
}> {
  const result: Array<{ importedName: string; localName: string }> = [];

  if (importClause.name) {
    result.push({
      importedName: importClause.name.text,
      localName: importClause.name.text,
    });
  }

  const bindings = importClause.namedBindings;
  if (bindings && ts.isNamedImports(bindings)) {
    for (const element of bindings.elements) {
      result.push({
        importedName: (element.propertyName ?? element.name).text,
        localName: element.name.text,
      });
    }
  }

  return result;
}

function canonicalComponentForName(
  importedName: string,
  localName: string
): string | null {
  for (const candidate of [importedName, localName]) {
    const canonical = COMPONENT_NAME_ALIASES[candidate] ?? candidate;
    if (CANONICAL_COMPONENTS.has(canonical)) {
      return canonical;
    }
  }

  return null;
}

function canonicalIconForImport(
  moduleName: string,
  importedName: string,
  localName: string,
  canonicalIcons: ReadonlySet<string>
): string | null {
  const iconishModule =
    isLocalModuleSpecifier(moduleName) &&
    /(?:^|[/\\])icons?(?:[/\\]|$)/i.test(moduleName);
  const thirdPartyIconModule = THIRD_PARTY_ICON_PACKAGES.test(moduleName);
  const iconishName = /Icon$/.test(importedName) || /Icon$/.test(localName);

  if (!iconishModule && !thirdPartyIconModule && !iconishName) {
    return null;
  }

  for (const candidate of [importedName, localName]) {
    const normalized = candidate.replace(/Icon$/, '');
    if (canonicalIcons.has(normalized)) {
      return normalized;
    }
  }

  return null;
}

function findingsForInlineStyle(
  filePath: string,
  sourceFile: ts.SourceFile,
  node: ts.JsxOpeningLikeElement
): VelliraUiUsageFinding[] {
  const findings: VelliraUiUsageFinding[] = [];

  for (const property of node.attributes.properties) {
    if (
      !ts.isJsxAttribute(property) ||
      !ts.isIdentifier(property.name) ||
      property.name.text !== 'style' ||
      !property.initializer ||
      !ts.isJsxExpression(property.initializer) ||
      !property.initializer.expression ||
      !ts.isObjectLiteralExpression(property.initializer.expression)
    ) {
      continue;
    }

    for (const styleProperty of property.initializer.expression.properties) {
      if (!ts.isPropertyAssignment(styleProperty)) {
        continue;
      }

      const propertyName = propertyNameText(styleProperty.name);
      if (!propertyName || !COLOR_STYLE_PROPERTIES.has(propertyName)) {
        continue;
      }

      const value = stringLiteralText(styleProperty.initializer);
      if (!value || !RAW_COLOR_VALUE.test(value)) {
        continue;
      }

      const rawColor = value.match(RAW_COLOR_VALUE)?.[0];
      if (!rawColor) {
        continue;
      }

      findings.push(
        findingAtNode({
          ruleId: 'vellira-ui.noncanonical-token-value',
          filePath,
          sourceFile,
          node: styleProperty,
          detected: rawColor,
          nextAction: 'request-missing-resource',
          message: `Hard-coded visual color ${rawColor} bypasses canonical Vellira tokens in maintained first-party UI. Reuse a semantic token or request a missing token through the design-resource workflow.`,
        })
      );
    }
  }

  return findings;
}

function findingForIntrinsicElement(
  filePath: string,
  sourceFile: ts.SourceFile,
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  tagName: string
): VelliraUiUsageFinding | null {
  const directAlternative =
    DIRECT_PRIMITIVE_ALTERNATIVES[
      tagName as keyof typeof DIRECT_PRIMITIVE_ALTERNATIVES
    ];

  if (directAlternative && CANONICAL_COMPONENTS.has(directAlternative)) {
    return existingComponentFinding(
      filePath,
      sourceFile,
      node,
      tagName,
      directAlternative
    );
  }

  if (tagName === 'input') {
    const inputType = jsxStringAttribute(node, 'type')?.toLowerCase();
    if (inputType && NON_TEXT_INPUT_TYPES.has(inputType)) {
      return null;
    }

    const canonicalAlternative =
      inputType === 'checkbox'
        ? 'Checkbox'
        : inputType === 'radio'
          ? 'Radio'
          : 'Input';

    if (!CANONICAL_COMPONENTS.has(canonicalAlternative)) {
      return missingComponentFinding(
        filePath,
        sourceFile,
        node,
        tagName,
        canonicalAlternative
      );
    }

    return existingComponentFinding(
      filePath,
      sourceFile,
      node,
      tagName,
      canonicalAlternative
    );
  }

  if (tagName === 'textarea') {
    if (CANONICAL_COMPONENTS.has('Textarea')) {
      return existingComponentFinding(
        filePath,
        sourceFile,
        node,
        tagName,
        'Textarea'
      );
    }

    return missingComponentFinding(
      filePath,
      sourceFile,
      node,
      tagName,
      'Textarea'
    );
  }

  return null;
}

function existingComponentFinding(
  filePath: string,
  sourceFile: ts.SourceFile,
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  detected: string,
  canonicalAlternative: string
): VelliraUiUsageFinding {
  return findingAtNode({
    ruleId: 'vellira-ui.existing-component-bypass',
    filePath,
    sourceFile,
    node,
    detected,
    canonicalAlternative,
    nextAction: 'reuse-existing',
    message: `Use canonical ${canonicalAlternative} instead of authored <${detected}> in maintained first-party UI, or classify a narrow architectural exception.`,
  });
}

function missingComponentFinding(
  filePath: string,
  sourceFile: ts.SourceFile,
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  detected: string,
  requestedComponent: string
): VelliraUiUsageFinding {
  return findingAtNode({
    ruleId: 'vellira-ui.missing-component',
    filePath,
    sourceFile,
    node,
    detected,
    nextAction: 'request-missing-component',
    message: `No canonical ${requestedComponent} exists for authored <${detected}>. Route the reusable capability through the canonical component production workflow instead of creating a permanent local substitute.`,
  });
}

function findingAtNode(params: {
  ruleId: VelliraUiUsageRuleId;
  filePath: string;
  sourceFile: ts.SourceFile;
  node: ts.Node;
  detected: string;
  canonicalAlternative?: string;
  nextAction: VelliraUiUsageFinding['nextAction'];
  message: string;
}): VelliraUiUsageFinding {
  const location = params.sourceFile.getLineAndCharacterOfPosition(
    params.node.getStart(params.sourceFile)
  );

  return {
    ruleId: params.ruleId,
    path: params.filePath,
    line: location.line + 1,
    column: location.character + 1,
    detected: params.detected,
    ...(params.canonicalAlternative
      ? { canonicalAlternative: params.canonicalAlternative }
      : {}),
    severity: 'warning',
    blocking: false,
    nextAction: params.nextAction,
    message: params.message,
  };
}

function findingAtText(params: {
  ruleId: VelliraUiUsageRuleId;
  filePath: string;
  source: string;
  index: number;
  detected: string;
  nextAction: VelliraUiUsageFinding['nextAction'];
  message: string;
}): VelliraUiUsageFinding {
  const location = textLocation(params.source, params.index);

  return {
    ruleId: params.ruleId,
    path: params.filePath,
    line: location.line,
    column: location.column,
    detected: params.detected,
    severity: 'warning',
    blocking: false,
    nextAction: params.nextAction,
    message: params.message,
  };
}

function applyExceptions(
  findings: readonly VelliraUiUsageFinding[],
  exceptions: readonly VelliraUiUsageException[]
): {
  findings: VelliraUiUsageFinding[];
  appliedExceptions: AppliedVelliraUiUsageException[];
} {
  validateExceptions(exceptions);
  const remaining = [...findings];
  const appliedExceptions: AppliedVelliraUiUsageException[] = [];

  for (const exception of exceptions) {
    const index = remaining.findIndex(
      (finding) =>
        finding.ruleId === exception.ruleId &&
        finding.path === exception.path &&
        finding.line === exception.line &&
        finding.detected === exception.detected
    );

    if (index < 0) {
      throw new Error(
        `Stale Vellira UI usage exception: ${exception.ruleId} ${exception.path}:${exception.line} ${exception.detected}`
      );
    }

    const [finding] = remaining.splice(index, 1);
    appliedExceptions.push({ ...exception, column: finding.column });
  }

  remaining.sort(compareFindings);
  appliedExceptions.sort(compareExceptions);

  return { findings: remaining, appliedExceptions };
}

function validateExceptions(exceptions: readonly VelliraUiUsageException[]) {
  const keys = new Set<string>();

  for (const exception of exceptions) {
    if (
      exception.line < 1 ||
      /[*?[\]]/.test(exception.path) ||
      !exception.path.startsWith('apps/') ||
      exception.reason.trim().length < 12
    ) {
      throw new Error(
        `Vellira UI usage exception must be exact and documented: ${exception.path}`
      );
    }

    const key = `${exception.ruleId}\0${exception.path}\0${exception.line}\0${exception.detected}`;
    if (keys.has(key)) {
      throw new Error(`Duplicate Vellira UI usage exception: ${key}`);
    }
    keys.add(key);
  }
}

function jsxStringAttribute(
  node: ts.JsxOpeningLikeElement,
  attributeName: string
): string | null {
  for (const property of node.attributes.properties) {
    if (
      !ts.isJsxAttribute(property) ||
      !ts.isIdentifier(property.name) ||
      property.name.text !== attributeName ||
      !property.initializer
    ) {
      continue;
    }

    if (ts.isStringLiteral(property.initializer)) {
      return property.initializer.text;
    }

    if (
      ts.isJsxExpression(property.initializer) &&
      property.initializer.expression &&
      ts.isStringLiteralLike(property.initializer.expression)
    ) {
      return property.initializer.expression.text;
    }
  }

  return null;
}

function listSourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (IGNORED_SEGMENTS.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }

  return files.sort();
}

function isMaintainedFirstPartyPath(filePath: string): boolean {
  const portable = portablePath(filePath);
  const segments = portable.split('/');

  return (
    segments[0] === 'apps' &&
    !segments.some((segment) => IGNORED_SEGMENTS.has(segment))
  );
}

function isGeneratedSource(source: string): boolean {
  return /(?:AUTO-GENERATED|DO NOT EDIT(?: MANUALLY)?)/i.test(
    source.slice(0, 500)
  );
}

function scriptKindFor(filePath: string): ts.ScriptKind {
  switch (path.extname(filePath)) {
    case '.js':
      return ts.ScriptKind.JS;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.tsx':
      return ts.ScriptKind.TSX;
    default:
      return ts.ScriptKind.TS;
  }
}

function isLocalModuleSpecifier(moduleName: string): boolean {
  return (
    moduleName.startsWith('.') ||
    moduleName.startsWith('@/') ||
    moduleName.startsWith('~/')
  );
}

function propertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
    return name.text;
  }
  return null;
}

function stringLiteralText(expression: ts.Expression): string | null {
  return ts.isStringLiteralLike(expression) ? expression.text : null;
}

function collectAuthoredCssVariables(
  sources: readonly { filePath: string; source: string }[]
): ReadonlySet<string> {
  const variables = new Set<string>();

  for (const { filePath, source } of sources) {
    if (!STYLE_EXTENSIONS.has(path.extname(filePath))) {
      continue;
    }

    const stripped = stripCssComments(source);
    for (const match of stripped.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) {
      variables.add(match[1]);
    }
  }

  return variables;
}

function canonicalCssVariablePrefixes(
  variables: ReadonlySet<string>
): ReadonlySet<string> {
  return new Set(
    [...variables]
      .map(cssVariablePrefix)
      .filter((prefix): prefix is string => prefix !== null)
  );
}

function cssVariablePrefix(variableName: string): string | null {
  return /^--([A-Za-z0-9]+)-/.exec(variableName)?.[1] ?? null;
}

function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ' ')
  );
}

function textLocation(
  source: string,
  index: number
): {
  line: number;
  column: number;
} {
  const prefix = source.slice(0, index);
  const lines = prefix.split('\n');
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function emptyAuthorities(): VelliraUiUsageAuthorities {
  return {
    canonicalIcons: new Set<string>(),
    canonicalCssVariables: new Set<string>(),
  };
}

function compareFindings(
  left: VelliraUiUsageFinding,
  right: VelliraUiUsageFinding
): number {
  return (
    left.path.localeCompare(right.path) ||
    left.line - right.line ||
    left.column - right.column ||
    left.ruleId.localeCompare(right.ruleId) ||
    left.detected.localeCompare(right.detected)
  );
}

function compareExceptions(
  left: AppliedVelliraUiUsageException,
  right: AppliedVelliraUiUsageException
): number {
  return (
    left.path.localeCompare(right.path) ||
    left.line - right.line ||
    left.column - right.column ||
    left.ruleId.localeCompare(right.ruleId) ||
    left.detected.localeCompare(right.detected)
  );
}

function portablePath(value: string): string {
  return value.replaceAll(path.sep, '/');
}
