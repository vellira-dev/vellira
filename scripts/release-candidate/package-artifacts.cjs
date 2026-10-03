const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const DEFAULT_ARTIFACT_DIR = '.release-candidate';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: options.env ?? process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(' ')} failed with status ${result.status}.`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  return result.stdout.trim();
}

function exactSourceSha(expectedSha = process.env.GITHUB_SHA) {
  const sourceSha = run('git', ['rev-parse', 'HEAD']);

  if (expectedSha && sourceSha !== expectedSha) {
    throw new Error(
      `Release candidate source SHA mismatch: checkout is ${sourceSha}, expected ${expectedSha}.`
    );
  }

  return sourceSha;
}

function normalizePackagePath(value) {
  return value.replace(/^\.\//, '');
}

function collectExportTargets(value, targets = [], condition = null) {
  if (typeof value === 'string') {
    if (condition !== 'vellira-source' && value.startsWith('./')) {
      targets.push(normalizePackagePath(value));
    }
    return targets;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return targets;
  }

  for (const [key, child] of Object.entries(value)) {
    collectExportTargets(child, targets, key);
  }

  return targets;
}

function manifestTargets(manifest) {
  const targets = collectExportTargets(manifest.exports);
  for (const field of ['main', 'module', 'types', 'react-native']) {
    const value = manifest[field];
    if (typeof value === 'string' && value.startsWith('./')) {
      targets.push(normalizePackagePath(value));
    }
  }
  return [...new Set(targets)].sort();
}

function workspaceProtocolDependencies(manifest) {
  const findings = [];
  for (const section of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (typeof version === 'string' && version.startsWith('workspace:')) {
        findings.push(`${section}.${name}=${version}`);
      }
    }
  }
  return findings;
}

function mismatchedInternalDependencies(manifest, version) {
  const findings = [];

  for (const section of ['dependencies', 'optionalDependencies']) {
    for (const [name, declaredVersion] of Object.entries(
      manifest[section] ?? {}
    )) {
      if (
        name.startsWith('@vellira-ui/') &&
        declaredVersion !== version
      ) {
        findings.push(`${section}.${name}=${declaredVersion}`);
      }
    }
  }

  return findings;
}

function forbiddenPackedFiles(files) {
  const forbidden = [];
  for (const file of files) {
    if (
      /^(?:src|test|tests|stories|node_modules)\//.test(file) ||
      /(?:^|\/)[^/]+\.(?:test|spec|stories)\.[^/]+$/.test(file) ||
      /(?:^|\/)(?:tsconfig|vitest|vite|eslint)\.[^/]+$/.test(file)
    ) {
      forbidden.push(file);
    }
  }
  return forbidden;
}

function validatePackedPackage({ packageInfo, packResult, packedManifest }) {
  if (packResult.name !== packageInfo.name) {
    throw new Error(
      `Packed package name mismatch for ${packageInfo.name}: ${packResult.name}.`
    );
  }

  if (packResult.version !== packageInfo.version) {
    throw new Error(
      `Packed package version mismatch for ${packageInfo.name}: ${packResult.version}.`
    );
  }

  if (packedManifest.name !== packageInfo.name) {
    throw new Error(
      `Packed manifest name mismatch for ${packageInfo.name}: ${packedManifest.name}.`
    );
  }

  if (packedManifest.version !== packageInfo.version) {
    throw new Error(
      `Packed manifest version mismatch for ${packageInfo.name}: ${packedManifest.version}.`
    );
  }

  const files = (packResult.files ?? []).map(({ path: filePath }) => filePath);
  const fileSet = new Set(files);

  for (const required of ['package.json', 'README.md', 'LICENSE']) {
    if (!fileSet.has(required)) {
      throw new Error(`${packageInfo.name} tarball is missing ${required}.`);
    }
  }

  if (!files.some((file) => file.startsWith('dist/'))) {
    throw new Error(`${packageInfo.name} tarball has no dist output.`);
  }

  if (!files.some((file) => file.endsWith('.d.ts'))) {
    throw new Error(`${packageInfo.name} tarball has no declarations.`);
  }

  const forbidden = forbiddenPackedFiles(files);
  if (forbidden.length > 0) {
    throw new Error(
      `${packageInfo.name} tarball contains development artifacts: ${forbidden.join(', ')}.`
    );
  }

  const workspaceDependencies = workspaceProtocolDependencies(packedManifest);
  if (workspaceDependencies.length > 0) {
    throw new Error(
      `${packageInfo.name} tarball contains unresolved workspace dependencies: ${workspaceDependencies.join(', ')}.`
    );
  }

  const internalDependencyMismatches = mismatchedInternalDependencies(
    packedManifest,
    packageInfo.version
  );
  if (internalDependencyMismatches.length > 0) {
    throw new Error(
      `${packageInfo.name} tarball does not pin internal dependencies to the exact candidate version: ${internalDependencyMismatches.join(', ')}.`
    );
  }

  for (const target of manifestTargets(packedManifest)) {
    if (!fileSet.has(target)) {
      throw new Error(
        `${packageInfo.name} export target ${target} is missing from the tarball.`
      );
    }
  }

  if (packageInfo.name === '@vellira-ui/react') {
    const stylesExport = packedManifest.exports?.['./styles'];
    const styles =
      typeof stylesExport === 'string'
        ? normalizePackagePath(stylesExport)
        : null;
    if (!styles || !fileSet.has(styles) || !styles.endsWith('.css')) {
      throw new Error(
        '@vellira-ui/react tarball must include its public stylesheet export.'
      );
    }
  }

  if (packageInfo.name === '@vellira-ui/tokens') {
    const cssExport = packedManifest.exports?.['./css'];
    const cssTarget =
      typeof cssExport === 'string'
        ? cssExport
        : cssExport?.default ?? cssExport?.import;
    const normalized = cssTarget && normalizePackagePath(cssTarget);
    if (!normalized || !fileSet.has(normalized) || !normalized.endsWith('.css')) {
      throw new Error(
        '@vellira-ui/tokens tarball must include its public CSS token export.'
      );
    }
  }

  if (
    packageInfo.name === '@vellira-ui/react-native' &&
    typeof packedManifest.exports?.['.']?.['react-native'] !== 'string'
  ) {
    throw new Error(
      '@vellira-ui/react-native tarball must retain the react-native export condition.'
    );
  }

  if (
    packageInfo.name === '@vellira-ui/icons' &&
    typeof packedManifest.exports?.['.']?.['react-native'] !== 'object'
  ) {
    throw new Error(
      '@vellira-ui/icons tarball must retain the react-native export condition.'
    );
  }
}

function listFiles(root, current = root, files = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      listFiles(root, entryPath, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(path.relative(root, entryPath).replaceAll('\\', '/'));
    }
  }
  return files.sort();
}

function inspectTarball(tarballPath) {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-packed-artifact-')
  );

  try {
    run('tar', ['-xzf', tarballPath, '-C', tempDir]);
    const packageRoot = path.join(tempDir, 'package');
    const manifestPath = path.join(packageRoot, 'package.json');

    if (!fs.existsSync(manifestPath)) {
      throw new Error(
        `Packed tarball ${path.basename(tarballPath)} has no package/package.json.`
      );
    }

    const files = listFiles(packageRoot);
    const unpackedSize = files.reduce(
      (total, filePath) =>
        total + fs.statSync(path.join(packageRoot, filePath)).size,
      0
    );

    return {
      packedManifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
      files,
      unpackedSize,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function sha256File(filePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}

function sha512Integrity(filePath) {
  return `sha512-${crypto
    .createHash('sha512')
    .update(fs.readFileSync(filePath))
    .digest('base64')}`;
}

function sha1File(filePath) {
  return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
}

function packPackage(packageInfo, artifactDir) {
  const before = new Set(fs.readdirSync(artifactDir));

  run('pnpm', [
    '--filter',
    packageInfo.name,
    'pack',
    '--pack-destination',
    artifactDir,
  ]);

  const createdTarballs = fs
    .readdirSync(artifactDir)
    .filter(
      (fileName) => fileName.endsWith('.tgz') && !before.has(fileName)
    );

  if (createdTarballs.length !== 1) {
    throw new Error(
      `pnpm pack must create exactly one tarball for ${packageInfo.name}; found ${createdTarballs.length}.`
    );
  }

  const filename = createdTarballs[0];
  const tarballPath = path.resolve(artifactDir, filename);
  const { packedManifest, files, unpackedSize } =
    inspectTarball(tarballPath);
  const packResult = {
    name: packedManifest.name,
    version: packedManifest.version,
    filename,
    integrity: sha512Integrity(tarballPath),
    shasum: sha1File(tarballPath),
    size: fs.statSync(tarballPath).size,
    unpackedSize,
    files: files.map((filePath) => ({ path: filePath })),
  };

  validatePackedPackage({ packageInfo, packResult, packedManifest });

  return {
    packageInfo: {
      ...packageInfo,
      publishTarget: tarballPath,
      candidateIntegrity: packResult.integrity,
      candidateShasum: packResult.shasum,
    },
    evidence: {
      name: packageInfo.name,
      version: packageInfo.version,
      filename: packResult.filename,
      sha256: sha256File(tarballPath),
      npmIntegrity: packResult.integrity,
      npmShasum: packResult.shasum,
      size: packResult.size,
      unpackedSize: packResult.unpackedSize,
      files: (packResult.files ?? [])
        .map(({ path: filePath }) => filePath)
        .sort(),
    },
  };
}

function assertSingleVersion(packageInfos) {
  const versions = new Set(packageInfos.map(({ version }) => version));
  if (versions.size !== 1 || versions.has(undefined)) {
    throw new Error(
      'Release candidate packaging requires one exact version for all public packages.'
    );
  }
  return packageInfos[0].version;
}

function verifyTypescriptResolution(fixtureDir, specifiers) {
  const ts = require('typescript');
  const containingFile = path.join(fixtureDir, 'consumer.ts');
  const compilerOptions = {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    conditions: [],
  };

  for (const specifier of specifiers) {
    const resolved = ts.resolveModuleName(
      specifier,
      containingFile,
      compilerOptions,
      ts.sys
    ).resolvedModule;

    if (!resolved?.resolvedFileName) {
      throw new Error(
        `TypeScript could not resolve packed consumer import ${specifier}.`
      );
    }

    const normalized = resolved.resolvedFileName.replaceAll('\\', '/');
    if (!normalized.includes('/node_modules/@vellira-ui/')) {
      throw new Error(
        `TypeScript resolved ${specifier} outside the clean consumer node_modules: ${normalized}.`
      );
    }
  }
}

function verifyNodeResolution(fixtureDir, specifiers) {
  const script = [
    'const specifiers = JSON.parse(process.env.VELLIRA_CANDIDATE_IMPORTS);',
    'for (const specifier of specifiers) {',
    '  const resolved = import.meta.resolve(specifier);',
    '  if (!resolved.includes("/node_modules/@vellira-ui/")) {',
    '    throw new Error(`${specifier} resolved outside the clean consumer: ${resolved}`);',
    '  }',
    '}',
  ].join('\n');

  run(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: fixtureDir,
    env: {
      ...process.env,
      VELLIRA_CANDIDATE_IMPORTS: JSON.stringify(specifiers),
    },
  });
}

function verifyCleanConsumerInstall(packages) {
  const fixtureDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-release-candidate-')
  );

  try {
    fs.writeFileSync(
      path.join(fixtureDir, 'package.json'),
      `${JSON.stringify(
        {
          name: 'vellira-release-candidate-consumer',
          private: true,
          type: 'module',
        },
        null,
        2
      )}\n`
    );

    run(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--legacy-peer-deps',
        '--package-lock=false',
        '--no-audit',
        '--no-fund',
        ...packages.map(({ packageInfo }) => packageInfo.publishTarget),
      ],
      { cwd: fixtureDir }
    );

    const packageSpecifiers = packages.map(({ packageInfo }) => packageInfo.name);
    const runtimeSpecifiers = [
      ...packageSpecifiers,
      '@vellira-ui/react/styles',
      '@vellira-ui/tokens/css',
      '@vellira-ui/icons/native',
    ];
    const typeSpecifiers = [
      ...packageSpecifiers,
      '@vellira-ui/tokens/css',
      '@vellira-ui/icons/native',
    ];

    verifyNodeResolution(fixtureDir, runtimeSpecifiers);
    verifyTypescriptResolution(fixtureDir, typeSpecifiers);

    return {
      cleanInstall: true,
      nodeResolution: runtimeSpecifiers,
      typescriptResolution: typeSpecifiers,
    };
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
}

function loadReleaseCandidate(packageInfos, options = {}) {
  const version = assertSingleVersion(packageInfos);
  const sourceSha = exactSourceSha(options.expectedSourceSha);
  const artifactDir = path.resolve(options.artifactDir ?? DEFAULT_ARTIFACT_DIR);
  const manifestPath = path.join(artifactDir, 'candidate.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Exact release candidate manifest is missing at ${manifestPath}.`
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (manifest.source?.sha !== sourceSha) {
    throw new Error(
      `Release candidate manifest SHA ${manifest.source?.sha ?? 'missing'} does not match checkout ${sourceSha}.`
    );
  }

  if (manifest.version !== version) {
    throw new Error(
      `Release candidate version ${manifest.version ?? 'missing'} does not match package version ${version}.`
    );
  }

  if (!Array.isArray(manifest.packages)) {
    throw new Error('Release candidate manifest packages must be an array.');
  }

  if (manifest.checks?.cleanInstall !== true) {
    throw new Error(
      'Release candidate manifest is missing successful clean-install proof.'
    );
  }

  const expectedNames = packageInfos.map(({ name }) => name).sort();
  const actualNames = manifest.packages.map(({ name }) => name).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      'Release candidate manifest must contain exactly the expected public packages.'
    );
  }

  const enriched = packageInfos.map((packageInfo) => {
    const evidence = manifest.packages.find(
      ({ name }) => name === packageInfo.name
    );

    if (!evidence || evidence.version !== packageInfo.version) {
      throw new Error(
        `Release candidate evidence is missing exact version identity for ${packageInfo.name}.`
      );
    }

    const tarballPath = path.resolve(artifactDir, evidence.filename ?? '');
    if (
      path.dirname(tarballPath) !== artifactDir ||
      !fs.existsSync(tarballPath)
    ) {
      throw new Error(
        `Release candidate tarball is missing or escapes the artifact directory for ${packageInfo.name}.`
      );
    }

    const sha256 = sha256File(tarballPath);
    if (sha256 !== evidence.sha256) {
      throw new Error(
        `Release candidate SHA-256 mismatch for ${packageInfo.name}.`
      );
    }

    const integrity = sha512Integrity(tarballPath);
    if (integrity !== evidence.npmIntegrity) {
      throw new Error(
        `Release candidate npm integrity mismatch for ${packageInfo.name}.`
      );
    }

    const shasum = sha1File(tarballPath);
    if (shasum !== evidence.npmShasum) {
      throw new Error(
        `Release candidate npm shasum mismatch for ${packageInfo.name}.`
      );
    }

    return {
      ...packageInfo,
      publishTarget: tarballPath,
      candidateIntegrity: evidence.npmIntegrity,
      candidateShasum: evidence.npmShasum,
    };
  });

  return {
    artifactDir,
    manifest,
    manifestPath,
    packageInfos: enriched,
    sourceSha,
    version,
  };
}

