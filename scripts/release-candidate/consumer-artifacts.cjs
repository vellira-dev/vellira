const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_PACKAGE_NAMES = Object.freeze([
  '@vellira-ui/core',
  '@vellira-ui/tokens',
  '@vellira-ui/types',
  '@vellira-ui/icons',
  '@vellira-ui/react',
  '@vellira-ui/react-native',
]);

const WEB_PACKAGE_NAMES = Object.freeze([
  '@vellira-ui/core',
  '@vellira-ui/tokens',
  '@vellira-ui/types',
  '@vellira-ui/icons',
  '@vellira-ui/react',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function digestFile(filePath, algorithm, encoding) {
  return crypto
    .createHash(algorithm)
    .update(fs.readFileSync(filePath))
    .digest(encoding);
}

function sha256File(filePath) {
  return digestFile(filePath, 'sha256', 'hex');
}

function sha1File(filePath) {
  return digestFile(filePath, 'sha1', 'hex');
}

function sha512Integrity(filePath) {
  return 'sha512-' + digestFile(filePath, 'sha512', 'base64');
}

function hasWorkspaceProtocol(manifest) {
  for (const section of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    for (const version of Object.values(manifest[section] ?? {})) {
      if (typeof version === 'string' && version.startsWith('workspace:')) {
        return true;
      }
    }
  }
  return false;
}

function validateCandidateArtifactDirectory(
  candidateDir,
  expectedSha,
  requiredPackages = PUBLIC_PACKAGE_NAMES
) {
  const absoluteDir = path.resolve(candidateDir);
  const manifestPath = path.join(absoluteDir, 'candidate.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      'Exact release candidate manifest is missing at ' + manifestPath + '.'
    );
  }

  const manifest = readJson(manifestPath);

  if (manifest.schemaVersion !== 1) {
    throw new Error(
      'Unsupported release candidate schema version: ' +
        String(manifest.schemaVersion) +
        '.'
    );
  }

  if (!/^[a-f0-9]{40}$/.test(expectedSha ?? '')) {
    throw new Error('Consumer proof requires an exact 40-character candidate SHA.');
  }

  if (manifest.source?.sha !== expectedSha) {
    throw new Error(
      'Candidate manifest SHA ' +
        String(manifest.source?.sha ?? 'missing') +
        ' does not match expected ' +
        expectedSha +
        '.'
    );
  }

  if (manifest.checks?.cleanInstall !== true) {
    throw new Error(
      'Candidate manifest is missing the producer clean-install proof.'
    );
  }

  if (
    !Array.isArray(manifest.packages) ||
    manifest.packages.length !== PUBLIC_PACKAGE_NAMES.length
  ) {
    throw new Error(
      'Candidate manifest must contain exactly the six public Vellira packages.'
    );
  }

  const names = manifest.packages.map(({ name }) => name);
  if (new Set(names).size !== names.length) {
    throw new Error('Candidate manifest contains duplicate package identities.');
  }

  const canonicalNames = [...PUBLIC_PACKAGE_NAMES].sort();
  if (JSON.stringify([...names].sort()) !== JSON.stringify(canonicalNames)) {
    throw new Error(
      'Candidate manifest package set does not match the canonical public package set.'
    );
  }

  const versions = new Set(manifest.packages.map(({ version }) => version));
  if (
    versions.size !== 1 ||
    !versions.has(manifest.version) ||
    typeof manifest.version !== 'string'
  ) {
    throw new Error(
      'Candidate manifest must bind every package to one exact candidate version.'
    );
  }

  const requiredSet = new Set(requiredPackages);
  for (const name of requiredSet) {
    if (!canonicalNames.includes(name)) {
      throw new Error('Unknown candidate package requested by consumer: ' + name);
    }
  }

  const selected = [];

  for (const evidence of manifest.packages) {
    if (!requiredSet.has(evidence.name)) continue;

    if (
      typeof evidence.filename !== 'string' ||
      evidence.filename !== path.basename(evidence.filename) ||
      !evidence.filename.endsWith('.tgz')
    ) {
      throw new Error(
        'Unsafe or missing candidate filename for ' + evidence.name + '.'
      );
    }

    const tarballPath = path.join(absoluteDir, evidence.filename);
    if (!fs.existsSync(tarballPath)) {
      throw new Error(
        'Candidate tarball is missing for ' +
          evidence.name +
          ': ' +
          evidence.filename +
          '.'
      );
    }

    if (sha256File(tarballPath) !== evidence.sha256) {
      throw new Error('SHA-256 mismatch for ' + evidence.name + '.');
    }

    if (sha512Integrity(tarballPath) !== evidence.npmIntegrity) {
      throw new Error('npm integrity mismatch for ' + evidence.name + '.');
    }

    if (sha1File(tarballPath) !== evidence.npmShasum) {
      throw new Error('npm shasum mismatch for ' + evidence.name + '.');
    }

    selected.push({
      ...evidence,
      tarballPath,
    });
  }

  if (selected.length !== requiredSet.size) {
    throw new Error('Candidate artifact selection is incomplete.');
  }

  return {
    candidateDir: absoluteDir,
    manifest,
    manifestPath,
    manifestSha256: sha256File(manifestPath),
    packages: selected,
  };
}

function assertInstalledCandidatePackages(
  consumerDir,
  candidate,
  requiredPackages = WEB_PACKAGE_NAMES
) {
  const absoluteConsumerDir = path.resolve(consumerDir);
  const nodeModulesRoot = path.join(absoluteConsumerDir, 'node_modules');
  const lockPath = path.join(absoluteConsumerDir, 'package-lock.json');

  if (!fs.existsSync(lockPath)) {
    throw new Error('Clean consumer install did not produce package-lock.json.');
  }

  const lock = readJson(lockPath);
  const installed = [];

  for (const name of requiredPackages) {
    const packageDir = path.join(nodeModulesRoot, ...name.split('/'));
    const manifestPath = path.join(packageDir, 'package.json');

    if (!fs.existsSync(manifestPath)) {
      throw new Error('Clean consumer is missing installed package ' + name + '.');
    }

    const realPackageDir = fs.realpathSync(packageDir);
    const relative = path.relative(nodeModulesRoot, realPackageDir);
    if (
      relative === '..' ||
      relative.startsWith('..' + path.sep) ||
      path.isAbsolute(relative)
    ) {
      throw new Error(
        name +
          ' resolved outside the clean consumer node_modules: ' +
          realPackageDir +
          '.'
      );
    }

    const installedManifest = readJson(manifestPath);
    if (installedManifest.version !== candidate.manifest.version) {
      throw new Error(
        name +
          ' installed version ' +
          String(installedManifest.version) +
          ' does not match candidate ' +
          candidate.manifest.version +
          '.'
      );
    }

    if (hasWorkspaceProtocol(installedManifest)) {
      throw new Error(
        name + ' retained a workspace: protocol after candidate installation.'
      );
    }

    const lockEntry = lock.packages?.['node_modules/' + name];
    if (!lockEntry || typeof lockEntry.resolved !== 'string') {
      throw new Error(
        'package-lock.json is missing resolved artifact identity for ' + name + '.'
      );
    }

    if (!lockEntry.resolved.startsWith('file:')) {
      throw new Error(
        name +
          ' was not installed from the retained tarball: ' +
          lockEntry.resolved +
          '.'
      );
    }

    installed.push({
      name,
      version: installedManifest.version,
      realPackageDir,
      resolved: lockEntry.resolved,
    });
  }

  const serializedLock = JSON.stringify(lock);
  if (
    /registry\.npmjs\.org\/(?:%40|@)vellira-ui/i.test(serializedLock)
  ) {
    throw new Error(
      'Clean consumer package-lock references registry-hosted @vellira-ui artifacts.'
    );
  }

  if (serializedLock.includes('workspace:')) {
    throw new Error(
      'Clean consumer package-lock contains workspace: resolution.'
    );
  }

  return installed;
}

module.exports = {
  PUBLIC_PACKAGE_NAMES,
  WEB_PACKAGE_NAMES,
  assertInstalledCandidatePackages,
  hasWorkspaceProtocol,
  readJson,
  sha256File,
  validateCandidateArtifactDirectory,
};
