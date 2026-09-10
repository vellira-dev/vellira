import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { checkSourceFile, runVelliraUiUsageCheck } from './checker';

const filePath = 'apps/website/src/sections/home/CodeShowcase/CodeShowcase.tsx';
const source = readFileSync(resolve(process.cwd(), filePath), 'utf8');
const sourceFile = ts.createSourceFile(
  filePath,
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

function attribute(element: ts.JsxElement, name: string) {
  return element.openingElement.attributes.properties.find(
    (prop): prop is ts.JsxAttribute =>
      ts.isJsxAttribute(prop) && prop.name.getText(sourceFile) === name
  );
}

function pickerControl() {
  const controls: ts.JsxElement[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isJsxElement(node) &&
      attribute(node, 'aria-pressed')?.initializer?.getText(sourceFile) ===
        '{activeExample === example}'
    ) {
      controls.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  expect(controls).toHaveLength(1);
  const control = controls[0];
  if (!control) throw new Error('CodeShowcase example picker is missing.');
  return control;
}

describe('CodeShowcase canonical consumer contract', () => {
  it('uses the public bare Button without standard Button geometry', () => {
    const control = pickerControl();
    const appearance = attribute(control, 'appearance');
    const type = attribute(control, 'type');
    expect(control.openingElement.tagName.getText(sourceFile)).toBe('Button');
    expect(appearance?.initializer?.getText(sourceFile)).toBe("'bare'");
    expect(type?.initializer?.getText(sourceFile)).toBe("'button'");
    for (const name of ['size', 'shape', 'fullWidth']) {
      expect(attribute(control, name)).toBeUndefined();
    }

    const canonicalImport = sourceFile.statements
      .filter(ts.isImportDeclaration)
      .find(
        (node) =>
          ts.isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text === '@vellira-ui/react'
      );
    const bindings = canonicalImport?.importClause?.namedBindings;
    expect(
      bindings &&
        ts.isNamedImports(bindings) &&
        bindings.elements.some(
          (element) =>
            element.name.text === 'Button' &&
            (element.propertyName ?? element.name).text === 'Button'
        )
    ).toBe(true);
  });

  it('has no remaining findings or exceptions in the maintained consumer', () => {
    const report = runVelliraUiUsageCheck();
    const findings = report.findings.filter(({ path }) => path === filePath);
    const exceptions = report.exceptions.filter(({ path }) => path === filePath);
    expect(report.summary.filesScanned).toBeGreaterThan(0);
    expect(findings).toEqual([]);
    expect(exceptions).toEqual([]);
    console.log('Post-CodeShowcase Vellira UI usage audit:', report.summary);
  });

  it('detects reverting the actual picker to an authored native button', () => {
    const control = pickerControl();
    // Rewrite only the JSX tag nodes; displayed source-code strings stay intact.
    const tags = [
      control.openingElement.tagName,
      control.closingElement.tagName,
    ].sort((left, right) => right.pos - left.pos);
    const regressed = tags.reduce(
      (text, node) =>
        `${text.slice(0, node.getStart(sourceFile))}button${text.slice(node.end)}`,
      source
    );
    const bypasses = checkSourceFile(filePath, regressed).filter(
      (finding) => finding.ruleId === 'vellira-ui.existing-component-bypass'
    );
    expect(bypasses).toHaveLength(1);
    expect(bypasses[0]?.detected).toBe('button');
  });
});
