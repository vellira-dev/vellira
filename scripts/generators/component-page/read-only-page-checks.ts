import { spawn } from 'node:child_process';

export type ReadOnlyPageCheck = {
  componentName: string;
  executable: string;
  args: string[];
};

export type ReadOnlyPageCheckResult = {
  componentName: string;
  status: number;
  stdout: string;
  stderr: string;
};

function executeReadOnlyCheck(
  job: ReadOnlyPageCheck
): Promise<ReadOnlyPageCheckResult> {
  return new Promise((resolve) => {
    const child = spawn(job.executable, job.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let spawnError: string | null = null;

    child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', (error) => {
      spawnError = error.message;
    });
    child.on('close', (code) => {
      const capturedError = Buffer.concat(stderr).toString('utf8');
      resolve({
        componentName: job.componentName,
        status: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: spawnError ? `${capturedError}\n${spawnError}` : capturedError,
      });
    });
  });
}

/**
 * A bounded, read-only alternative to sequential generator check subprocesses.
 * Every component is still checked; results are returned in input order,
 * independent of completion order. Write/generate mode must not use this.
 */
export async function runReadOnlyComponentPageChecks(
  jobs: readonly ReadOnlyPageCheck[],
  {
    concurrency = 2,
    execute = executeReadOnlyCheck,
  }: {
    concurrency?: number;
    execute?: (job: ReadOnlyPageCheck) => Promise<ReadOnlyPageCheckResult>;
  } = {}
): Promise<ReadOnlyPageCheckResult[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 2) {
    throw new Error('Read-only page check concurrency must be 1 or 2.');
  }
  if (
    jobs.some(
      (job) =>
        !job.componentName ||
        !job.executable ||
        !job.args.includes('--check')
    )
  ) {
    throw new Error('Parallel component page jobs must be read-only checks.');
  }

  const results = new Array<ReadOnlyPageCheckResult>(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
      while (next < jobs.length) {
        const index = next++;
        results[index] = await execute(jobs[index]!);
      }
    })
  );

  return results;
}
