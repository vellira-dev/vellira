import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.resolve(root, relativePath), 'utf8');

describe('Blog design-system link contract', () => {
  it('renders MDX prose links through Vellira UI', () => {
    const mdxComponents = read('apps/website/mdx-components.tsx');
    const bridge = read('apps/website/src/blog/ui/BlogDesignSystemLink.tsx');
    const sharedLink = read(
      'apps/website/src/components/navigation/DesignSystemLink.tsx'
    );

    assert.match(mdxComponents, /a: BlogDesignSystemLink/u);
    assert.match(bridge, /DesignSystemLink as BlogDesignSystemLink/u);
    assert.match(sharedLink, /from '@vellira-ui\/react'/u);
    assert.match(sharedLink, /appearance = 'link'/u);
    assert.match(sharedLink, /<Button/u);
  });

  it('does not re-implement text-link interaction states in website CSS', () => {
    const articleStyles = read(
      'apps/website/src/blog/ui/BlogExperience.module.css'
    );
    const newsletterStyles = read(
      'apps/website/src/blog/ui/BlogNewsletterSignup.module.css'
    );

    assert.doesNotMatch(articleStyles, /\.articleBody a/u);
    assert.doesNotMatch(newsletterStyles, /\.privacyNote a/u);
  });

  it('routes article navigation and share links through Vellira UI', () => {
    const sources = [
      'apps/website/src/blog/ui/BlogArticleView.tsx',
      'apps/website/src/blog/ui/BlogContinueReading.tsx',
      'apps/website/src/blog/ui/BlogIndex.tsx',
      'apps/website/src/blog/ui/NewsletterSignupForm.tsx',
    ];

    for (const relativePath of sources) {
      const source = read(relativePath);
      assert.doesNotMatch(source, /from 'next\/link'/u);
      assert.match(source, /BlogDesignSystemLink/u);
    }

    const actions = read('apps/website/src/blog/ui/BlogArticleActions.tsx');
    assert.doesNotMatch(actions, /<a\b/u);
    assert.match(actions, /<Button[\s\S]*href=\{link\.href\}/u);
  });
});
