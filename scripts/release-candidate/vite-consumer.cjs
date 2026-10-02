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
    'consumer-evidence/vite-consumer.json'
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
    throw new Error('Missing clean Vite tooling version for ' + label + '.');
  }

  const match = range.match(/^[~^]?([0-9]+\.[0-9]+\.[0-9]+)$/);
  if (!match) {
    throw new Error(
      'Clean Vite tooling version for ' +
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
    path.join(os.tmpdir(), 'vellira-vite-consumer-')
  );
  const rootPackage = readJson(path.resolve('package.json'));
  const playgroundPackage = readJson(
    path.resolve('apps/react-playground/package.json')
  );

  const dependencies = {
    react: exactVersion(
      playgroundPackage.dependencies?.react ?? rootPackage.devDependencies?.react,
      'react'
    ),
    'react-dom': exactVersion(
      playgroundPackage.dependencies?.['react-dom'] ??
        rootPackage.devDependencies?.['react-dom'],
      'react-dom'
    ),
  };

  for (const packageEvidence of candidate.packages) {
    dependencies[packageEvidence.name] =
      'file:' + packageEvidence.tarballPath;
  }

  const devDependencies = {
    '@types/node': exactVersion(
      playgroundPackage.devDependencies?.['@types/node'],
      '@types/node'
    ),
    '@types/react': exactVersion(
      playgroundPackage.devDependencies?.['@types/react'],
      '@types/react'
    ),
    '@types/react-dom': exactVersion(
      playgroundPackage.devDependencies?.['@types/react-dom'],
      '@types/react-dom'
    ),
    '@vitejs/plugin-react': exactVersion(
      playgroundPackage.devDependencies?.['@vitejs/plugin-react'],
      '@vitejs/plugin-react'
    ),
    typescript: exactVersion(
      playgroundPackage.devDependencies?.typescript ??
        rootPackage.devDependencies?.typescript,
      'typescript'
    ),
    vite: exactVersion(
      playgroundPackage.devDependencies?.vite,
      'vite'
    ),
  };

  writeFile(
    fixtureDir,
    'package.json',
    JSON.stringify(
      {
        name: 'vellira-clean-vite-candidate-consumer',
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
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
    'index.html',
    [
      '<!doctype html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      '    <title>Vellira clean Vite consumer</title>',
      '  </head>',
      '  <body>',
      '    <div id="root"></div>',
      '    <script type="module" src="/src/main.tsx"></script>',
      '  </body>',
      '</html>',
      '',
    ].join('\n')
  );

  writeFile(
    fixtureDir,
    'tsconfig.json',
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          useDefineForClassFields: true,
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          allowJs: false,
          skipLibCheck: false,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          module: 'ESNext',
          moduleResolution: 'Bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          types: ['vite/client'],
        },
        include: ['src', 'vite.config.ts'],
      },
      null,
      2
    ) + '\n'
  );

  writeFile(
    fixtureDir,
    'vite.config.ts',
    [
      "import { defineConfig } from 'vite';",
      "import react from '@vitejs/plugin-react';",
      '',
      'export default defineConfig({',
      '  plugins: [react()],',
      '});',
      '',
    ].join('\n')
  );

  writeFile(
    fixtureDir,
    'src/main.tsx',
    [
      "import { StrictMode } from 'react';",
      "import { createRoot } from 'react-dom/client';",
      '',
      "import '@vellira-ui/tokens/css';",
      "import '@vellira-ui/react/styles';",
      "import { Button, Input } from '@vellira-ui/react';",
      '',
      'function App() {',
      '  return (',
      "    <main aria-label='Vellira candidate consumer'>",
      "      <Input label='Email' defaultValue='candidate@vellira.dev' />",
      "      <Button appearance='solid' color='primary'>",
      '        Candidate Button',
      '      </Button>',
      '    </main>',
      '  );',
      '}',
      '',
      "const root = document.getElementById('root');",
      "if (!root) throw new Error('Missing Vite root element.');",
      '',
      'createRoot(root).render(',
      '  <StrictMode>',
      '    <App />',
      '  </StrictMode>',
      ');',
      '',
    ].join('\n')
  );

  return fixtureDir;
}

