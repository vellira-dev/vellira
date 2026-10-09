import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  getComponentMetaDescription,
} from '../../apps/website/src/component-catalog/registry/componentSeo';
import { webComponents } from '../../apps/website/src/component-catalog/registry/components';

const EXTERNAL_AUDIT_MIN_DESCRIPTION_LENGTH = 120;
const MAX_RENDERED_TITLE_LENGTH = 69;

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function frontmatterDescription(source: string) {
  const match = source.match(/^---\n[\s\S]*?^description:\s*(.+)$/m);

  if (!match?.[1]) {
    throw new Error('Expected a one-line frontmatter description.');
  }

  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

describe('external SEO audit regressions', () => {
  it('keeps audited public descriptions above the external audit floor', () => {
    const iconsDescription = frontmatterDescription(
      read('apps/docs/src/icons/index.md')
    );
    const bySlug = new Map(webComponents.map((component) => [component.slug, component]));
    const button = bySlug.get('button');
    const select = bySlug.get('select');

    expect(button).toBeDefined();
    expect(select).toBeDefined();

    const audited = [
      { surface: 'https://docs.vellira.dev/icons/', description: iconsDescription },
      {
        surface: 'https://vellira.dev/components/button',
        description: getComponentMetaDescription(button!),
      },
      {
        surface: 'https://vellira.dev/components/select',
        description: getComponentMetaDescription(select!),
      },
    ];

    expect(
      audited
        .map((item) => ({ ...item, length: item.description.length }))
        .filter((item) => item.length < EXTERNAL_AUDIT_MIN_DESCRIPTION_LENGTH)
    ).toEqual([]);
  });

  it('keeps the two-runtimes rendered title below 70 characters', () => {
    const metadata = JSON.parse(
      read('apps/website/content/blog/two-runtimes/metadata.json')
    ) as { title: string };
    const renderedTitle = `${metadata.title} | Vellira`;

    expect(renderedTitle.length).toBeLessThanOrEqual(MAX_RENDERED_TITLE_LENGTH);
  });

  it('keeps article images on ai-ui-consistency explicitly described', () => {
    const sources = [
      read('apps/website/content/blog/ai-ui-consistency/article.mdx'),
      read('apps/website/src/blog/ui/AiUiConsistencyDiagram.tsx'),
    ];
    const images = sources.flatMap((source) => [
      ...source.matchAll(/<Image\b[\s\S]*?\/>/g),
    ]);

    expect(images.length).toBeGreaterThan(0);

    for (const image of images) {
      expect(image[0]).toMatch(/\balt=(['"])[^'"]+\1/);
    }
  });

  it('permanently redirects the legacy getting-started URL to its canonical route', () => {
    const redirects = read('apps/docs/src/public/_redirects')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(redirects).toContain(
      '/getting-started /start/getting-started 301'
    );
    expect(redirects).toContain(
      '/getting-started/ /start/getting-started 301'
    );
  });
});
