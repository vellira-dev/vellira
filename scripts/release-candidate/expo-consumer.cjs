const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const {
  NATIVE_PACKAGE_NAMES,
  assertInstalledCandidatePackages,
  readJson,
  validateCandidateArtifactDirectory,
} = require('./consumer-artifacts.cjs');

const candidateDir = path.resolve(
  process.env.VELLIRA_CANDIDATE_DIR ?? '.candidate-artifacts'
);
const expectedSha = process.env.VELLIRA_CANDIDATE_SHA;
const evidencePath = path.resolve(
  process.env.VELLIRA_CONSUMER_EVIDENCE ??
    'consumer-evidence/expo-consumer.json'
);

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
        command +
          ' ' +
          args.join(' ') +
          ' failed with status ' +
          String(result.status) +
          '.',
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  return result.stdout.trim();
}

function exactVersion(range, label) {
  if (typeof range !== 'string') {
    throw new Error('Missing clean Expo tooling version for ' + label + '.');
  }

  const match = range.match(/^[~^]?([0-9]+\.[0-9]+\.[0-9]+)$/);
  if (!match) {
    throw new Error(
      'Clean Expo tooling version for ' +
        label +
        ' must be an exact or simple semver range, found ' +
        range +
        '.'
    );
  }

  return match[1];
}

function writeFile(root, relativePath, contents) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function createFixture(candidate) {
  const fixtureDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-expo-consumer-')
  );
  const playgroundPackage = readJson(
    path.resolve('apps/native-playground/package.json')
  );

  const dependencies = {
    '@expo/metro-runtime': exactVersion(
      playgroundPackage.dependencies?.['@expo/metro-runtime'],
      '@expo/metro-runtime'
    ),
    '@react-native-picker/picker': exactVersion(
      playgroundPackage.dependencies?.['@react-native-picker/picker'],
      '@react-native-picker/picker'
    ),
    expo: exactVersion(playgroundPackage.dependencies?.expo, 'expo'),
    react: exactVersion(playgroundPackage.dependencies?.react, 'react'),
    'react-native': exactVersion(
      playgroundPackage.dependencies?.['react-native'],
      'react-native'
    ),
    'react-native-svg': exactVersion(
      playgroundPackage.dependencies?.['react-native-svg'],
      'react-native-svg'
    ),
  };

  for (const packageEvidence of candidate.packages) {
    dependencies[packageEvidence.name] =
      'file:' + packageEvidence.tarballPath;
  }

  const devDependencies = {
    '@types/react': exactVersion(
      playgroundPackage.devDependencies?.['@types/react'],
      '@types/react'
    ),
    typescript: exactVersion(
      playgroundPackage.devDependencies?.typescript,
      'typescript'
    ),
  };

  writeFile(
    fixtureDir,
    'package.json',
    JSON.stringify(
      {
        name: 'vellira-clean-expo-candidate-consumer',
        private: true,
        version: '0.0.0',
        main: 'index.js',
        scripts: {
          start: 'expo start',
          typecheck: 'tsc --noEmit',
          build:
            'expo export --platform ios --platform android --output-dir dist',
        },
        dependencies,
        devDependencies,
      },
      null,
      2
    ) + '\n'
  );

  writeFile(
    fixtureDir,
    'app.json',
    JSON.stringify(
      {
        expo: {
          name: 'Vellira Clean Expo Candidate',
          slug: 'vellira-clean-expo-candidate',
          version: '1.0.0',
          platforms: ['ios', 'android'],
        },
      },
      null,
      2
    ) + '\n'
  );

  writeFile(
    fixtureDir,
    'tsconfig.json',
    JSON.stringify(
      {
        extends: 'expo/tsconfig.base',
        compilerOptions: {
          strict: true,
        },
        include: ['**/*.ts', '**/*.tsx', 'expo-env.d.ts'],
      },
      null,
      2
    ) + '\n'
  );

  writeFile(
    fixtureDir,
    'expo-env.d.ts',
    [
      '/// <reference types="expo/types" />',
      '',
      '// This file is intentionally owned by the clean Expo fixture.',
      '',
    ].join('\n')
  );

  writeFile(
    fixtureDir,
    'index.js',
    [
      "import { registerRootComponent } from 'expo';",
      '',
      "import App from './App';",
      '',
      'registerRootComponent(App);',
      '',
    ].join('\n')
  );

  writeFile(
    fixtureDir,
    'App.tsx',
    [
      "import { useState } from 'react';",
      "import { SafeAreaView, Text, View } from 'react-native';",
      '',
      'import {',
      '  Button,',
      '  Checkbox,',
      '  Input,',
      '  ThemeProvider,',
      "} from '@vellira-ui/react-native';",
      '',
      'export default function App() {',
      "  const [email, setEmail] = useState('candidate@vellira.dev');",
      '',
      '  return (',
      '    <ThemeProvider>',
      '      <SafeAreaView>',
      '        <View>',
      '          <Text>Clean Expo Vellira consumer</Text>',
      '          <Input',
      "            label='Email'",
      '            value={email}',
      '            onValueChange={setEmail}',
      "            testID='candidate-native-input'",
      '          />',
      '          <Checkbox',
      "            label='Candidate Native Checkbox'",
      '            defaultChecked',
      "            testID='candidate-native-checkbox'",
      '          />',
      "          <Button testID='candidate-native-button'>",
      '            Candidate Native Button',
      '          </Button>',
      '        </View>',
      '      </SafeAreaView>',
      '    </ThemeProvider>',
      '  );',
      '}',
      '',
    ].join('\n')
  );

  return fixtureDir;
}

