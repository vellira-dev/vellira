import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { syncBrand } from '../../packages/assets/scripts/sync-brand.mjs';
const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const brands = [
  'GitHub',
  'Facebook',
  'LinkedIn',
  'Reddit',
  'X',
  'Storybook',
  'Google',
  'Apple',
];
describe('external artwork ownership', () => {
  it('preserves official artwork bytes outside the web/native icon generator', () => {
    const expected = {
      'google-light':
        '6587b180203a99da15c0a041018e15c94ffd9556c4b9855bdc69806081a93791',
      'google-dark':
        '2f7ecc307b1db0f1738456269ee2c4433b3a73c35060ced67a9afcfc6821e786',
      'apple-black':
        '7ee1bc1706bc228f37a937de914e2ebe1605aebba3c35f11c3963087573fc11f',
      'apple-white':
        'fd66b19f3f09ade3650cc3289a744ee9636764068243805d9c74deeecbde191b',
    };
    for (const [name, digest] of Object.entries(expected)) {
      expect(
        createHash('sha256')
          .update(read(`apps/website/brand/auth/${name}.svg`))
          .digest('hex')
      ).toBe(digest);
    }
    const sources = execFileSync('git', ['ls-files', 'packages/icons/svg'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(sources).not.toMatch(/Google|Apple/);
  });
  it('retains released legacy exports while website consumers stop importing them', () => {
    for (const platform of ['web', 'native']) {
      const source = ts.createSourceFile(
        'exports.ts',
        read(`packages/icons/src/${platform}.source.ts`),
        ts.ScriptTarget.Latest,
        true
      );
      const names = source.statements
        .filter(ts.isExportDeclaration)
        .flatMap((n) =>
          n.exportClause && ts.isNamedExports(n.exportClause)
            ? n.exportClause.elements.map((e) => e.name.text)
            : []
        );
      for (const brand of brands.slice(0, 6)) expect(names).toContain(brand);
      expect(names).toContain('DocsVellira');
    }
    const paths = execFileSync('git', ['ls-files', 'apps/website/src'], {
      cwd: root,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter((p) => /\.[jt]sx?$/.test(p));
    for (const path of paths) {
      const source = ts.createSourceFile(
        path,
        read(path),
        ts.ScriptTarget.Latest,
        true
      );
      for (const statement of source.statements) {
        if (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteral(statement.moduleSpecifier) ||
          !statement.moduleSpecifier.text.startsWith('@vellira-ui/icons')
        )
          continue;
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings))
          for (const element of bindings.elements)
            expect(brands, path).not.toContain(
              (element.propertyName ?? element.name).text
            );
      }
    }
  });
  it('keeps migration copies identical to legacy glyphs and one GitHub website source', () => {
    for (const brand of ['GitHub', 'Facebook', 'LinkedIn', 'Reddit', 'X']) {
      expect(
        read(
          `apps/website/brand/${brand === 'GitHub' ? 'auth' : 'social'}/${brand.toLowerCase()}.svg`
        )
      ).toBe(read(`packages/icons/svg/Brand/${brand}.svg`));
    }
  });
  it('composes local and shared artwork without altering bytes and clears stale output', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'vellira-brand-'));
    try {
      const destination = join(temp, 'public');
      await mkdir(destination);
      await writeFile(join(destination, 'stale.svg'), 'old');
      await syncBrand({
        source: join(root, 'packages/assets/brand'),
        overlay: join(root, 'apps/website/brand'),
        destination,
      });
      expect(
        await readFile(join(destination, 'auth/google-dark.svg'), 'utf8')
      ).toBe(read('apps/website/brand/auth/google-dark.svg'));
      expect(
        await readFile(join(destination, 'icons/favicon.svg'), 'utf8')
      ).toBe(read('packages/assets/brand/icons/favicon.svg'));
      await expect(readFile(join(destination, 'stale.svg'))).rejects.toThrow();
      const overlay = join(temp, 'collision');
      await mkdir(join(overlay, 'icons'), { recursive: true });
      await writeFile(join(overlay, 'icons/favicon.svg'), 'replace');
      await expect(
        syncBrand({
          source: join(root, 'packages/assets/brand'),
          overlay,
          destination,
        })
      ).rejects.toThrow('Conflicting brand ownership');
      expect(
        await readFile(join(destination, 'icons/favicon.svg'), 'utf8')
      ).toBe(read('packages/assets/brand/icons/favicon.svg'));
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
});
