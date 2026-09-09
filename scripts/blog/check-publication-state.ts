import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const BLOG_METADATA_PATH =
  /^apps\/website\/content\/blog\/[^/]+\/metadata\.json$/;
const CONTENT_AGENT_BRANCH = /^agent\/content-article-/;
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;

export interface PublicationStateFinding {
  path: string;
  message: string;
}

export interface PublicationApprovalInput {
  prNumber: string;
  headRef: string;
  headSha: string;
  parentSha: string;
  metadataPath: string;
  metadataText: string;
  articlePath: string;
  articleText: string;
  parentMetadataText: string;
  parentArticleText: string;
  commitMessage: string;
  transitionChangedPaths: string[];
}

export function validatePublicationMetadata(
  path: string,
  rawMetadata: string
): PublicationStateFinding[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawMetadata) as unknown;
  } catch {
    return [
      {
        path,
        message: 'metadata must contain valid JSON before publication',
      },
    ];
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return [
      {
        path,
        message: 'metadata must be a JSON object before publication',
      },
    ];
  }

  const metadata = parsed as Record<string, unknown>;

  if (metadata.draft !== false) {
    return [
      {
        path,
        message:
          'publication is blocked: this article is still draft:true; merging it would leave the article hidden from the public blog',
      },
    ];
  }

  return [];
}

export function normalizePublishableMetadata(rawMetadata: string): string {
  const parsed = JSON.parse(rawMetadata) as Record<string, unknown>;
  if (parsed.draft === false) {
    const matches = rawMetadata.match(/"draft"\s*:\s*false\b/g) ?? [];
    if (matches.length !== 1) {
      throw new Error('metadata draft:false must have one canonical JSON token');
    }
    return rawMetadata;
  }
  if (parsed.draft === true) {
    const matches = rawMetadata.match(/"draft"\s*:\s*true\b/g) ?? [];
    if (matches.length !== 1) {
      throw new Error('metadata draft:true must have one canonical JSON token');
    }
    return rawMetadata.replace(/("draft"\s*:\s*)true\b/, '$1false');
  }
  throw new Error('metadata draft must be a boolean');
}

export function publicationCandidateDigest(
  metadataPath: string,
  metadataText: string,
  articlePath: string,
  articleText: string
): string {
  const payload = [
    'vellira-publication-candidate-v1',
    metadataPath,
    normalizePublishableMetadata(metadataText),
    articlePath,
    articleText,
  ].join('\0');
  return `sha256:${createHash('sha256').update(payload, 'utf8').digest('hex')}`;
}

export function parseApprovalTrailers(message: string): Map<string, string> {
  const trailers = new Map<string, string>();
  for (const rawLine of message.split('\n')) {
    const line = rawLine.trim();
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1).trim();
    if (key.startsWith('Vellira-Publication-')) {
      trailers.set(key, value);
    }
  }
  return trailers;
}

export function validateContentAgentCandidatePaths(
  headRef: string,
  metadataPaths: string[]
): PublicationStateFinding[] {
  if (!CONTENT_AGENT_BRANCH.test(headRef)) return [];
  if (metadataPaths.length === 1) return [];

  return [
    {
      path: 'apps/website/content/blog',
      message:
        'Content Agent publication approval requires exactly one canonical Blog V1 article candidate',
    },
  ];
}

