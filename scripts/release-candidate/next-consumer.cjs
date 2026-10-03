const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const {
  WEB_PACKAGE_NAMES,
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
    'consumer-evidence/next-consumer.json'
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
    throw new Error('Missing clean Next.js tooling version for ' + label + '.');
  }

  const match = range.match(/^[~^]?([0-9]+\.[0-9]+\.[0-9]+)$/);
  if (!match) {
    throw new Error(
      'Clean Next.js tooling version for ' +
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
    path.join(os.tmpdir(), 'vellira-next-consumer-')
  );
  const rootPackage = readJson(path.resolve('package.json'));
  const websitePackage = readJson(
    path.resolve('apps/website/package.json')
  );
  const reactPackage = readJson(
    path.resolve('packages/react/package.json')
  );

  const dependencies = {
    next: exactVersion(websitePackage.dependencies?.next, 'next'),
    react: exactVersion(websitePackage.dependencies?.react, 'react'),
    'react-dom': exactVersion(
      websitePackage.dependencies?.['react-dom'],
      'react-dom'
    ),
  };

  for (const packageEvidence of candidate.packages) {
    dependencies[packageEvidence.name] =
      'file:' + packageEvidence.tarballPath;
  }

  const devDependencies = {
    '@types/node': exactVersion(
      rootPackage.devDependencies?.['@types/node'],
      '@types/node'
    ),
    '@types/react': exactVersion(
      reactPackage.devDependencies?.['@types/react'],
      '@types/react'
    ),
    '@types/react-dom': exactVersion(
      reactPackage.devDependencies?.['@types/react-dom'],
      '@types/react-dom'
    ),
    typescript: exactVersion(
      rootPackage.devDependencies?.typescript,
      'typescript'
    ),
  };

  writeFile(
    fixtureDir,
    'package.json',
    JSON.stringify(
      {
        name: 'vellira-clean-next-candidate-consumer',
        private: true,
        version: '0.0.0',
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          typecheck: 'tsc --noEmit',
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
    'next-env.d.ts',
    [
      '/// <reference types="next" />',
      '/// <reference types="next/image-types/global" />',
      '',
      '// This file is intentionally owned by the clean consumer fixture.',
      '',
    ].join('\n')
  );

  writeFile(
    fixtureDir,
    'tsconfig.json',
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2017',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: false,
          skipLibCheck: false,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
        },
        include: [
          'next-env.d.ts',
          '.next/types/**/*.ts',
          '**/*.ts',
          '**/*.tsx',
        ],
        exclude: ['node_modules'],
      },
      null,
      2
    ) + '\n'
  );

  writeFile(
    fixtureDir,
    'app/layout.tsx',
    [
      "import '@vellira-ui/tokens/css';",
      "import '@vellira-ui/react/styles';",
      '',
      "import type { ReactNode } from 'react';",
      '',
      'export default function RootLayout({ children }: { children: ReactNode }) {',
      '  return (',
      '    <html lang="en">',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '}',
      '',
    ].join('\n')
  );

  writeFile(
    fixtureDir,
    'components/CandidatePanel.tsx',
    [
      "'use client';",
      '',
      "import { useState } from 'react';",
      '',
      "import { Button, Input } from '@vellira-ui/react';",
      '',
      'export function CandidatePanel() {',
      "  const [email, setEmail] = useState('candidate@vellira.dev');",
      '',
      '  return (',
      "    <section aria-label='Vellira candidate client component'>",
      '      <Input',
      "        label='Email'",
      '        value={email}',
      '        onValueChange={setEmail}',
      '      />',
      "      <Button appearance='solid' color='primary'>",
      '        Candidate Button',
      '      </Button>',
      '    </section>',
      '  );',
      '}',
      '',
    ].join('\n')
  );

  writeFile(
    fixtureDir,
    'app/page.tsx',
    [
      "import { CandidatePanel } from '../components/CandidatePanel';",
      '',
      'export default function Page() {',
      '  return (',
      '    <main>',
      '      <h1>Clean Next.js Vellira consumer</h1>',
      '      <CandidatePanel />',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n')
  );

  return fixtureDir;
}

