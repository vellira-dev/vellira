import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(path), 'utf8');

const heroSource = read('apps/website/src/sections/home/Hero/Hero.tsx');
const finalCtaSource = read(
  'apps/website/src/sections/home/FinalCta/FinalCta.tsx'
);
const proSource = read('apps/website/src/sections/home/Pro/Pro.tsx');
const quickStartSource = read(
  'apps/website/src/sections/home/QuickStart/QuickStart.tsx'
);
const navigationSource = read('apps/website/src/config/navigation.ts');
const headerSource = read(
  'apps/website/src/components/layout/SiteHeader/SiteHeader.tsx'
);

const launchCtaSource = [
  heroSource,
  finalCtaSource,
  proSource,
  quickStartSource,
].join('\n');

describe('homepage launch positioning and navigation', () => {
  it('states the primary React and React Native use case in the hero', () => {
    expect(heroSource).toContain('Building for React web and React Native?');
    expect(heroSource).toContain('Share component APIs and');
    expect(heroSource).toContain(
      'design tokens across both while each platform keeps a native'
    );
    expect(heroSource).toContain('implementation.');
  });

  it('keeps launch CTAs on the canonical Getting Started route', () => {
    expect(launchCtaSource).not.toContain(
      'https://docs.vellira.dev/getting-started'
    );
    expect(launchCtaSource).toContain(
      'https://docs.vellira.dev/start/getting-started'
    );
    expect(headerSource).toContain(
      'https://docs.vellira.dev/start/getting-started'
    );
  });

  it('keeps primary public navigation on canonical destinations', () => {
    expect(navigationSource).toContain("href: '/components'");
    expect(navigationSource).toContain("href: 'https://docs.vellira.dev'");
    expect(navigationSource).toContain("href: 'https://storybook.vellira.dev'");
    expect(navigationSource).toContain(
      "href: 'https://github.com/vellira-dev/vellira'"
    );
    expect(launchCtaSource).not.toContain(
      'https://github.com/vellira-dev/Vellira'
    );
  });
});
