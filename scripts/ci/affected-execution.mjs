import fs from 'node:fs/promises';

const DEFAULT_CONFIG = '.github/ci-performance-budget.json';

function normalizePath(file) {
  return file.replaceAll('\\', '/');
}

export function classifyFiles(files, classification) {
  if (files.length === 0) return 'normal';

  const normalizedFiles = files.map(normalizePath);
  const docsOnly = normalizedFiles.every((file) => {
    const basename = file.split('/').at(-1) ?? file;
    return (
      classification.docsPrefixes.some((prefix) => file.startsWith(prefix)) ||
      classification.docsBasenames.includes(basename) ||
      classification.docsExtensions.some((extension) =>
        file.toLowerCase().endsWith(extension.toLowerCase())
      )
    );
  });
  if (docsOnly) return 'docs-only';

  if (
    normalizedFiles.some((file) =>
      classification.sharedPrefixes.some((prefix) => file.startsWith(prefix))
    )
  ) {
    return 'shared';
  }

  const packageMatches = normalizedFiles.map((file) => file.match(/^packages\/([^/]+)\//));
  if (packageMatches.every(Boolean)) {
    const packages = new Set(packageMatches.map((match) => match[1]));
    if (packages.size === 1) return 'package-local';
  }

  return 'normal';
}

export function packageNameForFiles(files) {
  if (files.length === 0) return null;

  const matches = files
    .map(normalizePath)
    .map((file) => file.match(/^packages\/([^/]+)\//));
  if (!matches.every(Boolean)) return null;

  const packages = new Set(matches.map((match) => match[1]));
  return packages.size === 1 ? [...packages][0] : null;
}

export function planAffectedExecution(files, classification) {
  const shape = classifyFiles(files, classification);
  const packageName = shape === 'package-local' ? packageNameForFiles(files) : null;
  const executionPath = shape === 'docs-only' || shape === 'package-local' ? 'affected' : 'full';

  return {
    shape,
    executionPath,
    packageName,
    changedFiles: files.map(normalizePath),
  };
}

export async function loadClassificationConfig(configPath = DEFAULT_CONFIG) {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const classification = config.classification;

  if (
    !classification ||
    !Array.isArray(classification.sharedPrefixes) ||
    !Array.isArray(classification.docsPrefixes) ||
    !Array.isArray(classification.docsBasenames) ||
    !Array.isArray(classification.docsExtensions)
  ) {
    throw new Error(`Invalid CI impact classification config: ${configPath}`);
  }

  return classification;
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

async function writeGithubOutputs(plan) {
  if (!process.env.GITHUB_OUTPUT) return;

  const lines = [
    `shape=${plan.shape}`,
    `execution_path=${plan.executionPath}`,
    `package_name=${plan.packageName ?? ''}`,
  ];
  await fs.appendFile(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const filesFile = argumentValue(args, '--files-file');
  if (!filesFile) {
    throw new Error('Usage: node scripts/ci/affected-execution.mjs --files-file <path> [--config <path>]');
  }

  const configPath = argumentValue(args, '--config') ?? DEFAULT_CONFIG;
  const files = (await fs.readFile(filesFile, 'utf8'))
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
  const classification = await loadClassificationConfig(configPath);
  const plan = planAffectedExecution(files, classification);

  await writeGithubOutputs(plan);
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
