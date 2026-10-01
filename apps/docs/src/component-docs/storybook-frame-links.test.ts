import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { STORYBOOK_STORIES } from '../.vitepress/theme/storybookStories';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const docsRoot = path.resolve(currentDirectory, '..');
const storyReferencePattern =
  /<StorybookFrame\b[\s\S]*?\bstory="([^"]+)"[\s\S]*?\/>/g;

function collectMarkdownFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath);
    }
  }

  return files;
}

function collectStorybookStoryKeys(source: string): string[] {
  return [...source.matchAll(storyReferencePattern)].map((match) => match[1]);
}

describe('StorybookFrame story references', () => {
  it('uses only registered Storybook story keys', () => {
    const knownStories = new Set(Object.keys(STORYBOOK_STORIES));
    const invalidReferences: Array<{ file: string; story: string }> = [];

    for (const filePath of collectMarkdownFiles(docsRoot)) {
      const source = fs.readFileSync(filePath, 'utf8');

      for (const story of collectStorybookStoryKeys(source)) {
        if (!knownStories.has(story)) {
          invalidReferences.push({
            file: path.relative(docsRoot, filePath),
            story,
          });
        }
      }
    }

    expect(invalidReferences).toEqual([]);
  });
});
