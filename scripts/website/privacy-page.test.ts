import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(path), 'utf8');

const privacyPage = read(
  'apps/website/src/app/(marketing)/(site)/privacy/page.tsx'
);
const siteFooter = read(
  'apps/website/src/components/layout/SiteFooter/SiteFooter.tsx'
);
const compactFooter = read(
  'apps/website/src/components/layout/CompactFooter/CompactFooter.tsx'
);
const sitemap = read('apps/website/src/app/sitemap.ts');
const newsletterSignup = read(
  'apps/website/src/blog/ui/NewsletterSignupForm.tsx'
);

describe('website privacy policy', () => {
  it(
    'publishes a canonical privacy route with a truthful pre-company operator',
    () => {
      expect(privacyPage).toContain("canonical: '/privacy'");
      expect(privacyPage).toContain('Roman Bakurov');
      expect(privacyPage).toContain('independent software project');
      expect(privacyPage).toContain('roman@vellira.dev');
      expect(privacyPage).not.toContain('Vellira SAS');
      expect(privacyPage).not.toContain('Vellira LLC');
    }
  );

  it(
    'documents the current website data flows instead of generic boilerplate',
    () => {
      expect(privacyPage).toContain('Cloudflare Web Analytics');
      expect(privacyPage).toContain('__Host-vellira_actor');
      expect(privacyPage).toContain('180 days');
      expect(privacyPage).toContain('vellira-website-theme');
      expect(privacyPage).toContain('Buttondown');
      expect(privacyPage).toContain('client IP');
      expect(privacyPage).toContain('Render');
    }
  );

  it('makes the privacy route discoverable from both website footers', () => {
    expect(siteFooter).toContain("href='/privacy'");
    expect(compactFooter).toContain("href='/privacy'");
  });

  it('includes the privacy route in the public sitemap', () => {
    expect(sitemap).toContain("`${SITE_URL}/privacy`");
    expect(sitemap).toContain("new Date('2026-10-05')");
  });

  it('links the policy at the newsletter email collection point', () => {
    expect(newsletterSignup).toContain("href='/privacy'");
    expect(newsletterSignup).toContain(
      'We use your email to manage the subscription.'
    );
  });
});
