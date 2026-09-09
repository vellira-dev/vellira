import { describe, expect, it } from 'vitest';

import {
  parseApprovalTrailers,
  parseChangedBlogMetadataPaths,
  publicationCandidateDigest,
  validateContentAgentApproval,
  validateContentAgentCandidatePaths,
  validatePublicationMetadata,
} from './check-publication-state';

const metadataPath =
  'apps/website/content/blog/typescript-project-ownership/metadata.json';
const articlePath =
  'apps/website/content/blog/typescript-project-ownership/article.mdx';
const parentSha = 'a'.repeat(40);
const headSha = 'b'.repeat(40);

function metadata(draft: boolean): string {
  return `${JSON.stringify(
    {
      title: 'Enforcing TypeScript project ownership in Vellira',
      slug: 'typescript-project-ownership',
      description: 'A useful engineering article.',
      draft,
    },
    null,
    2
  )}\n`;
}

function approvalMessage(candidateDigest: string): string {
  return [
    'docs(blog): approve article for publication',
    '',
    'Vellira-Publication-Approval: v1',
    'Vellira-Publication-PR: 956',
    'Vellira-Publication-Article: typescript-project-ownership',
    'Vellira-Publication-Approved-By: romanbakurov',
    `Vellira-Publication-Approved-From: ${parentSha}`,
    `Vellira-Publication-Candidate-Digest: ${candidateDigest}`,
    '',
  ].join('\n');
}

describe('Blog publication state gate', () => {
  it('blocks the #948-shaped invisible publication state', () => {
    const findings = validatePublicationMetadata(metadataPath, metadata(true));

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('still draft:true');
    expect(findings[0]?.message).toContain('hidden from the public blog');
  });

  it('accepts an article explicitly transitioned to publishable metadata', () => {
    expect(validatePublicationMetadata(metadataPath, metadata(false))).toEqual(
      []
    );
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

  it('fails closed when a Content Agent Ready PR has no canonical metadata candidate', () => {
    const findings = validateContentAgentCandidatePaths(
      'agent/content-article-example',
      []
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('exactly one canonical Blog V1');
  });

  it('fails closed when a Content Agent Ready PR has multiple metadata candidates', () => {
    expect(
      validateContentAgentCandidatePaths('agent/content-article-example', [
        metadataPath,
        'apps/website/content/blog/second-article/metadata.json',
      ])
    ).toHaveLength(1);
  });

  it('does not impose the Content Agent candidate contract on ordinary PRs', () => {
    expect(validateContentAgentCandidatePaths('fix/blog-copy', [])).toEqual([]);
  });

  it('pins the same publication candidate digest as the Python approval workflow', () => {
    expect(
      publicationCandidateDigest(
        metadataPath,
        metadata(false),
        articlePath,
        'Reader-facing article body.\n'
      )
    ).toBe(
      'sha256:b8915efa09b782057ab1d62d05e6c2129e76aeb0078f0ab1244d6e6d2f5f8245'
    );
  });

  it('accepts a Content Agent approval commit bound to the exact candidate', () => {
    const article = 'Reader-facing article body.\n';
    const currentMetadata = metadata(false);
    const digest = publicationCandidateDigest(
      metadataPath,
      currentMetadata,
      articlePath,
      article
    );

    expect(
      validateContentAgentApproval({
        prNumber: '956',
        headRef: 'agent/content-article-typescript-project-ownership',
        headSha,
        parentSha,
        metadataPath,
        metadataText: currentMetadata,
        articlePath,
        articleText: article,
        parentMetadataText: metadata(true),
        parentArticleText: article,
        commitMessage: approvalMessage(digest),
        transitionChangedPaths: [metadataPath],
      })
    ).toEqual([]);
  });

  it('invalidates approval when article content changes after review', () => {
    const approvedArticle = 'Approved article body.\n';
    const currentArticle = 'Changed article body.\n';
    const digest = publicationCandidateDigest(
      metadataPath,
      metadata(false),
      articlePath,
      approvedArticle
    );

    const findings = validateContentAgentApproval({
      prNumber: '956',
      headRef: 'agent/content-article-typescript-project-ownership',
      headSha,
      parentSha,
      metadataPath,
      metadataText: metadata(false),
      articlePath,
      articleText: currentArticle,
      parentMetadataText: metadata(true),
      parentArticleText: approvedArticle,
      commitMessage: approvalMessage(digest),
      transitionChangedPaths: [metadataPath, articlePath],
    });

    expect(findings.some((finding) => finding.message.includes('digest'))).toBe(
      true
    );
    expect(
      findings.some((finding) => finding.message.includes('only the canonical'))
    ).toBe(true);
  });

  it('invalidates approval when the approval commit is no longer the PR head', () => {
    const article = 'Approved article body.\n';
    const digest = publicationCandidateDigest(
      metadataPath,
      metadata(false),
      articlePath,
      article
    );
    const staleMessage = approvalMessage(digest).replace(
      `Vellira-Publication-Approved-From: ${parentSha}`,
      `Vellira-Publication-Approved-From: ${'c'.repeat(40)}`
    );

    const findings = validateContentAgentApproval({
      prNumber: '956',
      headRef: 'agent/content-article-typescript-project-ownership',
      headSha,
      parentSha,
      metadataPath,
      metadataText: metadata(false),
      articlePath,
      articleText: article,
      parentMetadataText: metadata(false),
      parentArticleText: article,
      commitMessage: staleMessage,
      transitionChangedPaths: [],
    });

    expect(
      findings.some((finding) =>
        finding.message.includes('Vellira-Publication-Approved-From')
      )
    ).toBe(true);
  });

  it('accepts an idempotent approval commit for already-publishable metadata', () => {
    const article = 'Already publishable article.\n';
    const currentMetadata = metadata(false);
    const digest = publicationCandidateDigest(
      metadataPath,
      currentMetadata,
      articlePath,
      article
    );

    expect(
      validateContentAgentApproval({
        prNumber: '956',
        headRef: 'agent/content-article-typescript-project-ownership',
        headSha,
        parentSha,
        metadataPath,
        metadataText: currentMetadata,
        articlePath,
        articleText: article,
        parentMetadataText: currentMetadata,
        parentArticleText: article,
        commitMessage: approvalMessage(digest),
        transitionChangedPaths: [],
      })
    ).toEqual([]);
  });

  it('parses only versioned publication trailers', () => {
    const trailers = parseApprovalTrailers(
      [
        'Subject',
        '',
        'Other-Key: ignored',
        'Vellira-Publication-Approval: v1',
        'Vellira-Publication-Approved-By: romanbakurov',
      ].join('\n')
    );

    expect(trailers.get('Vellira-Publication-Approval')).toBe('v1');
    expect(trailers.get('Vellira-Publication-Approved-By')).toBe(
      'romanbakurov'
    );
    expect(trailers.has('Other-Key')).toBe(false);
  });
});
