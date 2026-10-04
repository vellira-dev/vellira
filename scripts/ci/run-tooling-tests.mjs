import { createToolingTasks, runToolingTasks } from './tooling-execution.mjs';

process.exitCode = await runToolingTasks(
  createToolingTasks({
    candidateRoot: process.cwd(),
    profile: process.argv[2],
    environment: process.env,
  })
);
