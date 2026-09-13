import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { checkSourceFile, runVelliraUiUsageCheck } from './checker';

const filePath =
  'apps/website/src/component-catalog/shared/ComponentCodeBlock/ComponentCodeBlock.tsx';
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

function copyControl() {
  let control: ts.JsxElement | null = null;

  function visit(node: ts.Node) {
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(sourceFile) === 'Button' &&
      attribute(node, 'className')?.initializer?.getText(sourceFile) ===
        '{styles.copy}'
    ) {
      expect(control).toBeNull();
      control = node;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  expect(control).not.toBeNull();
  return control as unknown as ts.JsxElement;
}

describe('ComponentCodeBlock canonical copy control', () => {
  it('uses the public bare Button without standard Button geometry', () => {
    const control = copyControl();

    expect(
      attribute(control, 'appearance')?.initializer?.getText(sourceFile)
    ).toBe("'bare'");
    expect(attribute(control, 'type')?.initializer?.getText(sourceFile)).toBe(
      "'button'"
    );

    for (const name of ['size', 'shape', 'fullWidth']) {
      expect(attribute(control, name)).toBeUndefined();
    }
  });

  it('has no remaining Vellira UI usage findings or exceptions', () => {
    const report = runVelliraUiUsageCheck();
    const findings = report.findings.filter(({ path }) => path === filePath);
    const exceptions = report.exceptions.filter(
      ({ path }) => path === filePath
    );

    expect(findings).toEqual([]);
    expect(exceptions).toEqual([]);
  });

  it('detects reverting the copy control to an authored native button', () => {
    const control = copyControl();
    const tags = [control.openingElement.tagName, control.closingElement.tagName]
      .sort((left, right) => right.pos - left.pos);
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
