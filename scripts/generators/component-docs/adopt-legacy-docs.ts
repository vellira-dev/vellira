import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ComponentPlatform } from '@vellira-ui/metadata';
import prettier from 'prettier';

import { componentDocsContracts } from '../../../apps/docs/src/component-docs';
import { componentMetadata } from '../../../packages/metadata/src/components';

import {
  authoredRegionEndMarker,
  authoredRegionStartMarker,
  readAuthoredRegion,
} from './authored-region';
import { generateComponentDocs } from './generate-component-docs';
import { inspectComponentDocAuthority } from './legacy-adoption';
import { generatedComponentDocsHeader } from './render';

const platforms = ['react', 'react-native'] as const;
type Platform = (typeof platforms)[number];
type DigestMap = Partial<Record<Platform, string>>;

export type DocsAdoptionProof = {
  component: string;
  status: 'preview' | 'adopted' | 'up-to-date';
  entries: {
    platform: ComponentPlatform;
    file: string;
    originalSha256: string;
    generatedSha256: string;
    preservedAuthorSha256: string;
    preservedAuthorBytes: number;
  }[];
};

export type AdoptDocsOptions = {
  root: string;
  componentName: string;
  docsRoot?: string;
  write?: boolean;
  expectedOriginalSha256?: DigestMap;
};

const sha256 = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');

function readLegacyBody(params: {
  source: string;
  componentName: string;
  title: string;
  description: string;
  file: string;
}) {
  const { source, componentName, title, description, file } = params;
  const match =
    /^---\r?\n([\s\S]*?)\r?\n---\r?\n\s*# ([^\r\n]+)\r?\n([\s\S]*)$/.exec(
      source
    );

  if (!match || match[2] !== componentName) {
    throw new Error(
      file +
        ': legacy docs need unambiguous frontmatter and the expected top-level H1.'
    );
  }

  const frontmatter = match[1].split(/\r?\n/);
  // The renderer owns exactly these two keys. Reject any other YAML rather
  // than silently dropping authored routes, redirects or sidebar metadata.
  const keys = frontmatter.map(
    (line) => /^([A-Za-z][A-Za-z0-9_-]*):\s+\S/.exec(line)?.[1]
  );
  if (
    keys.length !== 2 ||
    new Set(keys).size !== 2 ||
    !keys.includes('title') ||
    !keys.includes('description')
  ) {
    throw new Error(
      file +
        ': unsupported YAML frontmatter; only title and description are preserved by legacy docs adoption.'
    );
  }
  const titleLine = frontmatter.find((line) => line.startsWith('title: '));
  const descriptionLine = frontmatter.find((line) =>
    line.startsWith('description: ')
  );
  if (
    titleLine?.slice(7).trim() !== title ||
    descriptionLine?.slice(13).trim() !== description
  ) {
    throw new Error(
      file +
        ': docs contract title/description must preserve the published legacy frontmatter.'
    );
  }

  const body = match[3].trim();
  if (!body || !body.includes('## Accessibility')) {
    throw new Error(
      file +
        ': expected authored guidance is missing; refusing to adopt an incomplete page.'
    );
  }

  return body;
}

function createManagedSeed(params: {
  componentName: string;
  title: string;
  description: string;
  body: string;
}) {
  const { componentName, title, description, body } = params;
  return [
    '---',
    'title: ' + JSON.stringify(title),
    'description: ' + JSON.stringify(description),
    '---',
    '',
    generatedComponentDocsHeader,
    '',
    '# ' + componentName,
    '',
    '## Import',
    '',
    authoredRegionStartMarker,
    '',
    body,
    '',
    authoredRegionEndMarker,
    '',
  ].join('\n');
}

/**
 * Non-destructive, two-platform legacy docs adoption.
 *
 * Preview generates into an isolated temporary docs root and never writes
 * maintained Markdown. A write requires pinned SHA-256 values for BOTH source
 * documents and validates both complete outputs before committing either one.
 */
