import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { checkSourceFile, runVelliraUiUsageCheck } from './checker';

const filePath = 'apps/website/src/sections/home/Hero/HeroPreview.tsx';
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

function tokenControls() {
  const controls: ts.JsxElement[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isJsxElement(node) &&
      attribute(node, 'className')?.initializer?.getText(sourceFile) ===
        '{styles.tokenButton}'
    ) {
      controls.push(node);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  expect(controls).toHaveLength(3);
  return controls;
}

describe('HeroPreview canonical token controls', () => {
  it('uses public bare Buttons without standard Button geometry', () => {
    for (const control of tokenControls()) {
      expect(control.openingElement.tagName.getText(sourceFile)).toBe('Button');
      expect(
        attribute(control, 'appearance')?.initializer?.getText(sourceFile)
      ).toBe("'bare'");
      expect(
        attribute(control, 'type')?.initializer?.getText(sourceFile)
      ).toBe("'button'");

      for (const name of ['size', 'shape', 'fullWidth']) {
        expect(attribute(control, name)).toBeUndefined();
      }
    }
  });

  it('has no remaining Vellira UI usage findings or exceptions', () => {
    const report = runVelliraUiUsageCheck();
    expect(report.findings.filter(({ path }) => path === filePath)).toEqual([]);
    expect(
      report.exceptions.filter(({ path }) => path === filePath)
    ).toEqual([]);
  });

  it('detects reverting the token controls to authored native buttons', () => {
    const tags = tokenControls()
      .flatMap((control) => [
        control.openingElement.tagName,
        control.closingElement.tagName,
      ])
      .sort((left, right) => right.pos - left.pos);

    const regressed = tags.reduce(
      (text, node) =>
        `${text.slice(0, node.getStart(sourceFile))}button${text.slice(node.end)}`,
      source
    );
    const bypasses = checkSourceFile(filePath, regressed).filter(
      (finding) => finding.ruleId === 'vellira-ui.existing-component-bypass'
    );

    expect(bypasses).toHaveLength(3);
    expect(bypasses.every(({ detected }) => detected === 'button')).toBe(true);
  });
});
