import { spawnSync } from 'node:child_process';

function fail(message) {
  throw new Error(`Affected workspace runner: ${message}`);
}

export function parseAffectedWorkspaces(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw ?? '');
  } catch {
    fail('VELLIRA_AFFECTED_WORKSPACES must be valid JSON');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    fail('VELLIRA_AFFECTED_WORKSPACES must be a non-empty array');
  }

  const workspaces = [];
  const seen = new Set();
  for (const value of parsed) {
    if (typeof value !== 'string' || value.length === 0 || /[\0\r\n]/u.test(value)) {
      fail('workspace names must be non-empty single-line strings');
    }
    if (seen.has(value)) continue;
    seen.add(value);
    workspaces.push(value);
  }

  return workspaces;
}

export function buildTurboArgs(tasks, workspaces) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    fail('at least one Turbo task is required');
  }
  for (const task of tasks) {
    if (!/^[a-zA-Z0-9:_-]+$/u.test(task)) {
      fail(`invalid Turbo task: ${task}`);
    }
  }

  return [
    'exec',
    'turbo',
    'run',
    ...tasks,
    ...workspaces.map((workspace) => `--filter=${workspace}`),
  ];
}

function main() {
  const tasks = process.argv.slice(2);
  const workspaces = parseAffectedWorkspaces(process.env.VELLIRA_AFFECTED_WORKSPACES);
  const args = buildTurboArgs(tasks, workspaces);
  const result = spawnSync('pnpm', args, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.signal) fail(`pnpm was terminated by ${result.signal}`);
  process.exitCode = result.status ?? 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
