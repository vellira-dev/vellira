import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { STORYBOOK_STORIES } from '../.vitepress/theme/storybookStories';

const docsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

function collectMarkdownFiles(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectMarkdownFiles(entryPath);
      }

      return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : [];
    });
}

function collectStorybookStoryKeys(source: string): string[] {
  const matches = source.matchAll(
    /<StorybookFrame\b[\s\S]*?\bstory="([^"]+)"[\s\S]*?\/>/g
  );

  return [...matches].map((match) => match[1]);
}

describe('StorybookFrame story references', () => {
  it('uses only registered Storybook story keys', () => {
    const knownStories = new Set(Object.keys(STORYBOOK_STORIES));
    const invalidReferences = collectMarkdownFiles(docsRoot).flatMap(
      (filePath) => {
        const source = fs.readFileSync(filePath, 'utf8');

        return collectStorybookStoryKeys(source)
          .filter((story) => !knownStories.has(story))
          .map((story) => ({
            file: path.relative(docsRoot, filePath),
            story,
          }));
      }
    );

    expect(invalidReferences).toEqual([]);
  });
});
