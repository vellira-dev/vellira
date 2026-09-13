import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CONFIG = '.github/ci-performance-budget.json';
const WORKSPACE_GROUPS = ['packages', 'apps'];
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

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

export function resolveWorkspaceImpact(workspaces, packageDirectoryName) {
  const targetPath = `packages/${packageDirectoryName}`;
  const target = workspaces.find((workspace) => workspace.path === targetPath);
  if (!target) {
    throw new Error(`Workspace graph does not contain ${targetPath}`);
  }

  const byName = new Map();
  for (const workspace of workspaces) {
    if (!workspace.name || byName.has(workspace.name)) {
      throw new Error(`Invalid or duplicate workspace name at ${workspace.path}`);
    }
    byName.set(workspace.name, workspace);
  }

  const selected = new Set([target.name]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const workspace of workspaces) {
      if (selected.has(workspace.name)) continue;
      const dependsOnSelected = workspace.dependencies.some((dependency) =>
        selected.has(dependency)
      );
      if (dependsOnSelected) {
        selected.add(workspace.name);
        changed = true;
      }
    }
  }

  const affected = [...selected]
    .map((name) => byName.get(name))
    .filter(Boolean)
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    workspaceNames: affected.map((workspace) => workspace.name),
    workspacePaths: affected.map((workspace) => workspace.path),
  };
}

export function planAffectedExecution(files, classification, packageImpact = null) {
  const shape = classifyFiles(files, classification);
  const packageName = shape === 'package-local' ? packageNameForFiles(files) : null;

  let executionPath = shape === 'docs-only' ? 'affected' : 'full';
  let graphStatus = 'not-applicable';
  let graphReason = '';
  let affectedWorkspaces = [];
  let affectedWorkspacePaths = [];

  if (shape === 'package-local') {
    if (packageImpact?.resolved) {
      executionPath = 'affected';
      graphStatus = 'resolved';
      affectedWorkspaces = packageImpact.workspaceNames;
      affectedWorkspacePaths = packageImpact.workspacePaths;
    } else {
      graphStatus = 'fallback';
      graphReason = packageImpact?.reason ?? 'workspace graph was not resolved';
    }
  }

  return {
    shape,
    executionPath,
    packageName,
    graphStatus,
    graphReason,
    affectedWorkspaces,
    affectedWorkspacePaths,
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

export async function loadWorkspaceGraph(root = '.') {
  const manifests = [];

  for (const group of WORKSPACE_GROUPS) {
    const groupPath = path.resolve(root, group);
    const entries = await fs.readdir(groupPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const workspacePath = `${group}/${entry.name}`;
      const manifestPath = path.join(groupPath, entry.name, 'package.json');

      let manifest;
      try {
        manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      } catch (error) {
        if (error?.code === 'ENOENT') continue;
        throw error;
      }

      if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
        throw new Error(`Workspace manifest is missing a name: ${workspacePath}/package.json`);
      }

      manifests.push({
        name: manifest.name,
        path: workspacePath,
        manifest,
      });
    }
  }

  const workspaceNames = new Set(manifests.map((workspace) => workspace.name));
  if (workspaceNames.size !== manifests.length) {
    throw new Error('Workspace graph contains duplicate package names');
  }

  return manifests.map(({ name, path: workspacePath, manifest }) => {
    const dependencies = new Set();
    for (const field of DEPENDENCY_FIELDS) {
      const entries = manifest[field] ?? {};
      for (const dependencyName of Object.keys(entries)) {
        if (workspaceNames.has(dependencyName)) {
          dependencies.add(dependencyName);
        }
      }
    }

    return {
      name,
      path: workspacePath,
      dependencies: [...dependencies].sort(),
    };
  });
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
    `graph_status=${plan.graphStatus}`,
    `graph_reason=${plan.graphReason}`,
    `affected_workspaces=${JSON.stringify(plan.affectedWorkspaces)}`,
    `affected_workspace_paths=${JSON.stringify(plan.affectedWorkspacePaths)}`,
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

  const shape = classifyFiles(files, classification);
  const packageName = shape === 'package-local' ? packageNameForFiles(files) : null;
  let packageImpact = null;

  if (shape === 'package-local' && packageName) {
    try {
      const workspaces = await loadWorkspaceGraph('.');
      const impact = resolveWorkspaceImpact(workspaces, packageName);
      packageImpact = { resolved: true, ...impact };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      packageImpact = { resolved: false, reason };
      console.warn(`Package-local CI impact fell back to full validation: ${reason}`);
    }
  }

  const plan = planAffectedExecution(files, classification, packageImpact);

  await writeGithubOutputs(plan);
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
