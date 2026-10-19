import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(path), 'utf8');
const home = 'apps/website/src/sections/home/';

describe('homepage consistency story and source-backed facts', () => {
  it('connects the AI consistency article after tangible component proof', () => {
    const page = read('apps/website/src/app/(marketing)/(site)/page.tsx');
    const story = read(`${home}ConsistencyStory/ConsistencyStory.tsx`);

    expect(page).toContain('<ConsistencyStory />');
    expect(page.indexOf('<ComponentShowcase />')).toBeLessThan(
      page.indexOf('<ConsistencyStory />')
    );
    expect(page.indexOf('<ConsistencyStory />')).toBeLessThan(
      page.indexOf('<ThemeStudio />')
    );
    expect(story).toContain('Available now');
    expect(story).toContain('Inspectable today');
    const css = read(`${home}ConsistencyStory/ConsistencyStory.module.css`);
    expect(css).toContain('color: var(--text-brand);');
    expect(story).toContain('In development');
    expect(story).toContain('/blog/ai-ui-consistency');
    expect(story).toContain('/blog/quality-gates-before-component-growth');
    expect(story).toContain("not part of today's public");
  });

  it('renders verified npm version slots instead of freezing old numbers', () => {
    const page = read('apps/website/src/app/(marketing)/(site)/page.tsx');
    const workflow = read(`${home}ProductionWorkflow/ProductionWorkflow.tsx`);
    const roadmap = read(`${home}Roadmap/Roadmap.tsx`);

    expect(page).toContain(
      '<ProductionWorkflow productFacts={homepageProductFacts} />'
    );
    expect(page).toContain('<Roadmap />');
    expect(workflow).toContain('<PublishedNpmVersion />');
    expect(workflow).toContain("productFacts.publishedPackages ?? '—'");
    expect(roadmap).toContain('<PublishedNpmVersion />');
    expect(workflow + roadmap).not.toMatch(/v2\.18\.4|268 tests|0 errors/);
    expect(roadmap).not.toContain("version: 'Latest stable'");
  });

  it('identifies animated pipeline statuses as illustrative and links real CI', () => {
    const source = read(`${home}SocialProof/SocialProof.tsx`);

    expect(source).toContain('Illustrative CI walkthrough');
    expect(source).toContain('View live CI');
    expect(source).not.toContain('2 minutes ago');
    expect(source).not.toContain('ca3d7a6');
    expect(source).not.toContain('All required checks passing');
  });

  it('shows required web styles and qualifies platform parity claims', () => {
    const quick = read(`${home}QuickStart/QuickStart.tsx`);
    const code = read(`${home}CodeShowcase/CodeShowcase.tsx`);
    const parity = read(`${home}PlatformParity/PlatformParity.tsx`);

    expect(quick).toContain('@vellira-ui/react/styles');
    const quickStyles = read(`${home}QuickStart/QuickStart.module.css`);
    expect(quickStyles).toMatch(/\.editor code \{[^}]*white-space: pre;/s);
    expect(code).toContain('@vellira-ui/react/styles');
    expect(code).toContain('platform-specific setup');
    expect(code).toContain('Illustrative UI only');
    expect(code).not.toContain('Workspace Pro');
    expect(parity).toContain('Exact props and interaction details');
    expect(parity).toContain('Feature parity continues to evolve.');
    expect(parity).toContain('Try the Workspace Starter');
    expect(parity).toContain(
      'github.com/vellira-dev/vellira/tree/main/examples/workspace-starter'
    );
  });
});
