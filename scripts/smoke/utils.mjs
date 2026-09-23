import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { parseRuntimeExportExpectation } from '../public-api/runtime-export-authority.mjs';

export function shouldBuild() {
  return !process.argv.includes('--skip-build');
}

export function run(command, args = [], options = {}) {
  execFileSync(command, args, {
    ...options,
    stdio: 'inherit',
  });
}

export function runPnpmInstall(tempDir) {
  run('pnpm', ['install', '--offline'], { cwd: tempDir });
}

function findPackageRoot(entryPath, packageName) {
  let currentDir = path.dirname(entryPath);

  while (currentDir !== path.dirname(currentDir)) {
    const packageJsonPath = path.join(currentDir, 'package.json');

    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

        if (packageJson.name === packageName) {
          return currentDir;
        }
      } catch {
        // Continue upwards if this package.json cannot be parsed.
      }
    }

    currentDir = path.dirname(currentDir);
  }

  throw new Error(
    `Could not locate the package root for ${packageName} from ${entryPath}.`
  );
}

function resolveWorkspaceDependency(root, packageDir, packageName) {
  const workspacePackageJson = path.join(root, packageDir, 'package.json');
  const requireFromWorkspace = createRequire(workspacePackageJson);

  try {
    const entryPath = requireFromWorkspace.resolve(packageName);

    return findPackageRoot(entryPath, packageName);
  } catch (error) {
    throw new Error(
      `Missing ${packageName} for ${packageDir}. Run pnpm install before smoke tests.`,
      { cause: error }
    );
  }
}

export function linkWorkspaceDependencies(root, tempDir, packageDir, packages) {
  const dependencies = {};

  for (const packageName of packages) {
    const sourcePath = resolveWorkspaceDependency(
      root,
      packageDir,
      packageName
    );

    dependencies[packageName] = `link:${path.relative(tempDir, sourcePath)}`;
  }

  return dependencies;
}

export function packPackages(packageNames, tempDir) {
  const dependencies = {};

  for (const packageName of packageNames) {
    const before = new Set(readdirSync(tempDir));

    run('pnpm', [
      '--filter',
      packageName,
      'pack',
      '--pack-destination',
      tempDir,
    ]);

    const tarballName = readdirSync(tempDir).find(
      (fileName) => fileName.endsWith('.tgz') && !before.has(fileName)
    );

    if (!tarballName) {
      throw new Error(`Could not pack ${packageName}`);
    }

    dependencies[packageName] = `file:./${tarballName}`;
  }

  return dependencies;
}

export function writePackageJson(tempDir, packageJson) {
  writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

export function writeWorkspaceFile(tempDir, dependencies) {
  const overrides = dependencies.overrides ?? dependencies;

  writeFileSync(
    path.join(tempDir, 'pnpm-workspace.yaml'),
    [
      'packages:',
      "  - '.'",
      'overrides:',
      ...Object.entries(overrides).map(
        ([packageName, tarball]) => `  '${packageName}': '${tarball}'`
      ),
      '',
    ].join('\n')
  );
}


export function readRuntimeExportExpectation(publicApiTestFile) {
  return parseRuntimeExportExpectation(
    readFileSync(publicApiTestFile, 'utf8'),
    publicApiTestFile
  );
}
