import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectionScripts = new Map([
  ['component-pages:check', 'check-component-pages.ts'],
  ['component-pages:audit', 'audit-component-pages.ts'],
]);

export function qualityCommands(candidateRoot, toolingRoot) {
  const recipe = JSON.parse(
    fs.readFileSync(path.join(candidateRoot, 'package.json'), 'utf8')
  ).scripts?.['ci:quality'];
  if (typeof recipe !== 'string' || !recipe.trim())
    throw new Error('Candidate quality recipe is missing.');
  const commands = recipe.split('&&').map((part) => {
    const words = part.trim().split(/\s+/);
    if (
      words.length < 2 ||
      words[0] !== 'pnpm' ||
      !words.slice(1).every((word) => /^[a-zA-Z0-9_:.=/-]+$/.test(word))
    ) {
      throw new Error(
        'Unsupported quality recipe; refusing to omit or reinterpret a check.'
      );
    }
    const script = projectionScripts.get(words[1]);
    if (script && words.length !== 2)
      throw new Error(
        'Projection checks require their exact read-only command.'
      );
    return {
      id: words[1],
      command: script
        ? [
            process.execPath,
            '--import',
            path.join(toolingRoot, 'node_modules/tsx/dist/loader.mjs'),
            path.join(toolingRoot, 'scripts/generators/component-page', script),
          ]
        : words,
    };
  });
  for (const id of projectionScripts.keys()) {
    if (commands.filter((command) => command.id === id).length !== 1) {
      throw new Error(
        'Quality recipe must retain each projection gate exactly once.'
      );
    }
  }
  return {
    recipeSha256: createHash('sha256').update(recipe).digest('hex'),
    commands,
  };
}

function verifyCheckout(root, expected) {
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  if (
    !/^[a-f0-9]{40}$/.test(expected ?? '') ||
    git('rev-parse', 'HEAD') !== expected ||
    fs.realpathSync(git('rev-parse', '--show-toplevel')) !==
      fs.realpathSync(root)
  ) {
    throw new Error(
      'Quality checkout differs from its exact candidate or tooling revision.'
    );
  }
  if (git('status', '--porcelain', '--untracked-files=all')) {
    throw new Error('Quality checkout has uncommitted source changes.');
  }
}

export function runCandidateQuality({
  candidateRoot,
  toolingRoot,
  candidateSha,
  toolingSha,
  runner = spawnSync,
}) {
  const verify = () => {
    verifyCheckout(candidateRoot, candidateSha);
    verifyCheckout(toolingRoot, toolingSha);
  };
  verify();
  const plan = qualityCommands(candidateRoot, toolingRoot);
  const evidence = {
    schemaVersion: 1,
    candidateSha,
    toolingSha,
    recipeSha256: plan.recipeSha256,
    commands: [],
    status: 'failed',
  };
  for (const { id, command } of plan.commands) {
    const result = runner(command[0], command.slice(1), {
      cwd: candidateRoot,
      stdio: 'inherit',
    });
    verify();
    const exitCode = result.status ?? 1;
    evidence.commands.push({ id, command, exitCode });
    if (exitCode !== 0) return { exitCode, evidence };
  }
  evidence.status = 'passed';
  return { exitCode: 0, evidence };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const result = runCandidateQuality({
      candidateRoot: process.cwd(),
      toolingRoot: fileURLToPath(new URL('../../', import.meta.url)),
      candidateSha: process.env.VELLIRA_CANDIDATE_SHA,
      toolingSha: process.env.VELLIRA_CI_TOOLING_SHA,
    });
    const output = path.resolve('.artifacts/ci-quality/evidence.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(result.evidence, null, 2)}\n`);
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
