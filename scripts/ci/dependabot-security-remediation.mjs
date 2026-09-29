import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const ALLOWED_REMEDIATION_PATHS = Object.freeze([
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
]);

const MUTABLE_WORKSPACE_SECTIONS = new Set([
  'minimumReleaseAgeExclude',
  'overrides',
]);

function topLevelKey(line) {
  const match = /^([A-Za-z0-9_-]+):(?:\s|$)/.exec(line);
  return match?.[1] ?? null;
}

export function stripMutableWorkspaceSections(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const kept = [];
  let skipping = false;

  for (const line of lines) {
    const key = topLevelKey(line);
    if (key !== null) {
      skipping = MUTABLE_WORKSPACE_SECTIONS.has(key);
    }

    if (!skipping) {
      kept.push(line);
    }
  }

  return kept.join('\n');
}

export function validateRemediationDiff({
  changedFiles,
  untrackedFiles = [],
  workspaceBefore,
  workspaceAfter,
}) {
  const uniqueFiles = [...new Set(changedFiles)].sort();
  const allowed = new Set(ALLOWED_REMEDIATION_PATHS);

  if (uniqueFiles.length === 0) {
    throw new Error('Security remediation produced no repository changes');
  }

  const unexpected = uniqueFiles.filter((path) => !allowed.has(path));
  if (unexpected.length > 0) {
    throw new Error(
      `Security remediation changed forbidden paths: ${unexpected.join(', ')}`
    );
  }

  const unexpectedUntracked = [...new Set(untrackedFiles)]
    .sort()
    .filter((path) => !path.startsWith('.security-remediation/'));
  if (unexpectedUntracked.length > 0) {
    throw new Error(
      `Security remediation created forbidden untracked paths: ${unexpectedUntracked.join(', ')}`
    );
  }

  if (
    uniqueFiles.includes('pnpm-workspace.yaml') &&
    stripMutableWorkspaceSections(workspaceBefore) !==
      stripMutableWorkspaceSections(workspaceAfter)
  ) {
    throw new Error(
      'Security remediation changed pnpm-workspace.yaml outside overrides/minimumReleaseAgeExclude'
    );
  }

  return {
    schemaVersion: 1,
    changedFiles: uniqueFiles,
    mutableWorkspaceSections: [...MUTABLE_WORKSPACE_SECTIONS].sort(),
  };
}

const SEVERITY_RANK = Object.freeze({
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
});

export const AUTOMATED_DEPENDENCY_SCOPE = 'development';

function isRelevantAlert(alert, auditLevel) {
  const severity = alert?.security_advisory?.severity?.toLowerCase();
  const minimumRank = SEVERITY_RANK[auditLevel];
  return (
    alert?.state === 'open' &&
    alert?.dependency?.package?.ecosystem === 'npm' &&
    alert?.dependency?.scope === AUTOMATED_DEPENDENCY_SCOPE &&
    typeof severity === 'string' &&
    SEVERITY_RANK[severity] >= minimumRank
  );
}

export function buildRemediationPlan(alerts, auditLevel = 'high') {
  if (!(auditLevel in SEVERITY_RANK)) {
    throw new Error(`Unsupported audit level: ${auditLevel}`);
  }

  const relevant = alerts.filter((alert) => isRelevantAlert(alert, auditLevel));
  const fixable = relevant.filter(
    (alert) =>
      typeof alert?.security_vulnerability?.first_patched_version?.identifier ===
        'string' &&
      alert.security_vulnerability.first_patched_version.identifier.length > 0
  );
  const blocked = relevant.filter((alert) => !fixable.includes(alert));

  const packages = [
    ...new Set(
      relevant
        .map((alert) => alert?.dependency?.package?.name)
        .filter((name) => typeof name === 'string' && name.length > 0)
    ),
  ].sort();

  return {
    schemaVersion: 1,
    auditLevel,
    dependencyScope: AUTOMATED_DEPENDENCY_SCOPE,
    relevantAlertCount: relevant.length,
    fixableAlertCount: fixable.length,
    blockedAlertCount: blocked.length,
    packages,
    alerts: relevant.map((alert) => ({
      number: alert.number,
      ghsaId: alert?.security_advisory?.ghsa_id ?? null,
      severity: alert?.security_advisory?.severity ?? null,
      package: alert?.dependency?.package?.name ?? null,
      scope: alert?.dependency?.scope ?? null,
      vulnerableVersionRange:
        alert?.security_vulnerability?.vulnerable_version_range ?? null,
      firstPatchedVersion:
        alert?.security_vulnerability?.first_patched_version?.identifier ?? null,
    })),
  };
}

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trimEnd();
}

function readChangedFiles(args) {
  const output = runGit(args);
  return output.length === 0 ? [] : output.split('\n').filter(Boolean);
}

function validateWorkingTree() {
  const changedFiles = readChangedFiles(['diff', '--name-only', 'HEAD', '--']);
  const untrackedFiles = readChangedFiles([
    'ls-files',
    '--others',
    '--exclude-standard',
  ]);
  const workspaceBefore = runGit(['show', 'HEAD:pnpm-workspace.yaml']);
  const workspaceAfter = fs.readFileSync('pnpm-workspace.yaml', 'utf8');

  return validateRemediationDiff({
    changedFiles,
    untrackedFiles,
    workspaceBefore,
    workspaceAfter,
  });
}

function validatePullRequest(baseSha) {
  if (!/^[0-9a-f]{40}$/.test(baseSha ?? '')) {
    throw new Error('A valid 40-character base SHA is required');
  }

  const changedFiles = readChangedFiles([
    'diff',
    '--name-only',
    `${baseSha}...HEAD`,
    '--',
  ]);
  const workspaceBefore = runGit(['show', `${baseSha}:pnpm-workspace.yaml`]);
  const workspaceAfter = fs.readFileSync('pnpm-workspace.yaml', 'utf8');

  return validateRemediationDiff({
    changedFiles,
    workspaceBefore,
    workspaceAfter,
  });
}

function main(argv) {
  const [command, ...rest] = argv;

  if (command === 'plan') {
    const [alertsPath = '.security-remediation/alerts.json'] = rest;
    const levelIndex = rest.indexOf('--level');
    const auditLevel = levelIndex >= 0 ? rest[levelIndex + 1] : 'high';
    const alerts = JSON.parse(fs.readFileSync(alertsPath, 'utf8'));

    if (!Array.isArray(alerts)) {
      throw new Error('Dependabot alerts payload must be an array');
    }

    console.log(JSON.stringify(buildRemediationPlan(alerts, auditLevel), null, 2));
    return;
  }

  if (command === 'validate-working-tree') {
    console.log(JSON.stringify(validateWorkingTree(), null, 2));
    return;
  }

  if (command === 'validate-pr') {
    const baseIndex = rest.indexOf('--base');
    const baseSha = baseIndex >= 0 ? rest[baseIndex + 1] : undefined;
    console.log(JSON.stringify(validatePullRequest(baseSha), null, 2));
    return;
  }

  throw new Error(
    'Usage: dependabot-security-remediation.mjs <plan|validate-working-tree|validate-pr>'
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2));
}
