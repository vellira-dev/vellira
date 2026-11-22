import { readFileSync } from 'node:fs';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function openings(relativePath: string, tagName: string) {
  const source = readFileSync(
    new URL('../../../apps/website/src/' + relativePath, import.meta.url),
    'utf8'
  );
  const ast = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const matches: ts.JsxOpeningLikeElement[] = [];
  function visit(node: ts.Node): void {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(ast) === tagName
    )
      matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return { ast, matches };
}

function attribute(node: ts.JsxOpeningLikeElement, name: string) {
  return node.attributes.properties.find(
    (item) =>
      ts.isJsxAttribute(item) &&
      ts.isIdentifier(item.name) &&
      item.name.text === name
  );
}

describe('website structural navigation contracts (source evidence)', () => {
  it('preserves active location and drawer close callback for catalog navigation', () => {
    const { ast, matches } = openings(
      'component-catalog/shared/ComponentSidebar/ComponentSidebar.tsx',
      'Link'
    );
    expect(matches).toHaveLength(1);
    const [link] = matches;
    expect(attribute(link, 'href')?.getText(ast)).toContain(
      'workspaceContextRequested'
    );
    expect(attribute(link, 'aria-current')?.getText(ast)).toContain(
      'activeSlug'
    );
    expect(attribute(link, 'onClick')?.getText(ast)).toContain('onNavigate');
  });

  it('preserves active state and intercepted components navigation in AppShell', () => {
    const { ast, matches } = openings('product-app/AppShell.tsx', 'Link');
    const overview = matches.find((link) =>
      attribute(link, 'href')?.getText(ast).includes("'/app'")
    );
    const components = matches.find((link) =>
      attribute(link, 'href')?.getText(ast).includes("'/components?from=app'")
    );
    expect(overview).toBeDefined();
    expect(components).toBeDefined();
    expect(attribute(overview!, 'aria-current')).toBeDefined();
    expect(attribute(overview!, 'onClick')).toBeDefined();
    expect(attribute(components!, 'aria-current')).toBeDefined();
    expect(attribute(components!, 'onClick')?.getText(ast)).toContain(
      'event.preventDefault()'
    );
    expect(attribute(components!, 'onClick')?.getText(ast)).toContain(
      'onComponentsSwitch'
    );
  });

  it('bounds OAuth callback failure navigation to recovery routes', () => {
    const { ast, matches } = openings('product-app/AuthFlows.tsx', 'Link');
    const recoveryLinks = matches.filter((link) =>
      attribute(link, 'href')?.getText(ast).includes('failure.')
    );
    expect(
      recoveryLinks.map((link) => attribute(link, 'href')?.getText(ast))
    ).toEqual(['href={failure.primary.href}', 'href={failure.secondary.href}']);

    const failureFactory = ast.statements.find(
      (node) =>
        ts.isFunctionDeclaration(node) &&
        node.name?.text === 'getOAuthCallbackFailure'
    );
    expect(failureFactory).toBeDefined();
    const destinations: string[] = [];
    function visit(node: ts.Node): void {
      if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'href') {
        expect(ts.isStringLiteral(node.initializer)).toBe(true);
        if (ts.isStringLiteral(node.initializer)) {
          destinations.push(node.initializer.text);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(failureFactory!);
    expect(destinations).toHaveLength(9);
    expect([...new Set(destinations)].sort()).toEqual([
      '/forgot-password',
      '/login',
    ]);
    const source = readFileSync(
      new URL(
        '../../../apps/website/src/product-app/AuthFlows.tsx',
        import.meta.url
      ),
      'utf8'
    );
    expect(source.match(/href: connectionHref\(connection\)/g)).toHaveLength(2);
    const connectionSource = readFileSync(
      new URL(
        '../../../apps/website/src/product-app/oauthConnection.ts',
        import.meta.url
      ),
      'utf8'
    );
    expect(connectionSource).toContain('if (!isOAuthConnection(connection))');
    expect(connectionSource).toContain(
      "return '/auth/connect?' + connectionQuery(connection);"
    );
  });

  it('keeps external workspace navigation protected and drawer-aware', () => {
    const { ast, matches } = openings('product-app/AppShell.tsx', 'a');
    const docs = matches.find((link) =>
      attribute(link, 'href')?.getText(ast).includes('docs.vellira.dev')
    );
    expect(docs).toBeDefined();
    expect(attribute(docs!, 'target')?.getText(ast)).toContain('_blank');
    expect(attribute(docs!, 'rel')?.getText(ast)).toContain(
      'noopener noreferrer'
    );
    expect(attribute(docs!, 'onClick')?.getText(ast)).toContain('onNavigate');
  });
});
