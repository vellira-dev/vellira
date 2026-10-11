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

  it('does not show npm placeholders as nav buttons', () => {
    const docs = read('apps/docs/src/.vitepress/theme/PublicReleaseBadge.vue');
    const sb = read('apps/react-storybook/.storybook/manager.ts');
    const docsCss = read('apps/docs/src/.vitepress/theme/styles.css');
    const sbCss = read('apps/react-storybook/.storybook/manager.css');

    expect(docs).toContain('v-if="release"');
    expect(sb).toContain('if (!release) return null;');
    expect(docs).not.toContain("'—'");
    expect(sb).not.toContain("'—'");

    const docsRule = docsCss.split('.vellira-docs-release {')[1];
    const sbRule = sbCss.split('.velliraToolbarVersion {')[1];
    for (const rule of [docsRule, sbRule]) {
      expect(rule?.split('}')[0]).not.toMatch(/background:|border:/);
    }
    expect(docsCss).toContain('.vellira-docs-release-mobile:empty');
  });
});
