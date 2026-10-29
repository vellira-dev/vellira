import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

/** Source binding evidence only. Compilation and behavioral gates still apply.
 * Never execute component code or accept comments/import names as a callable.
 */
export function inspectPublicApiBinding(
  root: string,
  directory: string,
  name: string
) {
  root = path.resolve(root);
  directory = path.resolve(directory);
  const files = new Map<string, ts.SourceFile>();
  const addTree = (directory: string) => {
    if (!fs.existsSync(directory) || !fs.lstatSync(directory).isDirectory())
      return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.resolve(directory, entry.name);
      if (entry.isDirectory()) addTree(file);
      else if (
        entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !/\.(?:test|spec|stories)\.tsx?$/.test(entry.name)
      ) {
        files.set(
          file,
          ts.createSourceFile(
            file,
            fs.readFileSync(file, 'utf8'),
            ts.ScriptTarget.Latest,
            true
          )
        );
      }
    }
  };
  addTree(directory);
  addTree(path.join(root, 'packages/types/src'));
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    noLib: true,
    noEmit: true,
    paths: {
      '@vellira-ui/types': [path.resolve(root, 'packages/types/src/index.ts')],
    },
  };
  // Restricted virtual host: binding may read only these source trees, never
  // candidate tsconfig/package hooks, libraries, network or unrelated host files.
  const host: ts.CompilerHost = {
    ...ts.createCompilerHost(options),
    getSourceFile: (file) => files.get(path.resolve(file)),
    readFile: (file) => files.get(path.resolve(file))?.text,
    fileExists: (file) => files.has(path.resolve(file)),
    directoryExists: (dir) =>
      [...files.keys()].some((f) => f.startsWith(path.resolve(dir) + path.sep)),
    getDirectories: () => [],
    getCurrentDirectory: () => root,
    realpath: (file) => path.resolve(file),
    writeFile: () => {
      throw new Error('Read-only API binding cannot emit files.');
    },
  };
  const program = ts.createProgram([...files.keys()], options, host);
  const checker = program.getTypeChecker();
  // Follow the runtime export route as well as the resolved type symbol. TS
  // resolves `export type *` to the original function symbol even though no
  // callable survives at runtime.
  const runtimeExport = (
    module: ts.Symbol | undefined,
    name: string,
    seen = new Set<ts.Symbol>()
  ): boolean => {
    if (!module || seen.has(module)) return false;
    const next = new Set(seen).add(module);
    const symbol = checker
      .getExportsOfModule(module)
      .find((s) => s.name === name);
    const source = module.declarations?.find(ts.isSourceFile);
    if (!symbol || !source) return false;
    if (symbol.declarations?.some((d) => d.getSourceFile() === source))
      return runtimeSymbol(symbol, next);
    return source.statements.some(
      (statement) =>
        ts.isExportDeclaration(statement) &&
        !statement.isTypeOnly &&
        !statement.exportClause &&
        statement.moduleSpecifier &&
        name !== 'default' &&
        runtimeExport(
          checker.getSymbolAtLocation(statement.moduleSpecifier),
          name,
          next
        )
    );
  };
  const runtimeSymbol = (
    symbol: ts.Symbol | undefined,
    seen: Set<ts.Symbol>
  ): boolean => {
    if (!symbol || seen.has(symbol)) return false;
    if (!(symbol.flags & ts.SymbolFlags.Alias))
      return Boolean(symbol.flags & ts.SymbolFlags.Value);
    const next = new Set(seen).add(symbol);
    return (symbol.declarations ?? []).some((d) => {
      if (ts.isTypeOnlyImportOrExportDeclaration(d)) return false;
      if (ts.isExportSpecifier(d) && d.parent.parent.moduleSpecifier)
        return runtimeExport(
          checker.getSymbolAtLocation(d.parent.parent.moduleSpecifier),
          (d.propertyName ?? d.name).text,
          next
        );
      if (ts.isImportSpecifier(d))
        return runtimeExport(
          checker.getSymbolAtLocation(d.parent.parent.parent.moduleSpecifier),
          (d.propertyName ?? d.name).text,
          next
        );
      if (ts.isImportClause(d))
        return runtimeExport(
          checker.getSymbolAtLocation(d.parent.moduleSpecifier),
          'default',
          next
        );
      return runtimeSymbol(checker.getImmediateAliasedSymbol(symbol), next);
    });
  };
  const resolve = (symbol: ts.Symbol | undefined, runtime = false) => {
    if (runtime && !runtimeSymbol(symbol, new Set())) return undefined;
    const seen = new Set<ts.Symbol>();
    while (symbol && symbol.flags & ts.SymbolFlags.Alias) {
      if (seen.has(symbol)) return undefined;
      seen.add(symbol);
      if (
        runtime &&
        symbol.declarations?.some(ts.isTypeOnlyImportOrExportDeclaration)
      )
        return undefined;
      symbol = checker.getImmediateAliasedSymbol(symbol);
    }
    return symbol?.declarations?.length ? symbol : undefined;
  };
  const exported = (file: string, symbol: string, runtime = false) => {
    const source = program.getSourceFile(path.resolve(directory, file));
    const module = source && checker.getSymbolAtLocation(source);
    return module && (!runtime || runtimeExport(module, symbol))
      ? resolve(
          checker.getExportsOfModule(module).find((s) => s.name === symbol),
          runtime
        )
      : undefined;
  };
  const component = exported('index.ts', name, true);
  const props = exported('types.ts', `${name}Props`);
  const hasPropsContract = Boolean(props && props.flags & ts.SymbolFlags.Type);
  const contract = new Set<ts.Symbol>();
  const aliases = (symbol: ts.Symbol | undefined) => {
    symbol = resolve(symbol);
    if (!symbol || contract.has(symbol)) return;
    contract.add(symbol);
    for (const declaration of symbol.declarations ?? []) {
      if (
        ts.isTypeAliasDeclaration(declaration) &&
        ts.isTypeReferenceNode(declaration.type) &&
        !declaration.type.typeArguments?.length
      ) {
        aliases(checker.getSymbolAtLocation(declaration.type.typeName));
      }
      if (
        ts.isInterfaceDeclaration(declaration) &&
        declaration.members.length === 0 &&
        declaration.heritageClauses?.length === 1 &&
        declaration.heritageClauses[0].types.length === 1
      ) {
        for (const clause of declaration.heritageClauses ?? []) {
          for (const base of clause.types) {
            if (!base.typeArguments?.length)
              aliases(checker.getSymbolAtLocation(base.expression));
          }
        }
      }
    }
  };
  aliases(props);

  const linked = (
    node: ts.TypeNode | undefined,
    seen = new Set<ts.Symbol>()
  ): boolean => {
    if (!node) return false;
    if (ts.isParenthesizedTypeNode(node)) return linked(node.type, seen);
    if (!ts.isTypeReferenceNode(node)) return false;
    const symbol = resolve(checker.getSymbolAtLocation(node.typeName));
    if (!symbol || seen.has(symbol)) return false;
    if (contract.has(symbol)) return true;
    seen.add(symbol);
    return (symbol.declarations ?? []).some(
      (declaration) =>
        ts.isTypeAliasDeclaration(declaration) && linked(declaration.type, seen)
    );
  };
  const reactImport = (node: ts.Node, expected: string): boolean => {
    const runtime = expected === 'forwardRef' || expected === 'memo';
    if (ts.isPropertyAccessExpression(node) || ts.isQualifiedName(node)) {
      const owner = ts.isPropertyAccessExpression(node)
        ? node.expression
        : node.left;
      const member = ts.isPropertyAccessExpression(node)
        ? node.name
        : node.right;
      if (member.text !== expected) return false;
      return (checker.getSymbolAtLocation(owner)?.declarations ?? []).some(
        (d) => {
          const clause = ts.isNamespaceImport(d)
            ? d.parent
            : ts.isImportClause(d)
              ? d
              : undefined;
          return (
            clause &&
            !(runtime && clause.isTypeOnly) &&
            ts.isImportDeclaration(clause.parent) &&
            ts.isStringLiteral(clause.parent.moduleSpecifier) &&
            clause.parent.moduleSpecifier.text === 'react'
          );
        }
      );
    }
    return (checker.getSymbolAtLocation(node)?.declarations ?? []).some(
      (d) =>
        ts.isImportSpecifier(d) &&
        !(runtime && (d.isTypeOnly || d.parent.parent.isTypeOnly)) &&
        (d.propertyName ?? d.name).text === expected &&
        ts.isImportDeclaration(d.parent.parent.parent) &&
        ts.isStringLiteral(d.parent.parent.parent.moduleSpecifier) &&
        d.parent.parent.parent.moduleSpecifier.text === 'react'
    );
  };
  const visited = new Set<ts.Node>();
  const callable = (
    node: ts.Node | undefined,
    contextual?: ts.TypeNode
  ): boolean => {
    if (!node || visited.has(node)) return false;
    visited.add(node);
    if (ts.isParenthesizedExpression(node))
      return callable(node.expression, contextual);
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    ) {
      return linked(node.parameters[0]?.type) || linked(contextual);
    }
    if (ts.isVariableDeclaration(node)) {
      let propsType: ts.TypeNode | undefined;
      const annotation = node.type;
      if (
        annotation &&
        ts.isTypeReferenceNode(annotation) &&
        ['FC', 'FunctionComponent'].some((n) =>
          reactImport(annotation.typeName, n)
        )
      ) {
        propsType = annotation.typeArguments?.[0];
      } else if (annotation && ts.isFunctionTypeNode(annotation)) {
        propsType = annotation.parameters[0]?.type;
      }
      // An explicit exported type is authoritative: a correctly typed inner
      // arrow cannot repair an `any`, `unknown` or unrelated public signature.
      if (annotation && !linked(propsType)) return false;
      return callable(node.initializer, propsType);
    }
    if (ts.isExportAssignment(node))
      return callable(node.expression, contextual);
    if (ts.isIdentifier(node)) {
      return (
        resolve(checker.getSymbolAtLocation(node), true)?.declarations ?? []
      ).some((d) => callable(d, contextual));
    }
    if (ts.isCallExpression(node)) {
      if (reactImport(node.expression, 'forwardRef'))
        return callable(node.arguments[0], node.typeArguments?.[1]);
      if (reactImport(node.expression, 'memo'))
        return callable(node.arguments[0], node.typeArguments?.[0]);
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'Object' &&
        node.expression.name.text === 'assign' &&
        !checker.getSymbolAtLocation(node.expression.expression)
      ) {
        return callable(node.arguments[0], contextual);
      }
    }
    return false;
  };
  return {
    hasComponentExport: Boolean(component),
    hasPropsContract,
    propsTypeCallableComponent: Boolean(
      component &&
      hasPropsContract &&
      program.getSyntacticDiagnostics().length === 0 &&
      (component.declarations ?? []).some((declaration) =>
        callable(declaration)
      )
    ),
  };
}
