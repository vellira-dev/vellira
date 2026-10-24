import { describe, expect, it } from 'vitest';

import { inventoryLinks } from './link-inventory';

describe('website link inventory (#1808 evidence)', () => {
  it('resolves next/link aliases, canonical components and ordinary anchors', () => {
    const result = inventoryLinks(
      `import RouterLink from 'next/link';
      import { DesignSystemLink as DSL } from '@/components/navigation/DesignSystemLink';
      import { Button } from '@vellira-ui/react';
      const Example = () => <nav><RouterLink href='/'>Home</RouterLink><DSL href='/'>Docs</DSL><Button asChild><a href='/'>Go</a></Button></nav>;`,
      'apps/website/src/example.tsx'
    );
    expect(result.map((item) => item.kind)).toEqual([
      'next-link',
      'canonical-link',
      'canonical-button',
      'raw-anchor',
    ]);
    expect(result[3].owner).toBe('Button');
  });

  it('does not treat example markup embedded in strings as JSX links', () => {
    expect(inventoryLinks(`const sample = "<a href='/'>Sample</a>";`, 'example.tsx')).toEqual([]);
  });

  it('flags unresolved link wrappers for human classification', () => {
    expect(inventoryLinks(`const Example = () => <CustomLink href='/'>Go</CustomLink>;`, 'example.tsx')[0]).toMatchObject({
      kind: 'unresolved',
      tag: 'CustomLink',
    });
  });
});
