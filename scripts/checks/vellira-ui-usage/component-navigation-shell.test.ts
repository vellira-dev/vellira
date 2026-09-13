import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { checkSourceFile, runVelliraUiUsageCheck } from './checker';

const filePath =
  'apps/website/src/component-catalog/shared/ComponentNavigationShell/ComponentNavigationShell.tsx';
const source = readFileSync(resolve(process.cwd(), filePath), 'utf8');
const sourceFile = ts.createSourceFile(
  filePath,
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

type NavigationControl = ts.JsxElement | ts.JsxSelfClosingElement;

function openingElement(control: NavigationControl) {
  return ts.isJsxElement(control) ? control.openingElement : control;
}

function attribute(control: NavigationControl, name: string) {
  return openingElement(control).attributes.properties.find(
    (prop): prop is ts.JsxAttribute =>
      ts.isJsxAttribute(prop) && prop.name.getText(sourceFile) === name
  );
}

function navigationControls() {
  const controls: NavigationControl[] = [];
  const targetClasses = new Set([
    '{styles.backdrop}',
    '{styles.mainNavigationButton}',
  ]);

  function visit(node: ts.Node) {
    if (
      (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
      targetClasses.has(
        attribute(node, 'className')?.initializer?.getText(sourceFile) ?? ''
      )
    ) {
      controls.push(node);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  expect(controls).toHaveLength(2);
  return controls;
}

describe('ComponentNavigationShell canonical controls', () => {
  it('uses public bare Buttons without standard Button geometry', () => {
    for (const control of navigationControls()) {
      const opening = openingElement(control);
      const appearance = attribute(control, 'appearance');
      const type = attribute(control, 'type');

      expect(opening.tagName.getText(sourceFile)).toBe('Button');
      expect(appearance?.initializer?.getText(sourceFile)).toBe("'bare'");
      expect(type?.initializer?.getText(sourceFile)).toBe("'button'");

      for (const name of ['size', 'shape', 'fullWidth']) {
        expect(attribute(control, name)).toBeUndefined();
      }
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

  it('detects reverting the navigation controls to authored buttons', () => {
    const tags = navigationControls()
      .flatMap((control) =>
        ts.isJsxElement(control)
          ? [control.openingElement.tagName, control.closingElement.tagName]
          : [control.tagName]
      )
      .sort((left, right) => right.pos - left.pos);

    const regressed = tags.reduce(
      (text, node) =>
        `${text.slice(0, node.getStart(sourceFile))}button${text.slice(node.end)}`,
      source
    );
    const bypasses = checkSourceFile(filePath, regressed).filter(
      (finding) => finding.ruleId === 'vellira-ui.existing-component-bypass'
    );

    expect(bypasses).toHaveLength(2);
    expect(bypasses.every(({ detected }) => detected === 'button')).toBe(true);
  });
});
