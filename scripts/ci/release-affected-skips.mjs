import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  classifyFiles,
  loadClassificationConfig,
  loadWorkspaceGraph,
  packageNameForFiles,
  planAffectedExecution,
  resolveWorkspaceImpact,
} from './affected-execution.mjs';

const TOOLING_CHECK = 'Tooling & IndexNow Tests';
const STORYBOOK_CHECK = 'Storybook & Browser Tests';

export function latestCheckState(checkRuns, name) {
  const matches = checkRuns
    .filter((check) => check.name === name)
    .sort(
      (left, right) =>
        (left.completed_at ?? '').localeCompare(right.completed_at ?? '') ||
        Number(left.id ?? 0) - Number(right.id ?? 0)
    );
  const latest = matches.at(-1);
  return latest
    ? `${latest.status}:${latest.conclusion ?? 'none'}`
    : 'missing';
}

export function authorizedAffectedSkips({ files, plan, checkRuns }) {
  if (!Array.isArray(files) || !Array.isArray(checkRuns) || !plan) {
    return [];
  }

  // Only one changed workspace package with a successfully resolved impact
  // graph may authorize the intentional skips from the affected CI path.
  const packageDir = `packages/${plan.packageName}/`;
  if (
    plan.shape !== 'package-local' ||
    plan.executionPath !== 'affected' ||
    plan.graphStatus !== 'resolved' ||
    typeof plan.packageName !== 'string' ||
    !/^[a-z0-9-]+$/.test(plan.packageName) ||
    files.length === 0 ||
    new Set(files).size !== files.length ||
    !files.every(
      (file) =>
        typeof file === 'string' &&
        file.startsWith(packageDir) &&
        !file.includes('..') &&
        !file.includes('\\') &&
        !file.includes('\r') &&
        !file.includes('\n')
    ) ||
    JSON.stringify(plan.changedFiles) !== JSON.stringify(files) ||
    !Array.isArray(plan.affectedWorkspaces) ||
    !Array.isArray(plan.affectedWorkspacePaths) ||
    !plan.affectedWorkspacePaths.includes(packageDir.slice(0, -1)) ||
    latestCheckState(checkRuns, 'PR Impact') !== 'completed:success'
  ) {
    return [];
  }

  const eligible = [TOOLING_CHECK];
  if (!plan.affectedWorkspaces.includes('@vellira-ui/react-storybook')) {
    eligible.push(STORYBOOK_CHECK);
  }

  // No skipped failure, missing check, or unrelated required check is
  // authorized. The release gate will still require all others to succeed.
  return eligible.filter(
    (check) => latestCheckState(checkRuns, check) === 'completed:skipped'
  );
}

async function main() {
  const [filesPath, checksPath, outputPath] = process.argv.slice(2);
  if (!filesPath || !checksPath || !outputPath) {
    throw new Error(
      'Usage: node scripts/ci/release-affected-skips.mjs <files> <checks.json> <output.json>'
    );
  }

  const files = (await fs.readFile(filesPath, 'utf8'))
    .split('\n')
    .filter(Boolean);
  const { check_runs: checkRuns } = JSON.parse(
    await fs.readFile(checksPath, 'utf8')
  );
  if (!Array.isArray(checkRuns)) {
    throw new Error('Exact release check-runs payload is missing check_runs');
  }

  const classification = await loadClassificationConfig();
  const shape = classifyFiles(files, classification);
  const packageName = shape === 'package-local'
    ? packageNameForFiles(files)
    : null;

  let impact = null;
  if (packageName) {
    try {
      impact = {
        resolved: true,
        ...resolveWorkspaceImpact(await loadWorkspaceGraph(), packageName),
      };
    } catch (error) {
      impact = {
        resolved: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const plan = planAffectedExecution(files, classification, impact);
  const allowedSkips = authorizedAffectedSkips({ files, plan, checkRuns });
  const result = {
    schemaVersion: 1,
    shape: plan.shape,
    executionPath: plan.executionPath,
    graphStatus: plan.graphStatus,
    packageName: plan.packageName,
    affectedWorkspaces: plan.affectedWorkspaces,
    prImpact: latestCheckState(checkRuns, 'PR Impact'),
    allowedSkips,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log('[release-affected-skips]', JSON.stringify(result));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
