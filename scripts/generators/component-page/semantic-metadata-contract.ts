import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  CANONICAL_RELATED_COMPONENT_CONSTRAINTS,
  assertCanonicalComponentSlug,
  canonicalComponentSlugsFromEntries,
} from '../../../apps/website/src/component-catalog/registry/componentIdentity';
import { webComponents } from '../../../apps/website/src/component-catalog/registry/components';
import { slugify } from './helpers/format';

export const SEMANTIC_METADATA_CONTRACT_SCHEMA_VERSION = '1' as const;
export const METADATA_SCHEMA_PATH =
  'apps/website/src/component-catalog/metadata.ts';
export const COMPONENT_REGISTRY_PATH =
  'apps/website/src/component-catalog/registry/components.ts';
export const SEMANTIC_METADATA_CONTRACT_COMMAND = [
  'pnpm',
  '--silent',
  'component-page:semantic-metadata:json',
] as const;

const MAX_SOURCE_BYTES = 512 * 1024;

type CanonicalComponentEntry = {
  slug: string;
};

export type SemanticMetadataContract = {
  schemaVersion: typeof SEMANTIC_METADATA_CONTRACT_SCHEMA_VERSION;
  schemaPath: typeof METADATA_SCHEMA_PATH;
  metadataSchemaPath: typeof METADATA_SCHEMA_PATH;
  schemaSha256: string;
  schema: string;
  relatedComponentRegistry: {
    path: typeof COMPONENT_REGISTRY_PATH;
    sha256: string;
    slugs: string[];
  };
  sourceComponent: {
    name: string;
    slug: string;
    isCanonical: boolean;
  };
  constraints: typeof CANONICAL_RELATED_COMPONENT_CONSTRAINTS;
};

export function buildSemanticMetadataContract(params: {
  root?: string;
  componentName: string;
  components?: readonly CanonicalComponentEntry[];
}): SemanticMetadataContract {
  if (!params.componentName.trim()) {
    throw new Error('Semantic metadata contract requires a component name.');
  }

  const root = path.resolve(params.root ?? process.cwd());
  const schema = readCanonicalSource(
    root,
    METADATA_SCHEMA_PATH,
    'metadata schema'
  );
  const registry = readCanonicalSource(
    root,
    COMPONENT_REGISTRY_PATH,
    'component registry'
  );
  const slugs = canonicalComponentSlugsFromEntries(
    params.components ?? webComponents
  );
  const sourceSlug = slugify(params.componentName);
  assertCanonicalComponentSlug(sourceSlug, 'source component');

  return {
    schemaVersion: SEMANTIC_METADATA_CONTRACT_SCHEMA_VERSION,
    schemaPath: METADATA_SCHEMA_PATH,
    metadataSchemaPath: METADATA_SCHEMA_PATH,
    schemaSha256: sha256(schema.bytes),
    schema: schema.text,
    relatedComponentRegistry: {
      path: COMPONENT_REGISTRY_PATH,
      sha256: sha256(registry.bytes),
      slugs,
    },
    sourceComponent: {
      name: params.componentName,
      slug: sourceSlug,
      isCanonical: slugs.includes(sourceSlug),
    },
    constraints: CANONICAL_RELATED_COMPONENT_CONSTRAINTS,
  };
}

type SemanticMetadataContractCliDependencies = {
  root?: string;
  build?: typeof buildSemanticMetadataContract;
  write?: (message: string) => void;
  writeError?: (message: string) => void;
};

export function runSemanticMetadataContractCli(
  args: readonly string[],
  dependencies: SemanticMetadataContractCliDependencies = {}
) {
  const write = dependencies.write ?? console.log;
  const writeError = dependencies.writeError ?? console.error;

  try {
    const componentName = parseArgs(args);
    const contract = (dependencies.build ?? buildSemanticMetadataContract)({
      root: dependencies.root,
      componentName,
    });

    write(JSON.stringify(contract, null, 2));
    return 0;
  } catch (error) {
    writeError(
      JSON.stringify(
        {
          schemaVersion: SEMANTIC_METADATA_CONTRACT_SCHEMA_VERSION,
          status: 'error',
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        },
        null,
        2
      )
    );

    return 2;
  }
}

function parseArgs(args: readonly string[]) {
  let componentName: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--component') {
      const value = args[index + 1];

      if (!value || value.startsWith('--')) {
        throw new Error('Expected a component name after --component.');
      }

      if (componentName) {
        throw new Error('Provide --component exactly once.');
      }

      componentName = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown semantic metadata contract option "${arg}".`);
  }

  if (!componentName) {
    throw new Error(
      'Usage: pnpm component-page:semantic-metadata:json --component <ComponentName>'
    );
  }

  return componentName;
}

function readCanonicalSource(root: string, relativePath: string, kind: string) {
  const candidate = path.resolve(root, relativePath);

  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Canonical ${kind} path escapes the repository root.`);
  }

  let stat: fs.Stats;
  let bytes: Buffer;

  try {
    stat = fs.lstatSync(candidate);

    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Canonical ${kind} is not a regular file.`);
    }

    bytes = fs.readFileSync(candidate);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Canonical ')) {
      throw error;
    }

    throw new Error(`Unable to read canonical ${kind}.`);
  }

  if (bytes.byteLength > MAX_SOURCE_BYTES) {
    throw new Error(
      `Canonical ${kind} exceeds the bounded contract input size.`
    );
  }

  let text: string;

  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`Canonical ${kind} is not valid UTF-8.`);
  }

  return { bytes, text };
}

function sha256(bytes: Buffer) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = runSemanticMetadataContractCli(process.argv.slice(2));
}
