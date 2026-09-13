import ts from 'typescript';

const fixturePath =
  'apps/website/scripts/fixtures/migration/app/navigation.jsx';

// These three controls exercise Next's real dynamic-import and router transport
// in the disposable A/B/C applications built by cloudflare-migration-origin.mjs.
// Importing the design system would change the chunk graph under test. This is
// an infrastructure classification, not a file exclusion: only these exact
// operations qualify; other controls, imports and visual resources are scanned.
const probeHandlers = {
  lazy: "async () => setLazy((await import('./lazy')).value)",
  'lazy-later': "async () => setLater((await import('./lazy-later')).value)",
  refresh: '() => router.refresh()',
} as const;

function syntaxShape(node: ts.Node): unknown {
  const children: unknown[] = [];
  ts.forEachChild(node, (child) => {
    children.push(syntaxShape(child));
  });
  return [
    node.kind,
    ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text : null,
    children,
  ];
}

const handlerShapes = new Map(
  Object.entries(probeHandlers).map(([id, source]) => {
    const parsed = ts.createSourceFile(
      'probe.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    const statement = parsed.statements[0];
    if (!statement || !ts.isExpressionStatement(statement)) {
      throw new Error(`Invalid migration transport probe: ${id}`);
    }
    return [id, JSON.stringify(syntaxShape(statement.expression))];
  })
);

export function isMigrationTransportProbe(
  filePath: string,
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement
): boolean {
  if (filePath !== fixturePath || node.tagName.getText() !== 'button') {
    return false;
  }

  const attributes = node.attributes.properties;
  if (
    attributes.length !== 2 ||
    !attributes.every(
      (attribute) =>
        ts.isJsxAttribute(attribute) &&
        ['id', 'onClick'].includes(attribute.name.getText())
    )
  ) {
    return false;
  }

  const id = attributes.find(
    (attribute) =>
      ts.isJsxAttribute(attribute) && attribute.name.getText() === 'id'
  );
  const handler = attributes.find(
    (attribute) =>
      ts.isJsxAttribute(attribute) && attribute.name.getText() === 'onClick'
  );
  if (
    !id ||
    !ts.isJsxAttribute(id) ||
    !id.initializer ||
    !ts.isStringLiteral(id.initializer) ||
    !handler ||
    !ts.isJsxAttribute(handler) ||
    !handler.initializer ||
    !ts.isJsxExpression(handler.initializer) ||
    !handler.initializer.expression
  ) {
    return false;
  }

  return (
    handlerShapes.get(id.initializer.text) ===
    JSON.stringify(syntaxShape(handler.initializer.expression))
  );
}
