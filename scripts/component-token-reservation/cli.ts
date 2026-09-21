import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { createComponentTokenReservationGitHubClient } from './github';
import { runComponentTokenReservation } from './orchestrator';

type CliDependencies = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdout?: Pick<NodeJS.WriteStream, 'write'>;
  stderr?: Pick<NodeJS.WriteStream, 'write'>;
};

export async function runComponentTokenReservationCli(
  argv: readonly string[],
  dependencies: CliDependencies = {}
) {
  const env = dependencies.env ?? process.env;
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  try {
    const options = parseArguments(argv);
    const token = env.GITHUB_TOKEN ?? '';
    const writeToken = env.GITHUB_WRITE_TOKEN ?? '';
    const result = await runComponentTokenReservation({
      root: path.resolve(dependencies.cwd ?? process.cwd()),
      repository: options.repository,
      sourceRevision: options.sourceRevision,
      issueNumber: options.issueNumber,
      apply: options.apply,
      client: createComponentTokenReservationGitHubClient({
        repository: options.repository,
        token,
        writeToken,
      }),
    });
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    stderr.write(
      `${JSON.stringify({
        schemaVersion: '1',
        status: 'error',
        action: 'rejected',
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      })}\n`
    );
    return 2;
  }
}

function parseArguments(argv: readonly string[]) {
  let repository = '';
  let sourceRevision = '';
  let issueNumber = 0;
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--apply') apply = true;
    else if (value === '--repo') repository = argv[++index] ?? '';
    else if (value === '--source-revision')
      sourceRevision = argv[++index] ?? '';
    else if (value === '--issue-number')
      issueNumber = Number(argv[++index] ?? '');
    else
      throw new Error(`Unknown component-token reservation option: ${value}`);
  }
  if (
    !repository ||
    !sourceRevision ||
    !Number.isInteger(issueNumber) ||
    issueNumber < 1
  )
    throw new Error(
      'Usage: component-token-reservation:json --repo owner/name --source-revision <sha> --issue-number <number> [--apply]'
    );
  return { repository, sourceRevision, issueNumber, apply };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await runComponentTokenReservationCli(
    process.argv.slice(2)
  );
}
