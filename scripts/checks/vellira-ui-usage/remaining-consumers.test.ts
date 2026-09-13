import { readFileSync } from 'node:fs';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { checkSourceFile } from './checker';

const catalog = 'apps/website/src/component-catalog/shared';
const header = 'apps/website/src/components/layout/SiteHeader';
const consumers = [
  [
    `${catalog}/ComponentHeaderActions/ComponentHeaderActions.tsx`,
    ['platformButton'],
  ],
  [`${catalog}/ComponentsCatalog/ComponentCatalogPreview.tsx`, ['modalClose']],
  [
    `${catalog}/ComponentsCatalog/ComponentsCatalog.tsx`,
    ['searchInput', 'clearSearch', 'filter'],
  ],
  [
    `${catalog}/PlaygroundControls/PlaygroundControls.tsx`,
    ['control', 'textInput'],
  ],
  [
    `${header}/HeaderSearch/HeaderSearch.tsx`,
    ['mobileTrigger', 'input', 'mobileClose', 'clear'],
  ],
  [`${header}/SiteHeader.tsx`, ['mobileNavigationBackdrop']],
] as const;

describe.each(consumers)('%s canonical controls', (filePath, classes) => {
  const source = readFileSync(filePath, 'utf8');
  const parsed = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const controls: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = [];
  const attribute = (
    node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
    name: string
  ) =>
    node.attributes.properties.find(
      (property): property is ts.JsxAttribute =>
        ts.isJsxAttribute(property) && property.name.getText(parsed) === name
    );
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const className =
        attribute(node, 'className')?.initializer?.getText(parsed) ?? '';
      if (
        classes.some((name) =>
          new RegExp(`\\bstyles\\.${name}\\b`).test(className)
        )
      ) {
        controls.push(node);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);

  it('uses public bare components and preserves native control semantics', () => {
    expect(controls.length).toBeGreaterThanOrEqual(classes.length);
    for (const control of controls) {
      const tag = control.tagName.getText(parsed);
      expect(['Button', 'Input']).toContain(tag);
      const imports = parsed.statements
        .filter(ts.isImportDeclaration)
        .filter(
          (node) =>
            ts.isStringLiteral(node.moduleSpecifier) &&
            node.moduleSpecifier.text === '@vellira-ui/react'
        );
      expect(
        imports.some((node) => {
          const bindings = node.importClause?.namedBindings;
          return (
            bindings &&
            ts.isNamedImports(bindings) &&
            bindings.elements.some(
              (element) =>
                element.name.text === tag &&
                (element.propertyName ?? element.name).text === tag
            )
          );
        })
      ).toBe(true);
      expect(
        attribute(
          control,
          tag === 'Button' ? 'appearance' : 'variant'
        )?.initializer?.getText(parsed)
      ).toBe("'bare'");
      expect(attribute(control, 'type')).toBeDefined();
      for (const name of ['size', 'shape', 'fullWidth']) {
        expect(attribute(control, name)).toBeUndefined();
      }
      if (tag === 'Input') {
        expect(attribute(control, 'onValueChange')).toBeDefined();
        expect(attribute(control, 'onChange')).toBeUndefined();
      }
    }
    expect(checkSourceFile(filePath, source)).toEqual([]);
  });

  it('detects reverting every migrated control individually', () => {
    for (const control of controls) {
      const nativeTag = control.tagName.getText(parsed).toLowerCase();
      const tags = [control.tagName];
      if (ts.isJsxOpeningElement(control) && ts.isJsxElement(control.parent)) {
        tags.push(control.parent.closingElement.tagName);
      }
      const regressed = tags
        .sort((a, b) => b.pos - a.pos)
        .reduce(
          (text, tag) =>
            text.slice(0, tag.getStart(parsed)) +
            nativeTag +
            text.slice(tag.end),
          source
        );
      expect(
        checkSourceFile(filePath, regressed).filter(
          ({ ruleId }) => ruleId === 'vellira-ui.existing-component-bypass'
        )
      ).toEqual([expect.objectContaining({ detected: nativeTag })]);
    }
  });
});