export function validateContentAgentApproval(
  input: PublicationApprovalInput
): PublicationStateFinding[] {
  if (!CONTENT_AGENT_BRANCH.test(input.headRef)) return [];

  const findings: PublicationStateFinding[] = [];
  const trailers = parseApprovalTrailers(input.commitMessage);
  const slug = input.metadataPath.split('/').at(-2) ?? '';

  const required: Array<[string, string]> = [
    ['Vellira-Publication-Approval', 'v1'],
    ['Vellira-Publication-PR', input.prNumber],
    ['Vellira-Publication-Article', slug],
    ['Vellira-Publication-Approved-From', input.parentSha],
  ];
  for (const [key, expected] of required) {
    if (trailers.get(key) !== expected) {
      findings.push({
        path: input.metadataPath,
        message: `publication approval is invalid: ${key} must equal ${expected}`,
      });
    }
  }

  const approvedBy = trailers.get('Vellira-Publication-Approved-By') ?? '';
  if (
    !approvedBy ||
    approvedBy.endsWith('[bot]') ||
    approvedBy === 'github-actions'
  ) {
    findings.push({
      path: input.metadataPath,
      message: 'publication approval must identify a human approver',
    });
  }

  const digest = trailers.get('Vellira-Publication-Candidate-Digest') ?? '';
  const expectedDigest = publicationCandidateDigest(
    input.metadataPath,
    input.metadataText,
    input.articlePath,
    input.articleText
  );
  if (!SHA256.test(digest) || digest !== expectedDigest) {
    findings.push({
      path: input.metadataPath,
      message:
        'publication approval candidate digest does not match the exact reader-facing article candidate',
    });
  }

  if (!SHA40.test(input.headSha) || !SHA40.test(input.parentSha)) {
    findings.push({
      path: input.metadataPath,
      message: 'publication approval requires exact full commit identities',
    });
  }

  if (input.transitionChangedPaths.length === 0) {
    if (input.parentMetadataText !== input.metadataText) {
      findings.push({
        path: input.metadataPath,
        message: 'idempotent publication approval must not mutate metadata',
      });
    }
    if (input.parentArticleText !== input.articleText) {
      findings.push({
        path: input.articlePath,
        message: 'idempotent publication approval must not mutate article prose',
      });
    }
  } else if (
    input.transitionChangedPaths.length !== 1 ||
    input.transitionChangedPaths[0] !== input.metadataPath
  ) {
    findings.push({
      path: input.metadataPath,
      message:
        'publication approval commit may change only the canonical article metadata file',
    });
  } else {
    let parentMetadata: Record<string, unknown> | null = null;
    let currentMetadata: Record<string, unknown> | null = null;
    try {
      parentMetadata = JSON.parse(input.parentMetadataText) as Record<
        string,
        unknown
      >;
      currentMetadata = JSON.parse(input.metadataText) as Record<string, unknown>;
    } catch {
      findings.push({
        path: input.metadataPath,
        message: 'publication approval transition metadata must contain valid JSON',
      });
    }

    if (
      parentMetadata &&
      currentMetadata &&
      (parentMetadata.draft !== true || currentMetadata.draft !== false)
    ) {
      findings.push({
        path: input.metadataPath,
        message: 'publication approval commit must transition draft:true to draft:false',
      });
    }
    if (input.parentArticleText !== input.articleText) {
      findings.push({
        path: input.articlePath,
        message: 'publication approval commit must not change article prose',
      });
    }
    try {
      if (normalizePublishableMetadata(input.parentMetadataText) !== input.metadataText) {
        findings.push({
          path: input.metadataPath,
          message:
            'publication approval commit changed metadata beyond the draft publication state',
        });
      }
    } catch {
      findings.push({
        path: input.metadataPath,
        message: 'publication approval transition metadata is not canonical',
      });
    }
  }

  return findings;
}

export function parseChangedBlogMetadataPaths(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => BLOG_METADATA_PATH.test(line));
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function changedBlogMetadataPaths(): string[] {
  return parseChangedBlogMetadataPaths(
    git(
      'diff',
      '--name-only',
      '--diff-filter=AMRT',
      'HEAD^1',
      'HEAD',
      '--',
      ':(glob)apps/website/content/blog/*/metadata.json'
    )
  );
}

function showFile(revision: string, path: string): string {
  return git('show', `${revision}:${path}`);
}

async function main(): Promise<void> {
  const paths = changedBlogMetadataPaths();
  const findings: PublicationStateFinding[] = [];

  for (const path of paths) {
    const metadataText = showFile('HEAD', path);
    findings.push(...validatePublicationMetadata(path, metadataText));
  }

  const headRef = process.env.VELLIRA_PR_HEAD_REF ?? '';
  findings.push(...validateContentAgentCandidatePaths(headRef, paths));

  if (CONTENT_AGENT_BRANCH.test(headRef) && paths.length === 1) {
    const metadataPath = paths[0]!;
    const articlePath = metadataPath.replace(/metadata\.json$/, 'article.mdx');
    const headSha = process.env.VELLIRA_PR_HEAD_SHA ?? '';
    const prNumber = process.env.VELLIRA_PR_NUMBER ?? '';
    try {
      const parentSha = git('rev-parse', `${headSha}^`).trim();
      const transitionChangedPaths = git(
        'diff',
        '--name-only',
        parentSha,
        headSha
      )
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      findings.push(
        ...validateContentAgentApproval({
          prNumber,
          headRef,
          headSha,
          parentSha,
          metadataPath,
          metadataText: showFile(headSha, metadataPath),
          articlePath,
          articleText: showFile(headSha, articlePath),
          parentMetadataText: showFile(parentSha, metadataPath),
          parentArticleText: showFile(parentSha, articlePath),
          commitMessage: git('show', '-s', '--format=%B', headSha),
          transitionChangedPaths,
        })
      );
    } catch (error) {
      findings.push({
        path: metadataPath,
        message: `publication approval exact-candidate validation failed: ${String(error)}`,
      });
    }
  }

  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`::error file=${finding.path}::${finding.message}`);
    }
    process.exitCode = 1;
    return;
  }

  if (paths.length === 0) {
    console.log(
      'No added or modified Blog V1 metadata requires publication validation.'
    );
    return;
  }

  console.log(
    `Publication state and exact approval valid for ${paths.length} Blog V1 article(s).`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
