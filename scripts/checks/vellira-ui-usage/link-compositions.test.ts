import { describe, expect, it } from 'vitest';

import { classifyWebsiteSource } from './link-compositions';

describe('link composition evidence', () => {
  const filename = 'apps/website/src/example.tsx';

  it('collapses valid Button asChild and its anchor into one record', () => {
    const entries = classifyWebsiteSource(
      `import { Button } from '@vellira-ui/react';
      const X = () => <Button asChild><a href='/docs'>Docs</a></Button>;`,
      filename
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      reviewStatus: 'confirmed-composition',
      memberCount: 2,
    });
  });

  it('rejects false asChild, absent href and multiple children', () => {
    for (const jsx of [
      `<Button asChild={false}><a href='/'>Wrong</a></Button>`,
      `<Button asChild><a>Missing</a></Button>`,
      `<Button asChild><a href='/'>One</a><a href='/'>Two</a></Button>`,
    ]) {
      const entries = classifyWebsiteSource(
        `import { Button } from '@vellira-ui/react'; const X = () => ${jsx};`,
        filename
      );
      expect(
        entries.some((entry) => entry.reviewStatus === 'confirmed-composition')
      ).toBe(false);
      expect(
        entries.some((entry) => entry.reviewStatus === 'needs-review')
      ).toBe(true);
    }
  });

  it('recognizes the reviewed AuthTextLink wrapper only from its import', () => {
    const good = classifyWebsiteSource(
      `import { AuthTextLink } from '@/product-app/AuthTextLink'; const X = () => <AuthTextLink href='/'>Sign in</AuthTextLink>;`,
      filename
    );
    expect(good[0].reviewStatus).toBe('confirmed-canonical');
    const unknown = classifyWebsiteSource(
      `const X = () => <AuthTextLink href='/'>Sign in</AuthTextLink>;`,
      filename
    );
    expect(unknown[0].reviewStatus).toBe('needs-review');
  });

  it('does not certify empty or unresolved href expressions', () => {
    for (const href of [
      "href=''",
      "href='   '",
      'href={undefined}',
      'href={null}',
      'href={destination}',
      'href={""}',
    ]) {
      const entries = classifyWebsiteSource(
        `import { Button } from '@vellira-ui/react'; const X = () => <Button asChild><a ${href}>Docs</a></Button>;`,
        filename
      );
      expect(
        entries.some((entry) => entry.reviewStatus === 'confirmed-composition')
      ).toBe(false);
    }
  });

  it('does not trust unrelated modules named AuthTextLink', () => {
    for (const moduleName of [
      './AuthTextLink',
      '@/other/AuthTextLink',
      'some-package/AuthTextLink',
    ]) {
      const entries = classifyWebsiteSource(
        `import { AuthTextLink } from '${moduleName}'; const X = () => <AuthTextLink href='/'>Sign in</AuthTextLink>;`,
        filename
      );
      expect(entries[0].reviewStatus).toBe('needs-review');
    }
  });

  it('retains raw links outside valid canonical compositions', () => {
    const entries = classifyWebsiteSource(
      `const X = () => <a href='/'>Home</a>;`,
      filename
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].reviewStatus).toBe('needs-review');
  });
});
