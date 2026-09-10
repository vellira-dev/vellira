import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Blog discovery visual ownership contract', () => {
  it('keeps search and filter controls in consumer-owned bare modes', () => {
    const blogIndex = read('apps/website/src/blog/ui/BlogIndex.tsx');

    expect(blogIndex).toContain("variant='bare'");
    expect(blogIndex).not.toContain("variant='outline'");
    expect(blogIndex.match(/appearance='bare'/g)).toHaveLength(6);
    expect(blogIndex).not.toContain("appearance='ghost'");
  });

  it('keeps the compact filter geometry and active underline in Blog CSS', () => {
    const css = read('apps/website/src/blog/ui/BlogIndexSearch.module.css');

    expect(css).toMatch(
      /\.filter,\s*\n\.moreFiltersTrigger\s*\{[\s\S]*?min-height:\s*40px;[\s\S]*?padding-inline:\s*12px;[\s\S]*?background:\s*transparent;[\s\S]*?border:\s*0;/
    );
    expect(css).toMatch(
      /\.filterActive::after,[\s\S]*?opacity:\s*1;[\s\S]*?transform:\s*scaleX\(1\);/
    );
  });
});
