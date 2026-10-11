import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(path), 'utf8');

describe('shared npm-verified version on public sites', () => {
  it('uses one server endpoint rather than fetching npm from all browsers', () => {
    const api = read('apps/website/src/app/api/public-release/route.ts');
    const client = read('scripts/public-release/client.ts');

    expect(api).toContain("dynamic = 'force-dynamic'");
    expect(api).toContain('createPublicReleaseHandler');
    expect(client).toContain('https://vellira.dev/api/public-release');
    expect(client).not.toContain('https://registry.npmjs.org');
  });

  it('updates every version surface without changing release-sync deploy gates', () => {
    const sections = [
      'SocialProof/SocialProof.tsx',
      'Roadmap/Roadmap.tsx',
      'ProductionWorkflow/ProductionWorkflow.tsx',
    ];
    for (const path of sections) {
      const source = read(`apps/website/src/sections/home/${path}`);
      expect(source).toContain('<PublishedNpmVersion />');
      expect(source).not.toContain("productFacts.stableRelease ?? '—'");
    }

    const docs = read('apps/docs/src/.vitepress/theme/ReleaseLayout.vue');
    const storybook = read('apps/react-storybook/.storybook/manager.ts');
    const docsTheme = read('apps/docs/src/.vitepress/theme/index.ts');

    expect(docs).toContain('<PublicReleaseBadge />');
    expect(docsTheme).toContain('Layout: ReleaseLayout');
    expect(storybook).toContain('observePublicRelease(setRelease)');
    expect(storybook).toContain('vellira/navigation-links/latest-npm-release');

    const staging = read(
      '.github/workflows/deploy-website-cloudflare-staging.yml'
    );
    const production = read(
      '.github/workflows/deploy-website-cloudflare-production.yml'
    );
    expect(staging).toContain("needs.classify.outputs.release_sync != 'true'");
    expect(production).toContain(
      "needs.classify.outputs.release_sync != 'true'"
    );
  });

  it('hides unverified releases and uses quiet text links in Docs and Storybook', () => {
    const docsBadge = read(
      'apps/docs/src/.vitepress/theme/PublicReleaseBadge.vue'
    );
    const docsStyles = read('apps/docs/src/.vitepress/theme/styles.css');
    const storybook = read('apps/react-storybook/.storybook/manager.ts');
    const storybookStyles = read(
      'apps/react-storybook/.storybook/manager.css'
    );

    expect(docsBadge).toContain('v-if="release"');
    expect(docsBadge).toContain('v{{ release.version }}');
    expect(docsBadge).not.toContain("'—'");
    expect(storybook).toContain('if (!release) return null;');
    expect(storybook).not.toContain("'—'");

    const docsBaseStyle = docsStyles.match(/\.vellira-docs-release \{([^}]*)\}/)?.[1];
    const storybookBaseStyle = storybookStyles.match(/\.velliraToolbarVersion \{([^}]*)\}/)?.[1];
    expect(docsBaseStyle).toBeDefined();
    expect(storybookBaseStyle).toBeDefined();
    for (const baseStyle of [docsBaseStyle, storybookBaseStyle]) {
      expect(baseStyle).not.toMatch(/background:|border:|border-radius: 999px/);
      expect(baseStyle).toContain('font-size:');
    }
    expect(docsStyles).toContain('.vellira-docs-release-mobile:empty');
  });
});
