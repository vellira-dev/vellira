import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const BLOG_METADATA_PATH =
  /^apps\/website\/content\/blog\/[^/]+\/metadata\.json$/;

export interface PublicationStateFinding {
  path: string;
  message: string;
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

export function parseChangedBlogMetadataPaths(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => BLOG_METADATA_PATH.test(line));
}

function changedBlogMetadataPaths(baseSha: string, headSha: string): string[] {
  const output = execFileSync(
    'git',
    [
      'diff',
      '--name-only',
      '--diff-filter=AMRT',
      baseSha,
      headSha,
      '--',
      ':(glob)apps/website/content/blog/*/metadata.json',
    ],
    { encoding: 'utf8' }
  );

  return parseChangedBlogMetadataPaths(output);
}

async function main(): Promise<void> {
  const baseSha = process.env.VELLIRA_PUBLICATION_BASE_SHA?.trim();
  const headSha = process.env.VELLIRA_PUBLICATION_HEAD_SHA?.trim();

  if (!baseSha || !headSha) {
    throw new Error(
      'VELLIRA_PUBLICATION_BASE_SHA and VELLIRA_PUBLICATION_HEAD_SHA are required'
    );
  }

  const paths = changedBlogMetadataPaths(baseSha, headSha);
  const findings: PublicationStateFinding[] = [];

  for (const path of paths) {
    findings.push(
      ...validatePublicationMetadata(path, await readFile(path, 'utf8'))
    );
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

  console.log(`Publication state valid for ${paths.length} Blog V1 article(s).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
