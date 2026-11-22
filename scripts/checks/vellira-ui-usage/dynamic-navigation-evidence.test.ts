import { readFileSync } from 'node:fs';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = new URL('../../../apps/website/src/', import.meta.url);

function sourceOf(relativePath: string): string {
  return readFileSync(new URL(relativePath, root), 'utf8');
}

function parse(source: string): ts.SourceFile {
  return ts.createSourceFile(
    'fixture.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
}

function literalConstant(source: string, name: string): string | null {
  const ast = parse(source);
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === name &&
        declaration.initializer &&
        ts.isStringLiteral(declaration.initializer)
      ) {
        return declaration.initializer.text;
      }
    }
  }
  return null;
}

function anchorAttributes(source: string) {
  const ast = parse(source);
  const anchors: Array<{ href: string; target: string; rel: string }> = [];
  function visit(node: ts.Node): void {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(ast) === 'a'
    ) {
      const attribute = (name: string): string =>
        node.attributes.properties
          .filter(ts.isJsxAttribute)
          .find((item) => item.name.getText(ast) === name)
          ?.initializer?.getText(ast) ?? '';
      anchors.push({
        href: attribute('href'),
        target: attribute('target'),
        rel: attribute('rel'),
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return anchors;
}

function compact(expression: string): string {
  return expression.replace(/\s+/g, '');
}

function validReleaseSource(source: string): boolean {
  const href = anchorAttributes(source).find((item) =>
    item.href.includes('release.version')
  );
  if (!href) return false;
  return (
    compact(href.href) ===
      compact(
        "{release ? `https://github.com/vellira-dev/vellira/releases/tag/v${release.version}` : 'https://github.com/vellira-dev/vellira/releases'}"
      ) &&
    href.target === "'_blank'" &&
    href.rel === "'noreferrer'"
  );
}

function validDemoSource(source: string): boolean {
  const repository = literalConstant(source, 'repository');
  const sourceRef = literalConstant(source, 'sourceRef');
  const hrefs = anchorAttributes(source);
  const viewSource = hrefs.find((item) =>
    item.href.includes('nativeSourceUrl')
  );
  const starter = hrefs.find((item) => item.href === '{starterUrl}');
  return (
    repository === 'https://github.com/vellira-dev/vellira' &&
    sourceRef === 'main' &&
    compact(viewSource?.href ?? '') ===
      "{preview==='mobile'?nativeSourceUrl:sourceUrl}" &&
    viewSource?.target === "'_blank'" &&
    viewSource.rel === "'noopener noreferrer'" &&
    starter?.target === "'_blank'" &&
    starter.rel === "'noopener noreferrer'" &&
    source.includes("'/examples/workspace-starter/web/src/Dashboard.tsx'") &&
    source.includes("'/examples/workspace-starter/native/App.tsx'") &&
    source.includes("'/examples/workspace-starter'")
  );
}

function validCodeShowcaseSources(source: string): boolean {
  const compactSource = compact(source);
  const expectedStorybook = {
    button: 'primitives-button',
    input: 'primitives-input',
    modal: 'components-modal',
    dropdown: 'components-dropdown',
  } as const;
  const docs = anchorAttributes(source).find(
    (item) => item.href === '{getDocsLink(platform, activeExample)}'
  );
  const storybook = anchorAttributes(source).find(
    (item) => item.href === '{storybookLinks[activeExample]}'
  );
  const safeExternal = (anchor: (typeof docs) | undefined) =>
    anchor?.target === "'_blank'" &&
    anchor.rel === "'noreferrer noopener'";

  return (
    compactSource.includes(compact("type Platform = 'react' | 'native';")) &&
    compactSource.includes(
      compact("type ExampleName = 'button' | 'input' | 'modal' | 'dropdown';")
    ) &&
    compactSource.includes(
      compact(
        "const docsPlatform = platform === 'react' ? 'react' : 'react-native';"
      )
    ) &&
    compactSource.includes(
      compact('return `https://docs.vellira.dev/${docsPlatform}/${example}`;')
    ) &&
    Object.entries(expectedStorybook).every(([example, slug]) =>
      compactSource.includes(
        compact(
          `${example}: 'https://storybook.vellira.dev/?path=/docs/${slug}--docs'`
        )
      )
    ) &&
    safeExternal(docs) &&
    safeExternal(storybook)
  );
}

function validCanonicalLinkSource(source: string): boolean {
  return (
    source.includes('if (!href) return <>{children}</>;') &&
    source.includes("const internal = href.startsWith('/');") &&
    source.includes(
      '<NextLink href={href} prefetch={prefetch} target={target} rel={rel}>'
    ) &&
    source.includes('href={href}')
  );
}

describe('dynamic website navigation evidence (source contracts)', () => {
  it('keeps release URL in the fixed GitHub releases namespace', () => {
    const source = sourceOf('sections/home/Roadmap/Roadmap.tsx');
    expect(validReleaseSource(source)).toBe(true);
    expect(
      validReleaseSource(
        source.replace(
          'https://github.com/vellira-dev/vellira/releases/tag/v',
          'https://example.invalid/releases/tag/v'
        )
      )
    ).toBe(false);
    const releaseLinkWithoutRel = source.replace(
      /rel='noreferrer'(\s*>\s*Read changelog)/,
      "rel='unsafe'$1"
    );
    expect(releaseLinkWithoutRel).not.toBe(source);
    expect(validReleaseSource(releaseLinkWithoutRel)).toBe(false);
  });

  it('uses fixed canonical source destinations for both preview modes', () => {
    const source = sourceOf(
      'sections/home/ProductInterfaceDemo/ProductInterfaceDemo.tsx'
    );
    expect(validDemoSource(source)).toBe(true);
    expect(
      validDemoSource(
        source.replace(
          "const sourceRef = 'main'",
          'const sourceRef = externalRef'
        )
      )
    ).toBe(false);
    expect(
      validDemoSource(
        source.replace(
          "const repository = 'https://github.com/vellira-dev/vellira'",
          "const repository = 'https://example.invalid/fork'"
        )
      )
    ).toBe(false);
    expect(
      validDemoSource(
        source.replace(
          "preview === 'mobile' ? nativeSourceUrl : sourceUrl",
          "preview === 'mobile' ? sourceUrl : nativeSourceUrl"
        )
      )
    ).toBe(false);
  });

  it('keeps CodeShowcase docs and Storybook destinations bounded', () => {
    const source = sourceOf('sections/home/CodeShowcase/CodeShowcase.tsx');
    expect(validCodeShowcaseSources(source)).toBe(true);
    expect(
      validCodeShowcaseSources(
        source.replace('https://docs.vellira.dev/', 'https://evil.invalid/')
      )
    ).toBe(false);
    expect(
      validCodeShowcaseSources(
        source.replace(
          'https://storybook.vellira.dev/?path=/docs/',
          'https://evil.invalid/?path=/docs/'
        )
      )
    ).toBe(false);
    expect(
      validCodeShowcaseSources(
        source.replace(
          'href={storybookLinks[activeExample]}',
          'href={untrustedDestination}'
        )
      )
    ).toBe(false);
    expect(
      validCodeShowcaseSources(
        source.replace(
          "rel='noreferrer noopener'\n              >\n                Docs",
          "rel='unsafe'\n              >\n                Docs"
        )
      )
    ).toBe(false);
  });

  it('keeps canonical link fail-closed for missing href and routes internal links', () => {
    const source = sourceOf('components/navigation/DesignSystemLink.tsx');
    expect(validCanonicalLinkSource(source)).toBe(true);
    expect(
      validCanonicalLinkSource(
        source.replace('if (!href) return <>{children}</>;', '')
      )
    ).toBe(false);
    expect(
      validCanonicalLinkSource(
        source.replace("const internal = href.startsWith('/');", '')
      )
    ).toBe(false);
    expect(
      validCanonicalLinkSource(
        source.replace(
          '<NextLink href={href} prefetch={prefetch} target={target} rel={rel}>',
          '<NextLink href={href}>'
        )
      )
    ).toBe(false);
  });
});
