import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ComponentPlatform } from '@vellira-ui/metadata';

import { componentDocsContracts } from '../../../apps/docs/src/component-docs';
import { componentMetadata } from '../../../packages/metadata/src/components';

import { readAuthoredRegion } from './authored-region';
import { generatedComponentDocsHeader } from './render';

export type DocsAdoptionState =
  'missing' | 'legacy' | 'managed' | 'invalid-markers' | 'untrusted-markers';

export type DocsAdoptionInspection = {
  state: DocsAdoptionState;
  sourceSha256?: string;
  bytes?: number;
  errors: string[];
};

export function inspectComponentDocAuthority(params: {
  content: string | undefined;
  filePath: string;
}): DocsAdoptionInspection {
  const { content, filePath } = params;

  if (content === undefined) {
    return { state: 'missing', errors: [] };
  }

  const evidence = {
    sourceSha256: createHash('sha256').update(content).digest('hex'),
    bytes: Buffer.byteLength(content, 'utf8'),
  };
  const region = readAuthoredRegion({ content, filePath });

  if (!region.valid) {
    return { state: 'invalid-markers', ...evidence, errors: region.errors };
  }

  const generated = content.includes(generatedComponentDocsHeader);

  if (region.found && !generated) {
    return {
      state: 'untrusted-markers',
      ...evidence,
      errors: [
        filePath +
          ' has authored markers but no generated docs ownership header.',
      ],
    };
  }

  if (!region.found && generated) {
    return {
      state: 'invalid-markers',
      ...evidence,
      errors: [
        filePath +
          ' has a generated docs header but no authored region markers.',
      ],
    };
  }

  if (region.found) {
    return { state: 'managed', ...evidence, errors: [] };
  }

  return {
    state: 'legacy',
    ...evidence,
    errors: [
      filePath +
        ' contains legacy authored documentation without an ownership region.'
    ],
  };
}

export type DocsAdoptionEntry = {
  component: string;
  platform: ComponentPlatform;
  file: string;
  state: DocsAdoptionState;
  hasDocsContract: boolean;
  sourceSha256?: string;
  bytes?: number;
  errors: string[];
};

/**
 * Read-only audit for #1136. No Markdown is rewritten, normalized, or moved.
 * SHA-256 evidence allows PR reviewers to compare with the original document.
 */
export function auditLegacyComponentDocs(params: {
  root: string;
  componentName?: string;
}): DocsAdoptionEntry[] {
  const { root, componentName } = params;
  const names = new Set(componentMetadata.map((item) => item.name));

  if (componentName && !names.has(componentName)) {
    throw new Error('Unknown canonical component: ' + componentName);
  }

  const metadata = componentMetadata.filter(
    (item) => !componentName || item.name === componentName
  );
  const contracts = new Set(
    componentDocsContracts.map((contract) => contract.component)
  );
  const results: DocsAdoptionEntry[] = [];

  for (const component of metadata) {
    for (const platform of component.platforms) {
      const slug = component.name
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase();
      const relativePath = path.posix.join(
        'apps',
        'docs',
        'src',
        platform,
        slug + '.md'
      );
      const sourcePath = path.join(root, relativePath);
      const content = fs.existsSync(sourcePath)
        ? fs.readFileSync(sourcePath, 'utf8')
        : undefined;
      const inspection = inspectComponentDocAuthority({
        content,
        filePath: relativePath,
      });

      results.push({
        component: component.name,
        platform,
        file: relativePath,
        state: inspection.state,
        hasDocsContract: contracts.has(component.name),
        sourceSha256: inspection.sourceSha256,
        bytes: inspection.bytes,
        errors: inspection.errors,
      });
    }
  }

  return results.sort(
    (a, b) =>
      a.component.localeCompare(b.component) ||
      a.platform.localeCompare(b.platform)
  );
}

function main() {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const names = args.filter((arg) => !arg.startsWith('-'));
  const unknownFlags = args.filter(
    (arg) => arg.startsWith('-') && arg !== '--json'
  );

  if (names.length > 1 || unknownFlags.length > 0) {
    throw new Error(
      'Usage: pnpm component-docs:adoption-audit [ComponentName] [--json]'
    );
  }

  const entries = auditLegacyComponentDocs({
    root: process.cwd(),
    componentName: names[0],
  });

  if (isJson) {
    console.log(JSON.stringify({ schemaVersion: '1', entries }, null, 2));
    return;
  }

  console.log('Vellira legacy docs adoption audit (read-only):');

  for (const entry of entries) {
    const contract = entry.hasDocsContract ? 'contract' : 'needs contract';
    console.log(
      entry.component +
        ' ' +
        entry.platform +
        ': ' +
        entry.state +
        ' (' +
        contract +
        ')'
    );
  }

  console.log(
    'No files changed. Review legacy content and docs authority before adoption.'
  );
}

const isCli =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
