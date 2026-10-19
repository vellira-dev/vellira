import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(path), 'utf8');

const page = read('apps/website/src/app/(marketing)/(site)/showcase/page.tsx');
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

  it('reuses actual cross-platform demo and public code UI', () => {
    expect(page).toContain('<PlatformParity />');
    expect(page).toContain('<CodeShowcase />');
    expect(page).toContain('<QuickStart />');
    expect(page).toContain('<ThemeSwitcher />');
    expect(page).not.toContain('<iframe');
    expect(homepage).toContain('<PlatformParity />');
    expect(homepage).toContain('<CodeShowcase />');
  });

  it('provides a visible route from interaction to installation and feedback', () => {
    expect(page).toContain("href='#platforms'");
    expect(page).toContain("href='#code'");
    expect(page).toContain("href='#quick-start'");
    expect(page).toContain(
      'github.com/vellira-dev/vellira/tree/main/examples/cross-platform-form'
    );
    expect(page).toContain('github.com/vellira-dev/vellira/issues/new');
    expect(page).toContain('/blog/cross-platform-form-vellira');
  });

  it('makes limitations explicit and avoids Vite headline collisions', () => {
    expect(page).toContain('React Native Web');
    expect(page).toContain('not an iOS or Android device test');
    expect(page).toContain('no account or newsletter signup required'.replace(
      'no account',
      'No account'
    ));
    expect(routeStyles).toContain('line-height: 1.12;');
    expect(routeStyles).toContain('overflow-wrap: break-word;');
  });
});
