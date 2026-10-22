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

type RunOptions = {
  concurrency?: number;
  execute?: (job: ReadOnlyPageCheck) => Promise<ReadOnlyPageCheckResult>;
};

function executeReadOnlyCheck(
  job: ReadOnlyPageCheck
): Promise<ReadOnlyPageCheckResult> {
  return new Promise((resolve) => {
    const child = spawn(job.executable, job.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      stderr += error.message;
    });
    child.on('close', (code) => {
      resolve({
        componentName: job.componentName,
        status: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Run all read-only generator checks with bounded concurrency.
 * Preserve input order for human and JSON output. Generation is sequential.
 */
export async function runReadOnlyComponentPageChecks(
  jobs: readonly ReadOnlyPageCheck[],
  options: RunOptions = {}
): Promise<ReadOnlyPageCheckResult[]> {
  const { concurrency = 2, execute = executeReadOnlyCheck } = options;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 2) {
    throw new Error('Read-only page check concurrency must be 1 or 2.');
  }

  for (const job of jobs) {
    if (
      !job.componentName ||
      !job.executable ||
      !job.args.includes('--check')
    ) {
      throw new Error('Parallel component page jobs must be read-only checks.');
    }
  }

  const results = new Array<ReadOnlyPageCheckResult>(jobs.length);
  let next = 0;
  const workerCount = Math.min(concurrency, jobs.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (next < jobs.length) {
      const index = next++;
      results[index] = await execute(jobs[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}