function verifyBoundaryContract(fixtureDir) {
  const serverPage = fs.readFileSync(
    path.join(fixtureDir, 'app/page.tsx'),
    'utf8'
  );
  const clientPanel = fs.readFileSync(
    path.join(fixtureDir, 'components/CandidatePanel.tsx'),
    'utf8'
  );
  const layout = fs.readFileSync(
    path.join(fixtureDir, 'app/layout.tsx'),
    'utf8'
  );

  if (/^\s*['"]use client['"]/.test(serverPage)) {
    throw new Error('Next.js page must remain a Server Component.');
  }

  if (!/^\s*['"]use client['"]/.test(clientPanel)) {
    throw new Error('Vellira interactive panel must be a Client Component.');
  }

  if (
    !clientPanel.includes("from '@vellira-ui/react'") ||
    !clientPanel.includes('useState')
  ) {
    throw new Error(
      'Client boundary does not exercise interactive Vellira components.'
    );
  }

  if (
    !layout.includes("import '@vellira-ui/tokens/css'") ||
    !layout.includes("import '@vellira-ui/react/styles'")
  ) {
    throw new Error(
      'Next.js root layout must import the public Vellira styles.'
    );
  }

  return {
    serverPageIsServerComponent: true,
    clientPanelIsClientComponent: true,
    publicStylesOwnedByRootLayout: true,
  };
}

function verifyPackageExports(fixtureDir) {
  const specifiers = [
    '@vellira-ui/react',
    '@vellira-ui/react/styles',
    '@vellira-ui/tokens',
    '@vellira-ui/tokens/css',
    '@vellira-ui/core',
    '@vellira-ui/icons',
    '@vellira-ui/icons/web',
    '@vellira-ui/types',
  ];

  const script = [
    'const specifiers = JSON.parse(process.env.VELLIRA_EXPORTS);',
    'const result = {};',
    'for (const specifier of specifiers) {',
    '  result[specifier] = import.meta.resolve(specifier);',
    '}',
    'process.stdout.write(JSON.stringify(result));',
  ].join('\n');

  const stdout = run(
    process.execPath,
    ['--input-type=module', '--eval', script],
    {
      cwd: fixtureDir,
      env: {
        ...process.env,
        VELLIRA_EXPORTS: JSON.stringify(specifiers),
      },
    }
  );

  const resolved = JSON.parse(stdout);
  const nodeModulesRoot =
    path.join(path.resolve(fixtureDir), 'node_modules') + path.sep;

  for (const [specifier, resolvedUrl] of Object.entries(resolved)) {
    const filePath = new URL(resolvedUrl).pathname;
    const normalized = path.resolve(filePath);

    if (!normalized.startsWith(nodeModulesRoot)) {
      throw new Error(
        specifier +
          ' resolved outside the clean consumer node_modules: ' +
          normalized +
          '.'
      );
    }
  }

  return resolved;
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
        reject(new Error('Unable to allocate a Next.js development port.'));
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

    request.setTimeout(3_000, () => {
      request.destroy(new Error('HTTP request timed out.'));
    });
    request.on('error', reject);
  });
}

async function waitForRenderedPage(child, url, stdout, stderr) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        'Next.js dev server exited early.\n' +
          stdout() +
          '\n' +
          stderr()
      );
    }

    try {
      const response = await get(url);
      if (
        response.statusCode === 200 &&
        response.body.includes('Clean Next.js Vellira consumer') &&
        response.body.includes('Candidate Button') &&
        response.body.includes('Email')
      ) {
        return response;
      }
    } catch {
      // Retry until the bounded startup deadline.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    'Next.js development mode did not render the Vellira consumer page.\n' +
      stdout() +
      '\n' +
      stderr()
  );
}