export async function adoptLegacyComponentDocs({
  root,
  componentName,
  docsRoot = path.join(root, 'apps', 'docs', 'src'),
  write = false,
  expectedOriginalSha256,
}: AdoptDocsOptions): Promise<DocsAdoptionProof> {
  const metadata = componentMetadata.find(
    (item) => item.name === componentName
  );
  const contract = componentDocsContracts.find(
    (item) => item.component === componentName
  );
  if (!metadata || !contract) {
    throw new Error(
      componentName +
        ': canonical metadata and a complete docs contract are required.'
    );
  }
  if (!platforms.every((platform) => metadata.platforms.includes(platform))) {
    throw new Error(
      componentName + ': this pilot requires both supported platforms.'
    );
  }

  const slug = componentName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
  const originals = platforms.map((platform) => {
    const file = path.join(docsRoot, platform, slug + '.md');
    const source = fs.existsSync(file)
      ? fs.readFileSync(file, 'utf8')
      : undefined;
    const inspection = inspectComponentDocAuthority({
      content: source,
      filePath: path.relative(root, file),
    });
    if (!source || !['legacy', 'managed'].includes(inspection.state)) {
      throw new Error(
        file +
          ': expected a real legacy or managed page; found ' +
          inspection.state
      );
    }
    return {
      platform,
      file,
      source,
      inspection,
      originalSha256: sha256(source),
    };
  });

  if (originals.every((entry) => entry.inspection.state === 'managed')) {
    const proof = await generateComponentDocs({
      root,
      docsRoot,
      componentName,
      check: true,
      metadata: [metadata],
      contracts: [contract],
    });
    if (proof.status !== 'up-to-date') {
      throw new Error(
        componentName + ': managed docs are stale, not safe to adopt again.'
      );
    }
    return {
      component: componentName,
      status: 'up-to-date',
      entries: originals.map((entry) => ({
        platform: entry.platform,
        file: path.relative(root, entry.file),
        originalSha256: entry.originalSha256,
        generatedSha256: entry.originalSha256,
        preservedAuthorSha256: sha256(
          entry.source
            .slice(
              entry.source.indexOf(authoredRegionStartMarker) +
                authoredRegionStartMarker.length,
              entry.source.indexOf(authoredRegionEndMarker)
            )
            .trim()
        ),
        preservedAuthorBytes: Buffer.byteLength(
          entry.source
            .slice(
              entry.source.indexOf(authoredRegionStartMarker) +
                authoredRegionStartMarker.length,
              entry.source.indexOf(authoredRegionEndMarker)
            )
            .trim(),
          'utf8'
        ),
      })),
    };
  }

  if (originals.some((entry) => entry.inspection.state !== 'legacy')) {
    throw new Error(
      componentName +
        ': mixed managed/legacy platforms must not be partially adopted.'
    );
  }
  if (write) {
    for (const entry of originals) {
      if (
        !expectedOriginalSha256?.[entry.platform] ||
        expectedOriginalSha256[entry.platform] !== entry.originalSha256
      ) {
        throw new Error(
          entry.file +
            ': missing or mismatched pinned source SHA-256; run dry-run and review both receipts first.'
        );
      }
    }
  }

  const stagingRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-docs-adoption-')
  );
  try {
    const stages = [];
    for (const entry of originals) {
      const docs = contract.platforms[entry.platform];
      if (!docs) {
        throw new Error(entry.platform + ': missing editorial docs contract.');
      }
      const body = readLegacyBody({
        source: entry.source,
        componentName,
        title: docs.title,
        description: docs.description,
        file: entry.file,
      });
      const file = path.join(stagingRoot, entry.platform, slug + '.md');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(
        file,
        createManagedSeed({
          componentName,
          title: docs.title,
          description: docs.description,
          body,
        })
      );
      stages.push({ ...entry, body, file });
    }

    await generateComponentDocs({
      root,
      docsRoot: stagingRoot,
      componentName,
      metadata: [metadata],
      contracts: [contract],
    });

    const entries = [];
    for (const stage of stages) {
      // The staging file lives outside the repository. Canonicalize it using
      // the actual published docs path, including its nearest Prettier config,
      // before either platform can be written into the maintained source tree.
      const actualFile = originals.find(
        (entry) => entry.platform === stage.platform
      )!.file;
      const originalConfig = await prettier.resolveConfig(actualFile);
      const generated = await prettier.format(
        fs.readFileSync(stage.file, 'utf8'),
        {
          ...originalConfig,
          parser: 'markdown',
          filepath: actualFile,
        }
      );
      fs.writeFileSync(stage.file, generated);
      const state = inspectComponentDocAuthority({
        content: generated,
        filePath: stage.file,
      });
      if (state.state !== 'managed') {
        throw new Error(
          stage.file + ': generated output did not prove managed ownership.'
        );
      }
      const region = readAuthoredRegion({
        content: generated,
        filePath: stage.file,
      });
      if (!region.valid || !region.found) {
        throw new Error(stage.file + ': generated authored region is invalid.');
      }
      const expectedAuthor = (
        await prettier.format(stage.body, {
          ...originalConfig,
          parser: 'markdown',
          filepath: actualFile,
        })
      ).trim();
      const emittedAuthor = region.content.trim();
      if (emittedAuthor !== expectedAuthor) {
        throw new Error(
          stage.file +
            ': generated author region differs from the canonical formatting of the complete original editorial body.'
        );
      }
      entries.push({
        platform: stage.platform,
        file: path.relative(root, stage.file).startsWith('..')
          ? path.relative(
              root,
              originals.find((x) => x.platform === stage.platform)!.file
            )
          : path.relative(root, stage.file),
        originalSha256: stage.originalSha256,
        generatedSha256: sha256(generated),
        preservedAuthorSha256: sha256(emittedAuthor),
        preservedAuthorBytes: Buffer.byteLength(emittedAuthor, 'utf8'),
      });
    }

    if (write) {
      // Recheck both files after asynchronous staging and before ANY write.
      // A digest pinned at the beginning of the run is not sufficient when
      // another editor can modify the maintained docs while we generate.
      const assertCurrentSource = (entry: (typeof originals)[number]) => {
        let current: string;
        try {
          current = fs.readFileSync(entry.file, 'utf8');
        } catch {
          throw new Error(
            entry.file +
              ': source changed since SHA-256 validation; refusing to overwrite a missing or unreadable document.'
          );
        }
        if (sha256(current) !== entry.originalSha256 || current !== entry.source) {
          throw new Error(
            entry.file +
              ': source changed since SHA-256 validation; refusing to overwrite concurrent editorial changes.'
          );
        }
      };
      for (const entry of originals) {
        assertCurrentSource(entry);
      }

      // Track only files this invocation actually wrote. During rollback,
      // never replace a different revision that another actor wrote later.
      const written = new Map<string, string>();
      try {
        for (const stage of stages) {
          const target = originals.find(
            (entry) => entry.platform === stage.platform
          )!;
          assertCurrentSource(target);
          const generated = fs.readFileSync(stage.file, 'utf8');
          fs.writeFileSync(target.file, generated);
          written.set(target.file, generated);
        }
        const check = await generateComponentDocs({
          root,
          docsRoot,
          componentName,
          check: true,
          metadata: [metadata],
          contracts: [contract],
        });
        if (check.status !== 'up-to-date') {
          throw new Error(
            componentName + ': generated docs drift immediately after write.'
          );
        }
      } catch (error) {
        const conflicts: string[] = [];
        for (const entry of originals) {
          const ours = written.get(entry.file);
          if (ours === undefined) continue;
          try {
            const current = fs.readFileSync(entry.file, 'utf8');
            if (current !== ours) {
              conflicts.push(entry.file);
              continue;
            }
            fs.writeFileSync(entry.file, entry.source);
          } catch {
            conflicts.push(entry.file);
          }
        }
        if (conflicts.length > 0) {
          throw new Error(
            componentName +
              ': cannot safely roll back documents edited after this migration wrote them: ' +
              conflicts.join(', ') +
              '; original failure: ' +
              String(error)
          );
        }
        throw error;
      }
    } else {
      for (const entry of originals) {
        if (fs.readFileSync(entry.file, 'utf8') !== entry.source) {
          throw new Error(
            entry.file + ': dry-run modified the original source.'
          );
        }
      }
    }

    return {
      component: componentName,
      status: write ? 'adopted' : 'preview',
      entries,
    };
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const name = args.find((arg) => !arg.startsWith('-'));
  const write = args.includes('--write');
  const json = args.includes('--json');
  const allowed = new Set(['--write', '--json', '--dry-run']);
  const unknown = args.filter(
    (arg) =>
      arg.startsWith('--') &&
      !allowed.has(arg) &&
      !arg.startsWith('--expected-react-sha256=') &&
      !arg.startsWith('--expected-react-native-sha256=')
  );
  if (
    !name ||
    unknown.length > 0 ||
    args.filter((arg) => !arg.startsWith('-')).length !== 1
  ) {
    throw new Error(
      'Usage: pnpm component-docs:adopt ComponentName [--dry-run|--write] [--json] ' +
        '[--expected-react-sha256=...] [--expected-react-native-sha256=...]'
    );
  }
  const value = (prefix: string) =>
    args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const proof = await adoptLegacyComponentDocs({
    root: process.cwd(),
    componentName: name,
    write,
    expectedOriginalSha256: {
      react: value('--expected-react-sha256='),
      'react-native': value('--expected-react-native-sha256='),
    },
  });
  if (json) {
    process.stdout.write(JSON.stringify(proof, null, 2) + '\n');
  } else {
    console.log(proof.status + ': ' + name);
    for (const entry of proof.entries) {
      console.log(
        entry.platform +
          ': source ' +
          entry.originalSha256 +
          ', output ' +
          entry.generatedSha256
      );
    }
  }
}

const invoked =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invoked) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
