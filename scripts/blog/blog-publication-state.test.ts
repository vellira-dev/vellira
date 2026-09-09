import { describe, expect, it } from 'vitest';

import {
  parseChangedBlogMetadataPaths,
  validatePublicationMetadata,
} from './check-publication-state';

describe('Blog publication state gate', () => {
  it('blocks the #948-shaped invisible publication state', () => {
    const findings = validatePublicationMetadata(
      'apps/website/content/blog/typescript-project-ownership/metadata.json',
      JSON.stringify({
        title: 'Enforcing TypeScript project ownership in Vellira',
        slug: 'typescript-project-ownership',
        draft: true,
      })
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('still draft:true');
    expect(findings[0]?.message).toContain('hidden from the public blog');
  });

  it('accepts an article explicitly transitioned to publishable metadata', () => {
    expect(
      validatePublicationMetadata(
        'apps/website/content/blog/typescript-project-ownership/metadata.json',
        JSON.stringify({
          title: 'Enforcing TypeScript project ownership in Vellira',
          slug: 'typescript-project-ownership',
          draft: false,
        })
      )
    ).toEqual([]);
  });

  it('fails closed for malformed publication metadata', () => {
    expect(
      validatePublicationMetadata(
        'apps/website/content/blog/example/metadata.json',
        '{not-json'
      )
    ).toEqual([
      {
        path: 'apps/website/content/blog/example/metadata.json',
        message: 'metadata must contain valid JSON before publication',
      },
    ]);
  });

  it('keeps the gate scoped to canonical Blog V1 metadata paths', () => {
    expect(
      parseChangedBlogMetadataPaths(
        [
          'apps/website/content/blog/example/metadata.json',
          'apps/website/content/blog/example/article.mdx',
          'packages/react/package.json',
          '',
        ].join('\n')
      )
    ).toEqual(['apps/website/content/blog/example/metadata.json']);
  });
});
