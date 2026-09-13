import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseCandidateSnapshot } from './candidate-snapshot';

import {
  COMPONENT_PRODUCTION_SCHEMA_VERSION,
  type ComponentProductionValidationResultV1,
} from './contracts';
import { runComponentProductionValidation } from './run';

type ComponentProductionValidationCliOptions = {
  specFile: string;
  candidateSnapshotFile?: string;
};

type ComponentProductionValidationRunner = (
  params: Parameters<typeof runComponentProductionValidation>[0]
) => Promise<ComponentProductionValidationResultV1>;

export type ComponentProductionValidationCliDependencies = {
  root?: string;
  readFile?: (filePath: string) => string;
  runValidation?: ComponentProductionValidationRunner;
  write?: (message: string) => void;
  writeError?: (message: string) => void;
};

export async function runComponentProductionValidationCli(
  args: readonly string[],
  dependencies: ComponentProductionValidationCliDependencies = {}
): Promise<number> {
  const write = dependencies.write ?? console.log;
  const writeError = dependencies.writeError ?? console.error;

  try {
    const options = parseArgs(args);
    const root = path.resolve(dependencies.root ?? process.cwd());

    const readFile =
      dependencies.readFile ??
      ((filePath: string) => fs.readFileSync(filePath, 'utf8'));

    const runValidation =
      dependencies.runValidation ?? runComponentProductionValidation;

    const specPath = path.resolve(root, options.specFile);

    let rawInput: unknown;

    try {
      rawInput = JSON.parse(readFile(specPath));
    } catch (error) {
      throw new Error(
        `Unable to read component production specification "${options.specFile}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    let candidateSnapshot;
    if (options.candidateSnapshotFile !== undefined) {
      try {
        candidateSnapshot = parseCandidateSnapshot(
          JSON.parse(
            readFile(path.resolve(root, options.candidateSnapshotFile))
          )
        );
      } catch (error) {
        throw new Error(
          `Unable to read candidate snapshot "${options.candidateSnapshotFile}": ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    const result = await runValidation({
      root,
      input: rawInput,
      ...(candidateSnapshot === undefined ? {} : { candidateSnapshot }),
    });

    write(JSON.stringify(result, null, 2));

    if (result.status === 'ready') {
      return 0;
    }

    if (result.status === 'blocked') {
      return 1;
    }

    return 2;
  } catch (error) {
    writeError(
      JSON.stringify(
        {
          schemaVersion: COMPONENT_PRODUCTION_SCHEMA_VERSION,
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

function parseArgs(
  args: readonly string[]
): ComponentProductionValidationCliOptions {
  let specFile: string | undefined;
  let candidateSnapshotFile: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--candidate-snapshot') {
      const value = args[index + 1];
      if (!value || value.startsWith('--'))
        throw new Error('Expected a file path after --candidate-snapshot.');
      if (candidateSnapshotFile !== undefined)
        throw new Error('Provide --candidate-snapshot exactly once.');
      candidateSnapshotFile = value;
      index += 1;
      continue;
    }

    if (arg === '--spec') {
      const value = args[index + 1];

      if (!value || value.startsWith('--')) {
        throw new Error('Expected a file path after --spec.');
      }

      if (specFile) {
        throw new Error('Provide --spec exactly once.');
      }

      specFile = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown component production validation option "${arg}".`);
  }

  if (!specFile) {
    throw new Error(
      'Usage: pnpm component-production:validate:json --spec <component-spec.json>'
    );
  }

  return {
    specFile,
    ...(candidateSnapshotFile === undefined ? {} : { candidateSnapshotFile }),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await runComponentProductionValidationCli(
    process.argv.slice(2)
  );
}
