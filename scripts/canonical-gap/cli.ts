import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createGitHubCanonicalGapClient } from './github';
import {
  applyCanonicalGaps,
  canonicalGapRequestsFromUiUsageReport,
  runCanonicalGapPlan,
} from './orchestrator';
import { canonicalGapRequestsFromComponentProductionReport } from './production-adapter';
import {
  CANONICAL_GAP_SCHEMA_VERSION,
  CanonicalGapError,
  parseCanonicalGapBatch,
  type CanonicalGapIssueClient,
  type CanonicalGapRunResultV1,
} from './types';

export type CanonicalGapCliDependencies = {
  root?: string;
  token?: string;
  readFile?: (filePath: string) => string;
  createClient?: (
    repository: string,
    token?: string
  ) => CanonicalGapIssueClient;
  write?: (message: string) => void;
  writeError?: (message: string) => void;
};

export async function runCanonicalGapCli(
  args: readonly string[],
  dependencies: CanonicalGapCliDependencies = {}
): Promise<number> {
  const write = dependencies.write ?? console.log;
  const writeError = dependencies.writeError ?? console.error;

  try {
    const options = parseArgs(args);
    const root = path.resolve(dependencies.root ?? process.cwd());
    const readFile =
      dependencies.readFile ??
      ((filePath: string) => fs.readFileSync(filePath, 'utf8'));
    const createClient =
      dependencies.createClient ??
      ((repository: string, token?: string) =>
        createGitHubCanonicalGapClient({ repository, token }));
    const token = dependencies.token ?? process.env.GITHUB_TOKEN;
    if (options.apply && !token?.trim()) {
      throw new CanonicalGapError(
        'GITHUB_TOKEN is required for canonical gap apply mode.'
      );
    }
    const sourcePath = path.resolve(root, options.sourcePath);
    const raw = JSON.parse(readFile(sourcePath)) as unknown;
    const batch =
      options.sourceKind === 'report'
        ? canonicalGapRequestsFromUiUsageReport(raw, {
            launchCritical: options.launchCritical,
          })
        : options.sourceKind === 'production-report'
          ? canonicalGapRequestsFromComponentProductionReport(raw, {
              launchCritical: options.launchCritical,
            })
          : parseCanonicalGapBatch(raw);
    const client = createClient(options.repository, token);
    const result: CanonicalGapRunResultV1 = options.apply
      ? await applyCanonicalGaps(batch.requests, client)
      : await runCanonicalGapPlan(batch.requests, client);

    write(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    writeError(
      JSON.stringify(
        {
          schemaVersion: CANONICAL_GAP_SCHEMA_VERSION,
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

type CliSourceKind = 'spec' | 'report' | 'production-report';

type CliOptions = {
  repository: string;
  sourceKind: CliSourceKind;
  sourcePath: string;
  apply: boolean;
  launchCritical: boolean;
};

function parseArgs(args: readonly string[]): CliOptions {
  let repository: string | null = null;
  let sourceKind: CliSourceKind | null = null;
  let sourcePath: string | null = null;
  let apply = false;
  let launchCritical = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--repo') {
      repository = requiredArgument(args, ++index, '--repo');
    } else if (argument === '--spec') {
      assertNoSource(sourceKind);
      sourceKind = 'spec';
      sourcePath = requiredArgument(args, ++index, '--spec');
    } else if (argument === '--report') {
      assertNoSource(sourceKind);
      sourceKind = 'report';
      sourcePath = requiredArgument(args, ++index, '--report');
    } else if (argument === '--production-report') {
      assertNoSource(sourceKind);
      sourceKind = 'production-report';
      sourcePath = requiredArgument(args, ++index, '--production-report');
    } else if (argument === '--apply') {
      apply = true;
    } else if (argument === '--launch-critical') {
      launchCritical = true;
    } else {
      throw new CanonicalGapError(
        `Unknown canonical gap argument "${argument}".`
      );
    }
  }

  if (!repository) {
    throw new CanonicalGapError(
      'Canonical gap CLI requires --repo owner/name.'
    );
  }
  if (!sourceKind || !sourcePath) {
    throw new CanonicalGapError(
      'Canonical gap CLI requires exactly one of --spec, --report, or --production-report.'
    );
  }

  return {
    repository,
    sourceKind,
    sourcePath,
    apply,
    launchCritical,
  };
}

function requiredArgument(
  args: readonly string[],
  index: number,
  flag: string
): string {
  const value = args[index];
  if (!value || value.startsWith('--')) {
    throw new CanonicalGapError(`${flag} requires a value.`);
  }
  return value;
}

function assertNoSource(sourceKind: CliSourceKind | null) {
  if (sourceKind) {
    throw new CanonicalGapError(
      'Canonical gap CLI accepts exactly one source input.'
    );
  }
}

const currentModule = pathToFileURL(process.argv[1] ?? '').href;
if (import.meta.url === currentModule) {
  process.exitCode = await runCanonicalGapCli(process.argv.slice(2));
}