function verifyNativeEntryPoints(fixtureDir) {
  const reactNativeManifest = readJson(
    path.join(
      fixtureDir,
      'node_modules',
      '@vellira-ui',
      'react-native',
      'package.json'
    )
  );
  const iconsManifest = readJson(
    path.join(
      fixtureDir,
      'node_modules',
      '@vellira-ui',
      'icons',
      'package.json'
    )
  );

  const reactNativeEntry = reactNativeManifest.exports?.['.']?.['react-native'];
  if (
    reactNativeManifest['react-native'] !== './dist/index.js' ||
    reactNativeEntry !== './dist/index.js'
  ) {
    throw new Error(
      '@vellira-ui/react-native must expose its packed React Native entry point.'
    );
  }

  const iconsNative = iconsManifest.exports?.['.']?.['react-native'];
  const iconsNativeEntry =
    iconsNative && typeof iconsNative === 'object'
      ? iconsNative.default
      : iconsNative;

  if (
    iconsManifest['react-native'] !== './dist/native.js' ||
    iconsNativeEntry !== './dist/native.js'
  ) {
    throw new Error(
      '@vellira-ui/icons must expose its packed React Native entry point.'
    );
  }

  for (const relativePath of [
    ['@vellira-ui', 'react-native', 'dist', 'index.js'],
    ['@vellira-ui', 'react-native', 'dist', 'index.d.ts'],
    ['@vellira-ui', 'icons', 'dist', 'native.js'],
    ['@vellira-ui', 'icons', 'dist', 'native.d.ts'],
  ]) {
    const filePath = path.join(
      fixtureDir,
      'node_modules',
      ...relativePath
    );
    if (!fs.existsSync(filePath)) {
      throw new Error(
        'Packed native entry point is missing: ' +
          relativePath.join('/') +
          '.'
      );
    }
  }

  return {
    reactNative: reactNativeEntry,
    icons: iconsNativeEntry,
  };
}

