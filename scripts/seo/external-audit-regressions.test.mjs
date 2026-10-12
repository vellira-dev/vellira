import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

function oneLineFrontmatterDescription(source) {
  const match = source.match(/^---\n[\s\S]*?^description:\s*(.+)$/m);
  assert.ok(match?.[1], 'expected one-line frontmatter description');
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

function presentationDescription(source, slug) {
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(
    new RegExp(
      `slug: ['"]${escaped}['"][\\s\\S]*?description:\\s*\\n?\\s*['"]([^'"]+)['"]`
    )
  );
  assert.ok(match?.[1], `missing presentation description for ${slug}`);
  return match[1];
}

test('external audit descriptions stay in the intended SEO range', async () => {
  const [presentation, icons] = await Promise.all([
    read('apps/website/src/component-catalog/registry/componentPresentation.ts'),
    read('apps/docs/src/icons/index.md'),
  ]);

  const descriptions = [
    presentationDescription(presentation, 'button'),
    presentationDescription(presentation, 'select'),
    oneLineFrontmatterDescription(icons),
  ];

  for (const description of descriptions) {
    assert.ok(
      description.length >= 120 && description.length <= 160,
      `description length out of audit range: ${description.length}`
    );
  }
});

test('two-runtimes rendered title stays below 70 characters', async () => {
  const metadata = JSON.parse(
    await read('apps/website/content/blog/two-runtimes/metadata.json')
  );
  assert.ok(typeof metadata.title === 'string');
  assert.ok(`${metadata.title} | Vellira`.length < 70);
});

test('ai-ui-consistency article images have explicit non-empty alt text', async () => {
  const sources = await Promise.all([
    read('apps/website/content/blog/ai-ui-consistency/article.mdx'),
    read('apps/website/src/blog/ui/AiUiConsistencyDiagram.tsx'),
  ]);
  const images = sources.flatMap((source) => [
    ...source.matchAll(/<Image\b[\s\S]*?\/>/g),
  ]);

  assert.ok(images.length > 0);
  for (const image of images) {
    assert.match(image[0], /\balt=(['"])[^'"]+\1/);
  }
});

test('legacy getting-started routes permanently redirect to canonical docs', async () => {
  const redirects = (await read('apps/docs/src/public/_redirects'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  assert.ok(redirects.includes('/getting-started /start/getting-started 301'));
  assert.ok(
    redirects.includes('/getting-started/ /start/getting-started 301')
  );
});


test('Search Console legacy docs URLs have unique permanent same-origin redirects', async () => {
  const source = await read('apps/docs/src/public/_redirects');
  const routes = source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  const entries = routes.map((line) => {
    const parts = line.split(/\s+/);
    assert.equal(parts.length, 3, `invalid redirect: ${line}`);
    assert.equal(parts[2], '301');
    assert.ok(parts[0].startsWith('/') && parts[1].startsWith('/'));
    return parts;
  });
  const bySource = new Map(entries.map(([source, target]) => [source, target]));
  assert.equal(bySource.size, entries.length, 'duplicate legacy redirect source');
  const expected = [
    [
        "/getting-started",
        "/start/getting-started"
    ],
    [
        "/project-sites",
        "/start/project-sites"
    ],
    [
        "/component-examples",
        "/start/component-overview"
    ],
    [
        "/production",
        "/start/production"
    ],
    [
        "/native",
        "/react-native/"
    ],
    [
        "/web",
        "/react/"
    ],
    [
        "/tokens",
        "/design-system/tokens"
    ],
    [
        "/accessibility",
        "/design-system/accessibility"
    ],
    [
        "/theme-architecture",
        "/design-system/theme-architecture"
    ],
    [
        "/contributing",
        "/project/contributing"
    ],
    [
        "/react/radio",
        "/react/radio-group"
    ],
    [
        "/components",
        "/react/"
    ],
    [
        "/components/select",
        "/react/select"
    ],
    [
        "/components/checkbox",
        "/react/checkbox"
    ],
    [
        "/components/button",
        "/react/button"
    ],
    [
        "/components/tabs",
        "/react/tabs"
    ],
    [
        "/components/form-field",
        "/react/form-field"
    ],
    [
        "/components/radio-group",
        "/react/radio-group"
    ],
    [
        "/components/theme-provider",
        "/react/theme-provider"
    ],
    [
        "/components/modal",
        "/react/modal"
    ],
    [
        "/components/dropdown",
        "/react/dropdown"
    ]
];
  for (const [source, target] of expected) {
    assert.equal(bySource.get(source), target, `missing redirect for ${source}`);
    assert.equal(bySource.get(`${source}/`), target, `missing trailing slash redirect for ${source}`);
  }
  assert.equal(bySource.size, expected.length * 2);
  for (const source of bySource.keys()) {
    assert.ok(!source.startsWith('/_next/') && !source.startsWith('/cdn-cgi/') && !source.startsWith('/api/'));
  }
});