function writeGithubOutputs({ sourceSha, version, manifestPath, artifactDir }) {
  if (!process.env.GITHUB_OUTPUT) return;

  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    [
      `candidate_sha=${sourceSha}`,
      `candidate_version=${version}`,
      `candidate_manifest=${manifestPath}`,
      `candidate_artifact_dir=${artifactDir}`,
      '',
    ].join('\n')
  );
}

function prepareReleaseCandidate(packageInfos, options = {}) {
  const version = assertSingleVersion(packageInfos);
  const sourceSha = exactSourceSha(options.expectedSourceSha);
  const artifactDir = path.resolve(options.artifactDir ?? DEFAULT_ARTIFACT_DIR);

  fs.rmSync(artifactDir, { recursive: true, force: true });
  fs.mkdirSync(artifactDir, { recursive: true });

  const packages = packageInfos.map((packageInfo) =>
    packPackage(packageInfo, artifactDir)
  );

  const consumerChecks = verifyCleanConsumerInstall(packages);

  const manifestPath = path.join(artifactDir, 'candidate.json');
  const manifest = {
    schemaVersion: 1,
    source: {
      repository: process.env.GITHUB_REPOSITORY ?? null,
      sha: sourceSha,
    },
    version,
    packages: packages.map(({ evidence }) => evidence),
    checks: consumerChecks,
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  writeGithubOutputs({ sourceSha, version, manifestPath, artifactDir });

  console.log(
    `[release-candidate] Validated ${packages.length} exact npm tarballs for ${sourceSha} at version ${version}.`
  );

  return loadReleaseCandidate(packageInfos, {
    artifactDir,
    expectedSourceSha: sourceSha,
  });
}

module.exports = {
  collectExportTargets,
  forbiddenPackedFiles,
  loadReleaseCandidate,
  manifestTargets,
  mismatchedInternalDependencies,
  prepareReleaseCandidate,
  validatePackedPackage,
  workspaceProtocolDependencies,
};
