import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { BLOG_DESCRIPTION } from '../../apps/website/src/blog/seo';
import { componentCatalogPresentation } from '../../apps/website/src/component-catalog/registry/componentPresentation';
import {
  COMPONENTS_INDEX_META_DESCRIPTION,
  getComponentMetaDescription,
  MIN_PUBLIC_META_DESCRIPTION_LENGTH,
} from '../../apps/website/src/component-catalog/registry/componentSeo';
import { webComponents } from '../../apps/website/src/component-catalog/registry/components';
import { SITE_DESCRIPTION } from '../../apps/website/src/config/siteSeo';

type PublicDescription = {
  surface: string;
  description: string;
};

function normalizeDescription(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripYamlQuotes(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function frontmatterDescription(source: string): string | null {
  if (!source.startsWith('---\n')) return null;

  const end = source.indexOf('\n---', 4);
  if (end === -1) return null;

  const lines = source.slice(4, end).split(/\r?\n/);
  const descriptionIndex = lines.findIndex((line) =>
    /^description\s*:/.test(line)
  );

  if (descriptionIndex === -1) return null;

  const first =
    lines[descriptionIndex]?.replace(/^description\s*:\s*/, '') ?? '';
  const parts = [first];

  for (let index = descriptionIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    if (/^[A-Za-z][A-Za-z0-9_-]*\s*:/.test(line)) break;
    if (!/^\s+\S/.test(line)) break;

    parts.push(line.trim());
  }

  const value = normalizeDescription(parts.join(' '));

  if (value === '|' || value === '>') return null;

  return stripYamlQuotes(value);
}

function collectMarkdownFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectMarkdownFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : [];
  });
}

function collectDocsDescriptions(root: string): PublicDescription[] {
  const docsRoot = path.join(root, 'apps', 'docs', 'src');

  return collectMarkdownFiles(docsRoot).map((filePath) => {
    const surface = path.relative(docsRoot, filePath).replace(/\\/g, '/');
    const description = frontmatterDescription(
      fs.readFileSync(filePath, 'utf8')
    );

    if (!description) {
      throw new Error(
        `Missing or unsupported docs meta description for ${surface}`
      );
    }

    return {
      surface,
      description,
    };
  });
}

function collectBlogDescriptions(root: string): PublicDescription[] {
  const blogRoot = path.join(root, 'apps', 'website', 'content', 'blog');

  if (!fs.existsSync(blogRoot)) return [];

  return fs
    .readdirSync(blogRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const metadataFile = path.join(blogRoot, entry.name, 'metadata.json');

      if (!fs.existsSync(metadataFile)) return [];

      const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8')) as {
        slug?: string;
        description?: string;
        draft?: boolean;
      };

      if (
        metadata.draft ||
        typeof metadata.slug !== 'string' ||
        typeof metadata.description !== 'string'
      ) {
        return [];
      }

      return [
        {
          surface: `/blog/${metadata.slug}`,
          description: normalizeDescription(metadata.description),
        },
      ];
    });
}