function verifyRuntimeRender(fixtureDir) {
  const script = [
    "import React from 'react';",
    "import { renderToStaticMarkup } from 'react-dom/server';",
    "import { Button, Input } from '@vellira-ui/react';",
    '',
    'const markup = renderToStaticMarkup(',
    '  React.createElement(',
    "    'main',",
    '    null,',
    "    React.createElement(Input, { label: 'Email', defaultValue: 'candidate@vellira.dev' }),",
    "    React.createElement(Button, { appearance: 'solid', color: 'primary' }, 'Candidate Button')",
    '  )',
    ');',
    "if (!markup.includes('Candidate Button') || !markup.includes('Email')) {",
    "  throw new Error('Representative Vellira components did not render.');",
    '}',
  ].join('\n');

  run(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: fixtureDir,
  });
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
        reject(new Error('Unable to allocate a Vite development port.'));
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
    request.setTimeout(2_000, () => {
      request.destroy(new Error('HTTP request timed out.'));
    });
    request.on('error', reject);
  });
}

async function verifyDevelopmentMode(fixtureDir) {
  const port = await findFreePort();
  const viteBin = path.join(
    fixtureDir,
    'node_modules',
    'vite',
    'bin',
    'vite.js'
  );
  const child = spawn(
    process.execPath,
    [
      viteBin,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      cwd: fixtureDir,
      env: process.env,
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
    const deadline = Date.now() + 20_000;
    let rootResponse = null;

    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(
          'Vite dev server exited early.\n' + stdout + '\n' + stderr
        );
      }

      try {
        const response = await get(
          'http://127.0.0.1:' + String(port) + '/'
        );
        if (response.statusCode === 200) {
          rootResponse = response;
          break;
        }
      } catch {
        // Retry until the bounded startup deadline.
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (!rootResponse || !rootResponse.body.includes('id="root"')) {
      throw new Error(
        'Vite development mode did not serve the clean consumer root.\n' +
          stdout +
          '\n' +
          stderr
      );
    }

    const moduleResponse = await get(
      'http://127.0.0.1:' + String(port) + '/src/main.tsx'
    );
    if (
      moduleResponse.statusCode !== 200 ||
      !moduleResponse.body.includes('Candidate Button')
    ) {
      throw new Error(
        'Vite development mode did not transform the Vellira consumer module.'
      );
    }

    return {
      host: '127.0.0.1',
      port,
      rootStatus: rootResponse.statusCode,
      moduleStatus: moduleResponse.statusCode,
    };
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 3_000);
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
  run('npm', ['run', 'build'], { cwd: fixtureDir });

  const distDir = path.join(fixtureDir, 'dist');
  const assetsDir = path.join(distDir, 'assets');
  const indexPath = path.join(distDir, 'index.html');

  if (!fs.existsSync(indexPath) || !fs.existsSync(assetsDir)) {
    throw new Error('Vite production build did not emit the expected output.');
  }

  const assets = fs
    .readdirSync(assetsDir)
    .map((name) => ({
      name,
      size: fs.statSync(path.join(assetsDir, name)).size,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const jsAssets = assets.filter(({ name }) => name.endsWith('.js'));
  const cssAssets = assets.filter(({ name }) => name.endsWith('.css'));

  if (jsAssets.length === 0) {
    throw new Error('Vite production build emitted no JavaScript bundle.');
  }

  if (
    cssAssets.length === 0 ||
    cssAssets.reduce((total, asset) => total + asset.size, 0) < 1_000
  ) {
    throw new Error(
      'Vite production build did not retain Vellira stylesheet output.'
    );
  }

  return {
    assets,
    cssBytes: cssAssets.reduce(
      (total, asset) => total + asset.size,
      0
    ),
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
      [
        'install',
        '--no-audit',
        '--no-fund',
        '--package-lock=true',
      ],
      { cwd: fixtureDir }
    );

    const installedPackages = assertInstalledCandidatePackages(
      fixtureDir,
      candidate,
      WEB_PACKAGE_NAMES
    );

    run('npm', ['run', 'typecheck'], { cwd: fixtureDir });
    verifyRuntimeRender(fixtureDir);
    const resolvedExports = verifyPackageExports(fixtureDir);
    const development = await verifyDevelopmentMode(fixtureDir);
    const production = verifyProductionBuild(fixtureDir);

    const evidence = {
      schemaVersion: 1,
      consumer: 'vite',
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
        vite: readJson(
          path.join(fixtureDir, 'node_modules/vite/package.json')
        ).version,
        typescript: readJson(
          path.join(fixtureDir, 'node_modules/typescript/package.json')
        ).version,
      },
      checks: {
        artifactProvenance: true,
        cleanInstall: true,
        noWorkspaceResolution: true,
        typecheck: true,
        representativeRender: true,
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
      '[vite-consumer] Verified exact candidate ' +
        evidence.candidate.sha +
        ' at version ' +
        evidence.candidate.version +
        ' in a clean Vite application.'
    );
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
