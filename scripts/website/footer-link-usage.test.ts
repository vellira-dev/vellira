import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const compactPath =
  'apps/website/src/components/layout/CompactFooter/CompactFooter.tsx';
const sitePath = 'apps/website/src/components/layout/SiteFooter/SiteFooter.tsx';
const compactCssPath =
  'apps/website/src/components/layout/CompactFooter/CompactFooter.module.css';
const read = (file: string) => readFileSync(resolve(file), 'utf8');

function noncanonicalNavigationTags(source: string): string[] {
  const file = ts.createSourceFile(
    'Footer.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const nextLinkImports = new Set<string>();

  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== 'next/link'
    ) {
      continue;
    }
    const clause = statement.importClause;
    if (clause?.name) nextLinkImports.add(clause.name.text);
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const specifier of clause.namedBindings.elements) {
        if (
          (specifier.propertyName?.text ?? specifier.name.text) === 'default'
        ) {
          nextLinkImports.add(specifier.name.text);
        }
      }
    }
  }

  const violations: string[] = [];
  const visit = (node: ts.Node, withinNav: boolean) => {
    const jsx = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : null;
    const inNavigation =
      withinNav || (jsx !== null && jsx.tagName.getText(file) === 'nav');
    if (jsx !== null) {
      const name = jsx.tagName.getText(file);
      if (inNavigation && (name === 'a' || nextLinkImports.has(name))) {
        violations.push(name);
      }
    }
    ts.forEachChild(node, (child) => visit(child, inNavigation));
  };
  visit(file, false);
  return violations;
}

describe('website footer canonical textual links (#1506)', () => {
  it('uses the shared Vellira link component in both footer navigations', () => {
    for (const source of [read(compactPath), read(sitePath)]) {
      expect(source).toContain("from '@/components/navigation/DesignSystemLink'");
      expect(noncanonicalNavigationTags(source)).toEqual([]);
      expect(source).toContain("appearance='bare'");
    }
  });

  it('preserves external destinations and opt-in tab semantics', () => {
    const compact = read(compactPath);
    const site = read(sitePath);

    for (const href of [
      'https://docs.vellira.dev',
      'https://storybook.vellira.dev',
      'https://github.com/vellira-dev/vellira',
    ]) {
      expect(compact).toContain(href);
    }
    expect(compact).not.toContain("from 'next/link'");

    expect(site).toContain("target='_blank'");
    expect(site).toContain("rel='noreferrer noopener'");
    expect(site).toContain(
      "prefetch={link.href.startsWith('/#') ? false : undefined}"
    );
    expect(site).toMatch(/<Link\s+className=\{styles\.brand\}/);
    expect((site.match(/<Link\b/g) ?? [])).toHaveLength(1);
    expect(site).toContain('https://github.com/vellira-dev/vellira');
    expect(site).toContain('<ArrowRight size={13}');
  });

  it('allows the compact footer navigation to wrap on narrow viewports', () => {
    const css = read(compactCssPath);
    expect(css).toMatch(
      /@media \(width <= 640px\)\s*\{[\s\S]*?\.navigation\s*\{\s*flex-wrap: wrap;/
    );
    expect(css).toContain('row-gap: var(--space-3);');
  });

  it('rejects raw and aliased Next links inside textual footer navigation', () => {
    expect(
      noncanonicalNavigationTags(
        "import X from 'next/link'; export const Footer = () => " +
          "<footer><nav><a href='/privacy'>Privacy</a><X href='/'>Home</X></nav></footer>;"
      )
    ).toEqual(['a', 'X']);
    expect(
      noncanonicalNavigationTags(
        "import { default as LocalLink } from 'next/link'; " +
          "const Footer = () => <nav><LocalLink href='/'>Home</LocalLink></nav>;"
      )
    ).toEqual(['LocalLink']);
    expect(
      noncanonicalNavigationTags(
        "import Raw from 'next/link'; const Footer = () => " +
          "<nav><Raw href='/blog' /></nav>;"
      )
    ).toEqual(['Raw']);
  });

  it('keeps structural brand anchors outside navigation exempt', () => {
    expect(
      noncanonicalNavigationTags(
        "import Link from 'next/link'; export const Footer = () => " +
          "<footer><Link href='/' aria-label='Vellira home'>Logo</Link>" +
          "<nav><DesignSystemLink href='/privacy'>Privacy</DesignSystemLink></nav></footer>;"
      )
    ).toEqual([]);
  });
});