async function verifyDevelopmentMode(fixtureDir) {
  const port = await findFreePort();
  const nextBin = path.join(
    fixtureDir,
    'node_modules',
    'next',
    'dist',
    'bin',
    'next'
  );
  const child = spawn(
    process.execPath,
    [
      nextBin,
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    {
      cwd: fixtureDir,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: '1',
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
    const response = await waitForRenderedPage(
      child,
      'http://127.0.0.1:' + String(port) + '/',
      () => stdout,
      () => stderr
    );

    return {
      host: '127.0.0.1',
      port,
      status: response.statusCode,
      renderedServerPage: true,
      renderedClientComponent: true,
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

function verifyProductionBuild(fixtureDir) {
  const nextBin = path.join(
    fixtureDir,
    'node_modules',
    'next',
    'dist',
    'bin',
    'next'
  );

  run(process.execPath, [nextBin, 'build'], {
    cwd: fixtureDir,
    env: {
      ...process.env,
      CI: '1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });

  const nextDir = path.join(fixtureDir, '.next');
  const buildIdPath = path.join(nextDir, 'BUILD_ID');
  const staticDir = path.join(nextDir, 'static');
  const serverAppDir = path.join(nextDir, 'server', 'app');

  if (
    !fs.existsSync(buildIdPath) ||
    !fs.existsSync(staticDir) ||
    !fs.existsSync(serverAppDir)
  ) {
    throw new Error(
      'Next.js production build did not emit the expected App Router output.'
    );
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

  const staticFiles = listFiles(staticDir);
  const cssFiles = staticFiles.filter(({ name }) => name.endsWith('.css'));
  const jsFiles = staticFiles.filter(({ name }) => name.endsWith('.js'));

  if (jsFiles.length === 0) {
    throw new Error('Next.js production build emitted no client JavaScript.');
  }

  if (
    cssFiles.length === 0 ||
    cssFiles.reduce((total, file) => total + file.size, 0) < 1_000
  ) {
    throw new Error(
      'Next.js production build did not retain Vellira stylesheet output.'
    );
  }

  const serverFiles = listFiles(serverAppDir);
  const renderedPageModule = serverFiles.some(
    ({ name }) =>
      name.includes('page') &&
      (name.endsWith('.js') || name.endsWith('.js.map'))
  );

  if (!renderedPageModule) {
    throw new Error(
      'Next.js production build emitted no App Router server page module.'
    );
  }

  return {
    buildId: fs.readFileSync(buildIdPath, 'utf8').trim(),
    cssBytes: cssFiles.reduce((total, file) => total + file.size, 0),
    cssFiles,
    jsFiles: jsFiles.map(({ name, size }) => ({ name, size })),
    appRouterServerOutput: renderedPageModule,
  };
}

async function main() {
  const candidate = validateCandidateArtifactDirectory(
    candidateDir,
    expectedSha,
    WEB_PACKAGE_NAMES
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
      WEB_PACKAGE_NAMES
    );

    const boundaries = verifyBoundaryContract(fixtureDir);
    run('npm', ['run', 'typecheck'], { cwd: fixtureDir });
    const resolvedExports = verifyPackageExports(fixtureDir);
    const development = await verifyDevelopmentMode(fixtureDir);
    const production = verifyProductionBuild(fixtureDir);

    const evidence = {
      schemaVersion: 1,
      consumer: 'next',
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
        next: readJson(
          path.join(fixtureDir, 'node_modules/next/package.json')
        ).version,
        typescript: readJson(
          path.join(fixtureDir, 'node_modules/typescript/package.json')
        ).version,
      },
      checks: {
        artifactProvenance: true,
        cleanInstall: true,
        noWorkspaceResolution: true,
        stylesheetSetup: true,
        clientServerBoundaries: boundaries,
        typecheck: true,
        packageExports: resolvedExports,
        development,
        productionBuild: production,
        installedPackages,
      },
    };

    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    fs.writeFileSync(
      evidencePath,
      JSON.stringify(evidence, null, 2) + '\n'
    );

    console.log(
      '[next-consumer] Verified exact candidate ' +
        evidence.candidate.sha +
        ' at version ' +
        evidence.candidate.version +
        ' in a clean Next.js application.'
    );
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