function verifyExpoDependencyCompatibility(fixtureDir, expoBin) {
  run(process.execPath, [expoBin, 'install', '--check'], {
    cwd: fixtureDir,
    env: {
      ...process.env,
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      EXPO_OFFLINE: '1',
    },
  });

  const config = JSON.parse(
    run(process.execPath, [expoBin, 'config', '--type', 'public', '--json'], {
      cwd: fixtureDir,
      env: {
        ...process.env,
        CI: '1',
        EXPO_NO_TELEMETRY: '1',
        EXPO_OFFLINE: '1',
      },
    })
  );

  if (
    config.slug !== 'vellira-clean-expo-candidate' ||
    !Array.isArray(config.platforms) ||
    !config.platforms.includes('ios') ||
    !config.platforms.includes('android')
  ) {
    throw new Error(
      'Expo public config does not retain the clean iOS/Android consumer identity.'
    );
  }

  if (
    typeof config.sdkVersion !== 'string' ||
    !config.sdkVersion.startsWith('57.')
  ) {
    throw new Error(
      'Expo public config does not resolve to the expected SDK 57 line.'
    );
  }

  return {
    compatible: true,
    sdkVersion: config.sdkVersion,
    platforms: config.platforms,
  };
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to allocate an Expo development port.'));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({ body, statusCode: response.statusCode ?? 0 });
      });
    });

    request.setTimeout(30_000, () => {
      request.destroy(new Error('Expo bundle request timed out.'));
    });
    request.on('error', reject);
  });
}

async function waitForPlatformBundle(child, url, marker, stdout, stderr) {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        'Expo development server exited early.\n' +
          stdout() +
          '\n' +
          stderr()
      );
    }

    try {
      const response = await get(url);
      if (
        response.statusCode === 200 &&
        response.body.includes(marker) &&
        response.body.length > 10_000
      ) {
        return response;
      }
    } catch {
      // Retry until the bounded Metro startup deadline.
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error(
    'Expo development server did not produce the requested native bundle.\n' +
      stdout() +
      '\n' +
      stderr()
  );
}

async function verifyDevelopmentBundles(fixtureDir, expoBin) {
  const port = await findFreePort();
  const child = spawn(
    process.execPath,
    [
      expoBin,
      'start',
      '--offline',
      '--localhost',
      '--port',
      String(port),
    ],
    {
      cwd: fixtureDir,
      env: {
        ...process.env,
        CI: '1',
        EXPO_NO_TELEMETRY: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  try {
    const baseUrl = 'http://127.0.0.1:' + String(port) + '/index.bundle';
    const query = '&dev=true&hot=false&lazy=false&minify=false';

    const ios = await waitForPlatformBundle(
      child,
      baseUrl + '?platform=ios' + query,
      'Candidate Native Button',
      () => stdout,
      () => stderr
    );
    const android = await waitForPlatformBundle(
      child,
      baseUrl + '?platform=android' + query,
      'Candidate Native Checkbox',
      () => stdout,
      () => stderr
    );

    return {
      host: '127.0.0.1',
      port,
      ios: {
        status: ios.statusCode,
        bundleBytes: Buffer.byteLength(ios.body),
      },
      android: {
        status: android.statusCode,
        bundleBytes: Buffer.byteLength(android.body),
      },
    };
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 5_000);
      child.once('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    if (child.exitCode === null) {
      child.kill('SIGKILL');
    }
  }
}

function listFiles(root, current = root, files = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      listFiles(root, entryPath, files);
    } else if (entry.isFile()) {
      files.push({
        name: path.relative(root, entryPath).replaceAll(path.sep, '/'),
        size: fs.statSync(entryPath).size,
      });
    }
  }
  return files;
}

