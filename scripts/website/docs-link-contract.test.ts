import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const docsRoot = path.resolve('apps/docs/src');
const websiteRoots = [
  path.resolve('apps/website/src'),
  path.resolve('apps/website/content/blog'),
];

const websiteExtensions = new Set(['.md', '.mdx', '.ts', '.tsx']);
const docsUrlPattern =
  /https:\/\/docs\.vellira\.dev(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*)?/g;

function collectFiles(root: string, predicate: (filePath: string) => boolean) {
  const files: string[] = [];

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath, predicate));
      continue;
    }

    if (entry.isFile() && predicate(entryPath)) {
      files.push(entryPath);
    }
  }

  return files;
}

function routeForMarkdown(filePath: string) {
  const relative = path.relative(docsRoot, filePath).replaceAll('\\', '/');
  const withoutExtension = relative.replace(/\.md$/, '');

  if (withoutExtension === 'index') {
    return '/';
  }

  if (withoutExtension.endsWith('/index')) {
    return `/${withoutExtension.slice(0, -'/index'.length)}/`;
  }

  return `/${withoutExtension}`;
}

function canonicalDocsRoutes() {
  return new Set(
    collectFiles(docsRoot, (filePath) => filePath.endsWith('.md')).map(
      routeForMarkdown
    )
  );
}

describe('public website documentation links', () => {
  it('points static docs.vellira.dev links at real VitePress routes', () => {
    const routes = canonicalDocsRoutes();
    const invalidLinks: Array<{ file: string; url: string }> = [];

    for (const root of websiteRoots) {
      for (const filePath of collectFiles(root, (candidate) =>
        websiteExtensions.has(path.extname(candidate))
      )) {
        const source = fs.readFileSync(filePath, 'utf8');

        for (const match of source.matchAll(docsUrlPattern)) {
          const url = match[0];
          const pathname = new URL(url).pathname;
          const normalized =
            pathname !== '/' && pathname.endsWith('/')
              ? pathname.slice(0, -1)
              : pathname;
          const exists =
            routes.has(pathname) ||
            routes.has(normalized) ||
            routes.has(`${normalized}/`);

          if (!exists) {
            invalidLinks.push({
              file: path.relative(process.cwd(), filePath),
              url,
            });
          }
        }
      }
    }

    expect(invalidLinks).toEqual([]);
  });
});
