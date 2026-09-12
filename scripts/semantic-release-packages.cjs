const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const publicPackages = [
  '@vellira-ui/core',
  '@vellira-ui/tokens',
  '@vellira-ui/types',
  '@vellira-ui/icons',
  '@vellira-ui/react',
  '@vellira-ui/react-native',
];

const registry = 'https://registry.npmjs.org/';
const publishConcurrency = Number.parseInt(
  process.env.VELLIRA_RELEASE_PUBLISH_CONCURRENCY ?? '3',
  10
);
const publishRetries = Number.parseInt(
  process.env.VELLIRA_RELEASE_PUBLISH_RETRIES ?? '2',
  10
);
const verificationAttempts = Number.parseInt(
  process.env.VELLIRA_RELEASE_VERIFICATION_ATTEMPTS ?? '12',
  10
);

const verificationBaseDelayMs = Number.parseInt(
  process.env.VELLIRA_RELEASE_VERIFICATION_BASE_DELAY_MS ?? '5000',
  10
);
const minimumTrustedPublishingNpmVersion = '11.5.1';

function getPackageDirectory(packageName) {
  return path.resolve('packages', packageName.replace('@vellira-ui/', ''));
}

function getPackageManifestPath(packageName) {
  return path.join(getPackageDirectory(packageName), 'package.json');
}

function readManifest(packagePath) {
  return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
}

