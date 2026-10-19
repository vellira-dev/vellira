import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(path), 'utf8');

const page = read('apps/website/src/app/(marketing)/(site)/showcase/page.tsx');
const controls = read(
  'apps/website/src/app/(marketing)/(site)/showcase/ShowcaseControls.tsx'
);
const routeStyles = read(
  'apps/website/src/app/(marketing)/(site)/showcase/showcase.module.css'
);
const navigation = read('apps/website/src/config/navigation.ts');
const footer = read(
  'apps/website/src/components/layout/SiteFooter/SiteFooter.tsx'
);
const sitemap = read('apps/website/src/app/sitemap.ts');
const homepage = read('apps/website/src/app/(marketing)/(site)/page.tsx');

describe('first-developer interactive showcase', () => {
  it('has a canonical, discoverable public route', () => {
    expect(page).toContain("canonical: '/showcase'");
    expect(page).toContain("url: '/showcase'");
    expect(navigation).toContain("href: '/showcase'");
    expect(footer).toContain("href: '/showcase'");
    expect(sitemap).toContain('url: `${SITE_URL}/showcase`');
  });

  it('reuses actual platform previews and code UI', () => {
    expect(page).toContain('<PlatformParity />');
    expect(page).toContain('<CodeShowcase />');
    expect(page).toContain('<QuickStart />');
    expect(page).toContain('<ShowcaseHeroControls />');
    expect(page).toContain('<ShowcaseFeedbackActions />');
    expect(controls).toContain('<ThemeSwitcher />');
    expect(page).not.toContain('<iframe');
    expect(homepage).toContain('<PlatformParity />');
    expect(homepage).toContain('<CodeShowcase />');
  });

  it('provides routes to installation and developer feedback', () => {
    expect(controls).toContain("href='#platforms'");
    expect(controls).toContain("href='#code'");
    expect(controls).toContain("href='#quick-start'");
    expect(controls).toContain(
      'github.com/vellira-dev/vellira/tree/main/examples/cross-platform-form'
    );
    expect(controls).toContain('github.com/vellira-dev/vellira/issues/new');
    expect(controls).toContain('/blog/cross-platform-form-vellira');
  });

  it('discloses device limitations and avoids overlapping headings', () => {
    expect(page).toContain('React Native Web');
    expect(page).toContain('not an iOS or Android device test');
    expect(page).toContain('No account or newsletter signup required');
    expect(routeStyles).toContain('line-height: 1.12;');
    expect(routeStyles).toContain('overflow-wrap: break-word;');
  });
});