function verifyProductionExports(fixtureDir, expoBin) {
  const distDir = path.join(fixtureDir, 'dist');
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.rmSync(path.join(fixtureDir, '.expo'), {
    recursive: true,
    force: true,
  });

  run(
    process.execPath,
    [
      expoBin,
      'export',
      '--platform',
      'ios',
      '--platform',
      'android',
      '--output-dir',
      distDir,
    ],
    {
      cwd: fixtureDir,
      env: {
        ...process.env,
        CI: '1',
        EXPO_NO_TELEMETRY: '1',
        EXPO_OFFLINE: '1',
      },
    }
  );

  if (!fs.existsSync(distDir)) {
    throw new Error('Expo production export emitted no output directory.');
  }

  const files = listFiles(distDir);
  const iosFiles = files.filter(({ name }) => name.includes('/ios/'));
  const androidFiles = files.filter(({ name }) => name.includes('/android/'));

  if (
    iosFiles.length === 0 ||
    iosFiles.reduce((total, file) => total + file.size, 0) < 10_000
  ) {
    throw new Error('Expo production export emitted no substantive iOS bundle.');
  }

  if (
    androidFiles.length === 0 ||
    androidFiles.reduce((total, file) => total + file.size, 0) < 10_000
  ) {
    throw new Error(
      'Expo production export emitted no substantive Android bundle.'
    );
  }

  return {
    ios: {
      files: iosFiles,
      bytes: iosFiles.reduce((total, file) => total + file.size, 0),
    },
    android: {
      files: androidFiles,
      bytes: androidFiles.reduce((total, file) => total + file.size, 0),
    },
  };
}

async function main() {
  const candidate = validateCandidateArtifactDirectory(
    candidateDir,
    expectedSha,
    NATIVE_PACKAGE_NAMES
  );
  const fixtureDir = createFixture(candidate);

  try {
    run(
      'npm',
      ['install', '--no-audit', '--no-fund', '--package-lock=true'],
      { cwd: fixtureDir }
    );

    const installedPackages = assertInstalledCandidatePackages(
      fixtureDir,
      candidate,
      NATIVE_PACKAGE_NAMES
    );
    const nativeEntryPoints = verifyNativeEntryPoints(fixtureDir);
    const expoBin = path.join(
      fixtureDir,
      'node_modules',
      'expo',
      'bin',
      'cli'
    );

    if (!fs.existsSync(expoBin)) {
      throw new Error('Clean consumer is missing the Expo CLI entry point.');
    }

    const expoCompatibility = verifyExpoDependencyCompatibility(
      fixtureDir,
      expoBin
    );
    run('npm', ['run', 'typecheck'], { cwd: fixtureDir });
    const development = await verifyDevelopmentBundles(
      fixtureDir,
      expoBin
    );
    const production = verifyProductionExports(fixtureDir, expoBin);

    const evidence = {
      schemaVersion: 1,
      consumer: 'expo',
      candidate: {
        sha: candidate.manifest.source.sha,
        version: candidate.manifest.version,
        manifestSha256: candidate.manifestSha256,
        packages: candidate.packages.map(
          ({ name, version, filename, sha256, npmIntegrity }) => ({
            name,
            version,
            filename,
            sha256,
            npmIntegrity,
          })
        ),
      },
      tooling: {
        node: process.version,
        npm: run('npm', ['--version'], { cwd: fixtureDir }),
        expo: readJson(
          path.join(fixtureDir, 'node_modules/expo/package.json')
        ).version,
        react: readJson(
          path.join(fixtureDir, 'node_modules/react/package.json')
        ).version,
        reactNative: readJson(
          path.join(fixtureDir, 'node_modules/react-native/package.json')
        ).version,
        typescript: readJson(
          path.join(fixtureDir, 'node_modules/typescript/package.json')
        ).version,
      },
      checks: {
        artifactProvenance: true,
        cleanInstall: true,
        noWorkspaceResolution: true,
        nativeEntryPoints,
        representativeNativeSurface: true,
        typecheck: true,
        expoDependencyCompatibility: expoCompatibility,
        developmentStartup: development,
        productionExport: production,
        installedPackages,
      },
    };

    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    fs.writeFileSync(
      evidencePath,
      JSON.stringify(evidence, null, 2) + '\n'
    );

    console.log(
      '[expo-consumer] Verified exact candidate ' +
        evidence.candidate.sha +
        ' at version ' +
        evidence.candidate.version +
        ' in a clean Expo application.'
    );
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
