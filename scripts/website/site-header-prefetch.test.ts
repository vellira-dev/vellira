import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const siteHeaderSource = readFileSync(
  resolve('apps/website/src/components/layout/SiteHeader/SiteHeader.tsx'),
  'utf8'
);
const headerChromeSource = readFileSync(
  resolve('apps/website/src/components/layout/HeaderChrome/HeaderChrome.tsx'),
  'utf8'
);
const siteFooterSource = readFileSync(
  resolve('apps/website/src/components/layout/SiteFooter/SiteFooter.tsx'),
  'utf8'
);

describe('site navigation prefetch policy', () => {
  it('prefetches top-level pages and disables prefetch for section-anchor links', () => {
    const desktopPagePrefetch = "prefetch={item.type === 'page'}";
    const mobileSectionPrefetch =
      "prefetch={item.type === 'section' ? false : undefined}";
    const footerSectionPrefetch =
      "prefetch={link.href.startsWith('/#') ? false : undefined}";

    expect(siteHeaderSource).toContain("brandHref='/'");
    expect(headerChromeSource).toMatch(/<Link\s+href=\{href\}\s+prefetch\b/u);
    expect(siteHeaderSource).not.toContain('router.prefetch(');
    expect(siteHeaderSource).toContain(desktopPagePrefetch);
    expect(siteHeaderSource).toContain(mobileSectionPrefetch);
    expect(siteHeaderSource).toContain('href={item.href}');

    expect(siteFooterSource).toContain('prefetch={false}');
    expect(siteFooterSource).toContain(footerSectionPrefetch);
    expect(siteFooterSource).toContain('{productLinks.map((link) => (');
  });
});
