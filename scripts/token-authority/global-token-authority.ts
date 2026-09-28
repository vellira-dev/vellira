import { pathToFileURL } from 'node:url';

import {
  baseTokenPaths,
  colorTokenPaths,
  semanticTokenPaths,
} from '../../packages/tokens/src/generated/token-types';

export const GLOBAL_TOKEN_AUTHORITY_SCHEMA_VERSION = '1' as const;
export const GLOBAL_TOKEN_AUTHORITY_SOURCE_ARTIFACT =
  'packages/tokens/src/generated/token-types.ts' as const;

export type GlobalTokenAuthorityContract = {
  schemaVersion: typeof GLOBAL_TOKEN_AUTHORITY_SCHEMA_VERSION;
  sourceArtifact: typeof GLOBAL_TOKEN_AUTHORITY_SOURCE_ARTIFACT;
  reactNativeThemePaths: string[];
};

type TokenPathGroup = {
  name: string;
  prefix: 'tokens.' | 'colors.' | 'semantic.';
  values: readonly string[];
};

const tokenPathGroups: readonly TokenPathGroup[] = [
  {
    name: 'baseTokenPaths',
    prefix: 'tokens.',
    values: baseTokenPaths,
  },
  {
    name: 'colorTokenPaths',
    prefix: 'colors.',
    values: colorTokenPaths,
  },
  {
    name: 'semanticTokenPaths',
    prefix: 'semantic.',
    values: semanticTokenPaths,
  },
];

export function buildGlobalTokenAuthorityContract(): GlobalTokenAuthorityContract {
  const logicalPaths: string[] = [];

  for (const group of tokenPathGroups) {
    if (group.values.length === 0) {
      throw new Error(
        `Canonical global-token authority export ${group.name} must not be empty.`
      );
    }

    const seen = new Set<string>();

    for (const value of group.values) {
      if (
        typeof value !== 'string' ||
        value.length === 0 ||
        !value.startsWith(group.prefix)
      ) {
        throw new Error(
          `Canonical global-token authority export ${group.name} contains an invalid path.`
        );
      }

      if (seen.has(value)) {
        throw new Error(
          `Canonical global-token authority export ${group.name} contains duplicates.`
        );
      }

      seen.add(value);
      logicalPaths.push(value);
    }
  }

  const reactNativeThemePaths = logicalPaths
    .map((value) => `theme.${value}`)
    .sort();

  if (reactNativeThemePaths.length !== new Set(reactNativeThemePaths).size) {
    throw new Error(
      'Canonical global-token authority contains duplicate React Native theme paths.'
    );
  }

  return {
    schemaVersion: GLOBAL_TOKEN_AUTHORITY_SCHEMA_VERSION,
    sourceArtifact: GLOBAL_TOKEN_AUTHORITY_SOURCE_ARTIFACT,
    reactNativeThemePaths,
  };
}

type GlobalTokenAuthorityCliDependencies = {
  build?: typeof buildGlobalTokenAuthorityContract;
  write?: (message: string) => void;
  writeError?: (message: string) => void;
};

export function runGlobalTokenAuthorityCli(
  args: readonly string[],
  dependencies: GlobalTokenAuthorityCliDependencies = {}
) {
  const write = dependencies.write ?? console.log;
  const writeError = dependencies.writeError ?? console.error;

  try {
    if (args.length > 0) {
      throw new Error(`Unknown global-token authority option "${args[0]}".`);
    }

    const contract = (dependencies.build ?? buildGlobalTokenAuthorityContract)();

    write(JSON.stringify(contract));
    return 0;
  } catch (error) {
    writeError(
      JSON.stringify({
        schemaVersion: GLOBAL_TOKEN_AUTHORITY_SCHEMA_VERSION,
        status: 'error',
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      })
    );
    return 2;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = runGlobalTokenAuthorityCli(process.argv.slice(2));
}
