import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const headerSource = readFileSync(
  resolve('apps/website/src/components/layout/SiteHeader/SiteHeader.tsx'),
  'utf8'
);
const headerStyles = readFileSync(
  resolve(
    'apps/website/src/components/layout/SiteHeader/SiteHeader.module.css'
  ),
  'utf8'
);

const gettingStartedHref =
  "href='https://docs.vellira.dev/start/getting-started'";

describe('mobile Get started CTA', () => {
  it('keeps the same Getting Started destination in desktop and mobile navigation', () => {
    expect(
      headerSource.match(new RegExp(gettingStartedHref, 'g'))
    ).toHaveLength(2);
    expect(headerSource).toContain('className={styles.mobileNavigationCta}');
    expect(headerSource).toContain(
      'onClick={() => setResolvedMobileMenuOpen(false)}'
    );
  });

  it('keeps the mobile CTA touch-friendly without forcing it into the compact top bar', () => {
    expect(headerStyles).toContain('.mobileNavigationCta {');
    expect(headerStyles).toContain('min-height: 44px;');
    expect(headerStyles).toMatch(
      /\.actions,\s*\.externalActions,\s*\.ctaButton\s*{\s*display:\s*none;/
    );
  });
  it('switches the global header to compact navigation before the 1280px overlap boundary', () => {
    expect(headerStyles).toContain('@media (width <= 1280px)');
    expect(headerStyles).toMatch(
      /@media \(width <= 1280px\)[\s\S]*?\.navigation\s*\{\s*display:\s*none;/
    );
    expect(headerStyles).toMatch(
      /@media \(width <= 1280px\)[\s\S]*?\.mobileMenuTrigger,[\s\S]*?\.mobileAction\s*\{[\s\S]*?display:\s*inline-flex;/
    );
  });

});