function getAdoptedDiscoveryDescriptions(root: string) {
  const componentPagesSource = fs.readFileSync(
    path.join(
      root,
      'apps',
      'website',
      'src',
      'component-catalog',
      'registry',
      'componentPages.ts'
    ),
    'utf8'
  );
  const entries = [
    ...componentPagesSource.matchAll(
      /\n {2}(?:([A-Za-z_$][\w$-]*)|'([^']+)'): \{([\s\S]*?)(?=\n {2}(?:[A-Za-z_$][\w$-]*|'[^']+'): \{|\n} satisfies)/g
    ),
  ];

  return entries.flatMap((entry) => {
    const slug = entry[1] ?? entry[2];
    const source = entry[3] ?? '';

    if (!source.includes('discovery:')) return [];

    const match = source.match(
      /discovery:\s*\{[\s\S]*?description:\s*(?:\n\s*)?(['"])((?:\\.|(?!\1)[\s\S])*?)\1/
    );

    if (!slug || !match?.[2]) {
      throw new Error(
        `Unable to parse adopted discovery description for ${slug ?? 'unknown component'}`
      );
    }

    return [
      {
        slug,
        description: normalizeDescription(
          match[2].replace(/\\(['"\\])/g, '$1')
        ),
      },
    ];
  });
}

function getDiscoveryPresentationDrift(
  adopted: readonly { slug: string; description: string }[],
  presentation: readonly { slug: string; description: string }[]
) {
  const bySlug = new Map(
    presentation.map((item) => [
      item.slug,
      normalizeDescription(item.description),
    ])
  );

  return adopted.flatMap((item) => {
    const actual = bySlug.get(item.slug);

    return actual === item.description
      ? []
      : [
          {
            slug: item.slug,
            expected: item.description,
            actual: actual ?? null,
          },
        ];
  });
}

function publicDescriptions(): PublicDescription[] {
  const root = process.cwd();

  return [
    {
      surface: '/',
      description: SITE_DESCRIPTION,
    },
    {
      surface: '/components',
      description: COMPONENTS_INDEX_META_DESCRIPTION,
    },
    {
      surface: '/blog',
      description: BLOG_DESCRIPTION,
    },
    ...webComponents.map((component) => ({
      surface: `/components/${component.slug}`,
      description: getComponentMetaDescription(component),
    })),
    ...collectDocsDescriptions(root),
    ...collectBlogDescriptions(root),
  ];
}

describe('public meta-description quality', () => {
  it('keeps public descriptions above the bounded quality floor', () => {
    const short = publicDescriptions()
      .map((item) => ({
        ...item,
        length: normalizeDescription(item.description).length,
      }))
      .filter((item) => item.length < MIN_PUBLIC_META_DESCRIPTION_LENGTH);

    expect(short).toEqual([]);
  });

  it('keeps public descriptions unique across audited search surfaces', () => {
    const descriptions = publicDescriptions();
    const byDescription = new Map<string, string[]>();

    for (const item of descriptions) {
      const key = normalizeDescription(item.description).toLowerCase();
      const surfaces = byDescription.get(key) ?? [];

      surfaces.push(item.surface);
      byDescription.set(key, surfaces);
    }

    const duplicates = [...byDescription.entries()]
      .filter(([, surfaces]) => surfaces.length > 1)
      .map(([description, surfaces]) => ({ description, surfaces }));

    expect(duplicates).toEqual([]);
  });

  it('keeps adopted discovery descriptions aligned by exact component slug', () => {
    const adopted = getAdoptedDiscoveryDescriptions(process.cwd());

    expect(adopted.length).toBeGreaterThan(0);
    expect(
      getDiscoveryPresentationDrift(adopted, componentCatalogPresentation)
    ).toEqual([]);
  });

  it('fails closed when an indexable docs page has no parseable description', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-seo-docs-'));
    const docsRoot = path.join(root, 'apps', 'docs', 'src');

    try {
      fs.mkdirSync(docsRoot, { recursive: true });
      fs.writeFileSync(
        path.join(docsRoot, 'missing-description.md'),
        '---\ntitle: Missing description\n---\n\n# Missing description\n'
      );

      expect(() => collectDocsDescriptions(root)).toThrow(
        'Missing or unsupported docs meta description for missing-description.md'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed for unsupported multiline docs descriptions', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-seo-docs-'));
    const docsRoot = path.join(root, 'apps', 'docs', 'src');

    try {
      fs.mkdirSync(docsRoot, { recursive: true });
      fs.writeFileSync(
        path.join(docsRoot, 'multiline-description.md'),
        '---\ntitle: Multiline description\ndescription: |\n  This parser must not silently skip unsupported YAML.\n---\n'
      );

      expect(() => collectDocsDescriptions(root)).toThrow(
        'Missing or unsupported docs meta description for multiline-description.md'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('detects swapped discovery descriptions even when both values still exist', () => {
    const adopted = [
      { slug: 'checkbox', description: 'Checkbox canonical description.' },
      { slug: 'textarea', description: 'Textarea canonical description.' },
    ];
    const swapped = [
      { slug: 'checkbox', description: 'Textarea canonical description.' },
      { slug: 'textarea', description: 'Checkbox canonical description.' },
    ];

    expect(getDiscoveryPresentationDrift(adopted, swapped)).toEqual([
      {
        slug: 'checkbox',
        expected: 'Checkbox canonical description.',
        actual: 'Textarea canonical description.',
      },
      {
        slug: 'textarea',
        expected: 'Textarea canonical description.',
        actual: 'Checkbox canonical description.',
      },
    ]);
  });

  it('does not expose the old generic generator placeholder as effective metadata', () => {
    for (const component of webComponents) {
      expect(getComponentMetaDescription(component)).not.toMatch(
        /^[A-Za-z0-9]+ component for Vellira applications\.$/
      );
    }
  });
});
