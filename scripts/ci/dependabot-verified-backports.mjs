import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_LEDGER_PATH =
  '.github/dependabot-verified-backports.json';

function requiredString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing verified backport ${label}.`);
  }
  return value;
}

function sha256(source) {
  return createHash('sha256').update(source).digest('hex');
}

function normalizeLedger(ledger) {
  if (ledger?.schemaVersion !== 1 || !Array.isArray(ledger.backports)) {
    throw new Error('Unsupported verified backport ledger schema.');
  }

  const seenAlerts = new Set();
  return ledger.backports.map((entry) => {
    if (!Number.isInteger(entry.alertNumber) || entry.alertNumber <= 0) {
      throw new Error('Verified backport alertNumber must be a positive integer.');
    }
    if (seenAlerts.has(entry.alertNumber)) {
      throw new Error(
        `Duplicate verified backport alert #${entry.alertNumber}.`
      );
    }
    seenAlerts.add(entry.alertNumber);

    for (const field of [
      'package',
      'manifestPath',
      'scope',
      'ghsaId',
      'version',
      'upstreamRepository',
      'upstreamCommit',
      'upstreamBaseBlob',
      'upstreamFixedBlob',
      'patchPath',
      'patchSha256',
      'removeWhen',
    ]) {
      requiredString(entry[field], field);
    }

    if (!Number.isInteger(entry.upstreamPullRequest) || entry.upstreamPullRequest <= 0) {
      throw new Error(
        `Verified backport alert #${entry.alertNumber} has invalid upstream pull request.`
      );
    }
    if (!/^[a-f0-9]{40}$/.test(entry.upstreamCommit)) {
      throw new Error(
        `Verified backport alert #${entry.alertNumber} has invalid upstream commit.`
      );
    }
    if (!/^[a-f0-9]{40}$/.test(entry.upstreamBaseBlob)) {
      throw new Error(
        `Verified backport alert #${entry.alertNumber} has invalid upstream base blob.`
      );
    }
    if (!/^[a-f0-9]{40}$/.test(entry.upstreamFixedBlob)) {
      throw new Error(
        `Verified backport alert #${entry.alertNumber} has invalid upstream fixed blob.`
      );
    }
    if (!/^[a-f0-9]{64}$/.test(entry.patchSha256)) {
      throw new Error(
        `Verified backport alert #${entry.alertNumber} has invalid patch SHA-256.`
      );
    }
    if (!entry.patchPath.startsWith('patches/') || entry.patchPath.includes('..')) {
      throw new Error(
        `Verified backport alert #${entry.alertNumber} has unsafe patch path.`
      );
    }

    return entry;
  });
}

async function verifyRepositoryBinding(entry, repositoryRoot) {
  const patch = await readFile(resolve(repositoryRoot, entry.patchPath), 'utf8');
  const actualPatchSha = sha256(patch);
  if (actualPatchSha !== entry.patchSha256) {
    throw new Error(
      `Verified backport alert #${entry.alertNumber} patch SHA mismatch: expected ${entry.patchSha256}, got ${actualPatchSha}.`
    );
  }

  const [workspace, lockfile] = await Promise.all([
    readFile(resolve(repositoryRoot, 'pnpm-workspace.yaml'), 'utf8'),
    readFile(resolve(repositoryRoot, 'pnpm-lock.yaml'), 'utf8'),
  ]);

  const workspaceBinding =
    `'${entry.package}@${entry.version}': ${entry.patchPath}`;
  if (!workspace.includes(workspaceBinding)) {
    throw new Error(
      `Verified backport alert #${entry.alertNumber} is missing pnpm workspace binding: ${workspaceBinding}.`
    );
  }

  const lockPatchBinding =
    `${entry.package}@${entry.version}: ${entry.patchSha256}`;
  if (!lockfile.includes(lockPatchBinding)) {
    throw new Error(
      `Verified backport alert #${entry.alertNumber} is missing lockfile patch binding.`
    );
  }

  const patchedPackageIdentity =
    `${entry.package}@${entry.version}(patch_hash=${entry.patchSha256})`;
  if (!lockfile.includes(patchedPackageIdentity)) {
    throw new Error(
      `Verified backport alert #${entry.alertNumber} is missing patched package identity in the lockfile.`
    );
  }

  return {
    ...entry,
    actualPatchSha256: actualPatchSha,
  };
}

function alertMatchesBackport(alert, backport) {
  return (
    alert?.number === backport.alertNumber &&
    alert?.dependency?.package?.name === backport.package &&
    alert?.dependency?.manifest_path === backport.manifestPath &&
    alert?.dependency?.scope === backport.scope &&
    alert?.security_advisory?.ghsa_id === backport.ghsaId
  );
}

export async function filterVerifiedDependabotBackports({
  alerts,
  ledger,
  repositoryRoot = process.cwd(),
}) {
  if (!Array.isArray(alerts)) {
    throw new Error('Dependabot alerts input must be an array.');
  }

  const entries = normalizeLedger(ledger);
  const verifiedBackports = [];
  for (const entry of entries) {
    verifiedBackports.push(await verifyRepositoryBinding(entry, repositoryRoot));
  }

  const suppressedAlertNumbers = new Set();
  for (const alert of alerts) {
    const matches = verifiedBackports.filter((entry) =>
      alertMatchesBackport(alert, entry)
    );
    if (matches.length > 1) {
      throw new Error(
        `Dependabot alert #${alert.number} matches multiple verified backports.`
      );
    }
    if (matches.length === 1) {
      suppressedAlertNumbers.add(alert.number);
    }
  }

  return {
    effectiveAlerts: alerts.filter(
      (alert) => !suppressedAlertNumbers.has(alert.number)
    ),
    verifiedBackports: verifiedBackports.filter((entry) =>
      suppressedAlertNumbers.has(entry.alertNumber)
    ),
  };
}

async function main() {
  const [alertsPath, outputPath, reportPath, ledgerPath = DEFAULT_LEDGER_PATH] =
    process.argv.slice(2);
  if (!alertsPath || !outputPath || !reportPath) {
    throw new Error(
      'Usage: dependabot-verified-backports.mjs <alerts.json> <effective.json> <report.json> [ledger.json]'
    );
  }

  const [alerts, ledger] = await Promise.all([
    readFile(resolve(alertsPath), 'utf8').then(JSON.parse),
    readFile(resolve(ledgerPath), 'utf8').then(JSON.parse),
  ]);
  const result = await filterVerifiedDependabotBackports({ alerts, ledger });
  await Promise.all([
    writeFile(resolve(outputPath), JSON.stringify(result.effectiveAlerts, null, 2) + '\n'),
    writeFile(resolve(reportPath), JSON.stringify(result.verifiedBackports, null, 2) + '\n'),
  ]);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