function updateVersion(packagePath, version) {
  const manifest = readManifest(packagePath);
  manifest.version = version;
  fs.writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function compareVersions(left, right) {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10));
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10));

  for (let index = 0; index < 3; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

function getNpmVersion() {
  const result = spawnSync('npm', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Unable to read npm version: npm exited with status ${result.status}`
    );
  }

  return result.stdout.trim();
}

function assertTrustedPublishingEnvironment() {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error(
      'npm Trusted Publishing must run from GitHub Actions with OIDC enabled.'
    );
  }

  if (
    !process.env.ACTIONS_ID_TOKEN_REQUEST_URL ||
    !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  ) {
    throw new Error(
      'GitHub Actions OIDC environment is missing. Keep `id-token: write` on the release workflow.'
    );
  }

  if (process.env.NODE_AUTH_TOKEN) {
    throw new Error(
      'NODE_AUTH_TOKEN must not be set for Trusted Publishing. npm should authenticate through OIDC provenance.'
    );
  }

  const npmVersion = getNpmVersion();

  if (compareVersions(npmVersion, minimumTrustedPublishingNpmVersion) === -1) {
    throw new Error(
      `npm ${minimumTrustedPublishingNpmVersion} or newer is required for Trusted Publishing. Found ${npmVersion}.`
    );
  }
}

function createPackageInfo(packageName) {
  const directory = getPackageDirectory(packageName);
  const manifestPath = getPackageManifestPath(packageName);
  const manifest = readManifest(manifestPath);

  if (manifest.name !== packageName) {
    throw new Error(
      `Expected ${manifestPath} to describe ${packageName}, found ${manifest.name}.`
    );
  }

  if (manifest.private) {
    throw new Error(
      `${packageName} is marked private and cannot be published.`
    );
  }

  if (manifest.publishConfig?.access !== 'public') {
    throw new Error(
      `${packageName} must declare publishConfig.access: "public".`
    );
  }

  return {
    name: packageName,
    version: manifest.version,
    directory,
    relativeDirectory: `.${path.sep}${path.relative(process.cwd(), directory)}`,
  };
}

function isAlreadyPublishedError(output) {
  return (
    output.includes('cannot publish over the previously published version') ||
    output.includes('cannot publish over the previously published versions') ||
    output.includes(
      'You cannot publish over the previously published version'
    ) ||
    output.includes(
      'You cannot publish over the previously published versions'
    ) ||
    output.includes('previously published versions') ||
    output.includes('EPUBLISHCONFLICT') ||
    output.includes('code E409')
  );
}

function isRetryableVerificationError(output) {
  const errorCode = getNpmErrorCode(output);

  if (
    [
      '404',
      'E404',
      '429',
      'E429',
      '500',
      'E500',
      '502',
      'E502',
      '503',
      'E503',
      '504',
      'E504',
      'ECONNRESET',
      'ETIMEDOUT',
      'EAI_AGAIN',
    ].includes(errorCode)
  ) {
    return true;
  }

  return /\b(?:E404|E429|E500|E502|E503|E504|ECONNRESET|ETIMEDOUT|EAI_AGAIN)\b/i.test(
    output
  );
}

function getNpmErrorCode(output) {
  const codeMatch = output.match(/\b(?:npm ERR! )?code\s+([A-Z0-9_]+)/i);
  const statusMatch = output.match(/\b(?:HTTP|status)\s+([0-9]{3})\b/i);

  return codeMatch?.[1]?.toUpperCase() ?? statusMatch?.[1] ?? null;
}

function isRetryablePublishError(output) {
  const errorCode = getNpmErrorCode(output);

  if (['401', '403', 'E401', 'E403', 'EPUBLISHCONFLICT'].includes(errorCode)) {
    return false;
  }

  if (
    [
      'ECONNRESET',
      'ETIMEDOUT',
      'EAI_AGAIN',
      '429',
      '502',
      '503',
      '504',
      'E429',
      'E502',
      'E503',
      'E504',
    ].includes(errorCode)
  ) {
    return true;
  }

  return /\b(?:ECONNRESET|ETIMEDOUT|EAI_AGAIN)\b/.test(output);
}

function runNpmPublish(packageInfo) {
  const args = [
    'publish',
    packageInfo.relativeDirectory,
    '--access',
    'public',
    '--registry',
    registry,
    '--provenance',
  ];

  return new Promise((resolve) => {
    const child = spawn('npm', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      resolve({ error, status: null, stdout, stderr });
    });

    child.on('close', (status) => {
      resolve({ error: null, status, stdout, stderr });
    });
  });
}

function runNpmViewDist(packageInfo) {
  const args = [
    'view',
    `${packageInfo.name}@${packageInfo.version}`,
    'dist',
    '--json',
    '--registry',
    registry,
  ];

  return new Promise((resolve) => {
    const child = spawn('npm', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      resolve({ error, status: null, stdout, stderr });
    });

    child.on('close', (status) => {
      resolve({ error: null, status, stdout, stderr });
    });
  });
}

function writeCommandOutput(packageName, result) {
  if (result.stdout) {
    process.stdout.write(`[${packageName}] stdout\n${result.stdout}`);
  }

  if (result.stderr) {
    process.stderr.write(`[${packageName}] stderr\n${result.stderr}`);
  }
}

function formatDuration(startedAt) {
  return `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getVerificationDelay(attempt) {
  return verificationBaseDelayMs * attempt;
}

function hasProvenanceAttestations(dist) {
  if (!dist || typeof dist !== 'object') {
    return false;
  }

  if (!Object.hasOwn(dist, 'attestations')) {
    return false;
  }

  const { attestations } = dist;

  if (Array.isArray(attestations)) {
    return attestations.length > 0;
  }

  if (attestations && typeof attestations === 'object') {
    return Object.keys(attestations).length > 0;
  }

  return Boolean(attestations);
}

async function verifyPublishedPackage(packageInfo) {
  for (let attempt = 1; attempt <= verificationAttempts; attempt += 1) {
    const result = await runNpmViewDist(packageInfo);
    const output = `${result.stdout}\n${result.stderr}`;

    if (!result.error && result.status === 0) {
      let dist;

      try {
        dist = JSON.parse(result.stdout);
      } catch (error) {
        throw new Error(
          `Unable to parse npm registry metadata for ` +
            `${packageInfo.name}@${packageInfo.version}: ${error.message}`
        );
      }

      const hasIntegrity = Boolean(dist?.integrity);
      const hasTarball = Boolean(dist?.tarball);
      const hasProvenance = hasProvenanceAttestations(dist);

      if (hasIntegrity && hasTarball && hasProvenance) {
        console.log(
          `[release] Verified npm provenance metadata for ` +
            `${packageInfo.name}@${packageInfo.version}.`
        );

        return dist;
      }

      if (attempt === verificationAttempts) {
        if (!hasIntegrity || !hasTarball) {
          throw new Error(
            `npm registry metadata for ${packageInfo.name}@` +
              `${packageInfo.version} is missing tarball integrity.`
          );
        }

        throw new Error(
          `npm registry metadata for ${packageInfo.name}@` +
            `${packageInfo.version} is missing provenance attestations.`
        );
      }

      const delayMs = getVerificationDelay(attempt);
      const missingMetadata = [
        !hasIntegrity && 'integrity',
        !hasTarball && 'tarball',
        !hasProvenance && 'provenance',
      ]
        .filter(Boolean)
        .join(', ');

      console.warn(
        `[release] ${packageInfo.name}@${packageInfo.version} is visible, ` +
          `but ${missingMetadata} metadata is not available yet; ` +
          `retrying in ${delayMs / 1000}s ` +
          `(${attempt}/${verificationAttempts}).`
      );

      await wait(delayMs);
      continue;
    }

    const retryable =
      Boolean(result.error) || isRetryableVerificationError(output);

    if (!retryable || attempt === verificationAttempts) {
      writeCommandOutput(packageInfo.name, result);

      const reason = result.error
        ? result.error.message
        : `npm view exited with status ${result.status}`;

      throw new Error(
        `Failed to verify ${packageInfo.name}@${packageInfo.version}: ${reason}`
      );
    }

    const delayMs = getVerificationDelay(attempt);
    const errorCode = getNpmErrorCode(output) ?? 'unknown transient error';

    console.warn(
      `[release] ${packageInfo.name}@${packageInfo.version} is not fully ` +
        `available from npm yet (${errorCode}); retrying in ` +
        `${delayMs / 1000}s (${attempt}/${verificationAttempts}).`
    );

    await wait(delayMs);
  }

  throw new Error(
    `Unexpected verification loop exit for ` +
      `${packageInfo.name}@${packageInfo.version}.`
  );
}

async function publishPackage(packageInfo) {
  const startedAt = Date.now();
  const maxAttempts = publishRetries + 1;

  console.log(
    `[release] Publishing ${packageInfo.name}@${packageInfo.version} with npm provenance.`
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attemptPrefix = `[release] ${packageInfo.name} attempt ${attempt}/${maxAttempts}`;
    console.log(`${attemptPrefix} started.`);

    const result = await runNpmPublish(packageInfo);
    const output = `${result.stdout}\n${result.stderr}`;

    if (!result.error && result.status === 0) {
      writeCommandOutput(packageInfo.name, result);

      try {
        await verifyPublishedPackage(packageInfo);
      } catch (error) {
        return {
          packageName: packageInfo.name,
          version: packageInfo.version,
          status: 'failed',
          provenance: 'not verified',
          attempts: attempt,
          duration: formatDuration(startedAt),
          error,
        };
      }

      console.log(
        `[release] Published ${packageInfo.name}@${packageInfo.version} in ${formatDuration(startedAt)}.`
      );

      return {
        packageName: packageInfo.name,
        version: packageInfo.version,
        status: 'published',
        provenance: 'verified',
        attempts: attempt,
        duration: formatDuration(startedAt),
      };
    }

    if (isAlreadyPublishedError(output)) {
      writeCommandOutput(packageInfo.name, result);

      try {
        await verifyPublishedPackage(packageInfo);
      } catch (error) {
        return {
          packageName: packageInfo.name,
          version: packageInfo.version,
          status: 'failed',
          provenance: 'not verified',
          attempts: attempt,
          duration: formatDuration(startedAt),
          error,
        };
      }

      console.log(
        `[release] ${packageInfo.name}@${packageInfo.version} is already published; continuing.`
      );

      return {
        packageName: packageInfo.name,
        version: packageInfo.version,
        status: 'already published',
        provenance: 'verified',
        attempts: attempt,
        duration: formatDuration(startedAt),
      };
    }

    const retryable = result.error || isRetryablePublishError(output);

    if (!retryable || attempt === maxAttempts) {
      writeCommandOutput(packageInfo.name, result);
      const reason = result.error
        ? result.error.message
        : `npm exited with status ${result.status}`;

      return {
        packageName: packageInfo.name,
        version: packageInfo.version,
        status: 'failed',
        provenance: 'not verified',
        attempts: attempt,
        duration: formatDuration(startedAt),
        error: new Error(`Failed to publish ${packageInfo.name}: ${reason}`),
      };
    }

    console.warn(
      `${attemptPrefix} failed with a transient npm error; retrying.`
    );
    await wait(1000 * attempt);
  }

  throw new Error(`Unexpected publish loop exit for ${packageInfo.name}.`);
}

async function publishPackages(packageInfos, publish = publishPackage) {
  const queue = [...packageInfos];
  const summaries = [];
  const workers = Array.from(
    { length: Math.min(publishConcurrency, queue.length) },
    async () => {
      while (queue.length > 0) {
        const packageInfo = queue.shift();
        try {
          summaries.push(await publish(packageInfo));
        } catch (error) {
          summaries.push({
            packageName: packageInfo.name,
            version: packageInfo.version,
            status: 'failed',
            provenance: 'not verified',
            attempts: 0,
            duration: 'unknown',
            error,
          });
        }
      }
    }
  );

  await Promise.all(workers);

  return summaries.sort(
    (left, right) =>
      packageInfos.findIndex(
        (packageInfo) => packageInfo.name === left.packageName
      ) -
      packageInfos.findIndex(
        (packageInfo) => packageInfo.name === right.packageName
      )
  );
}

async function verifyPackageCompleteness(
  packageInfos,
  verify = verifyPublishedPackage
) {
  const expectedNames = [...publicPackages].sort();
  const actualNames = packageInfos.map(({ name }) => name).sort();

  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      'The npm completeness gate must receive exactly the six public packages.'
    );
  }

  const versions = new Set(packageInfos.map(({ version }) => version));

  if (versions.size !== 1 || versions.has(undefined)) {
    throw new Error(
      'The npm completeness gate must verify one exact version for all public packages.'
    );
  }

  const verified = await Promise.all(packageInfos.map(verify));
  console.log(
    `[release] Completeness gate verified all ${packageInfos.length} public packages at ${packageInfos[0].version}.`
  );
  return verified;
}

function printPublishSummary(summaries) {
  console.log('\n[release] npm publish summary');
  console.log('Package | Version | Status | Provenance | Attempts | Duration');
  console.log('--- | --- | --- | --- | --- | ---');

  for (const summary of summaries) {
    console.log(
      `${summary.packageName} | ${summary.version} | ${summary.status} | ${summary.provenance} | ${summary.attempts} | ${summary.duration}`
    );
  }
}

exports.prepare = async (_pluginConfig, context) => {
  updateVersion(path.resolve('package.json'), context.nextRelease.version);

  for (const packageName of publicPackages) {
    updateVersion(
      getPackageManifestPath(packageName),
      context.nextRelease.version
    );
  }
};

exports.publish = async () => {
  if (!Number.isInteger(publishConcurrency) || publishConcurrency < 1) {
    throw new Error(
      'VELLIRA_RELEASE_PUBLISH_CONCURRENCY must be a positive integer.'
    );
  }

  if (!Number.isInteger(publishRetries) || publishRetries < 0) {
    throw new Error('VELLIRA_RELEASE_PUBLISH_RETRIES must be zero or greater.');
  }

  if (!Number.isInteger(verificationAttempts) || verificationAttempts < 1) {
    throw new Error(
      'VELLIRA_RELEASE_VERIFICATION_ATTEMPTS must be a positive integer.'
    );
  }

  if (
    !Number.isInteger(verificationBaseDelayMs) ||
    verificationBaseDelayMs < 0
  ) {
    throw new Error(
      'VELLIRA_RELEASE_VERIFICATION_BASE_DELAY_MS must be zero or greater.'
    );
  }

  assertTrustedPublishingEnvironment();

  const packageInfos = publicPackages.map(createPackageInfo);
  const summaries = await publishPackages(packageInfos);
  printPublishSummary(summaries);

  // A publish command can succeed minutes before npm's read path exposes the
  // immutable version. Release success is the complete registry state, not an
  // individual command result or an earlier per-package visibility timeout.
  await verifyPackageCompleteness(packageInfos);
};

// The manual post-tag recovery path reuses the normal publisher rather than
// maintaining a second npm/OIDC implementation. Keep this deliberately small:
// recovery decides which packages are missing before calling publishPackage.
exports.recovery = Object.freeze({
  assertTrustedPublishingEnvironment,
  createPackageInfo,
  hasProvenanceAttestations,
  publicPackages: Object.freeze([...publicPackages]),
  publishPackage,
  publishPackages,
  verifyPackageCompleteness,
  verifyPublishedPackage,
});
