const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  NATIVE_PACKAGE_NAMES,
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
    'consumer-evidence/docs-first-use.json'
);

const docsPaths = Object.freeze({
  rootReadme: 'README.md',
  reactReadme: 'packages/react/README.md',
  nativeReadme: 'packages/react-native/README.md',
  gettingStarted: 'apps/docs/src/start/getting-started.md',
  reactDocs: 'apps/docs/src/react/index.md',
  nativeDocs: 'apps/docs/src/react-native/index.md',
});

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
    throw new Error('Missing clean documentation tooling version for ' + label + '.');
  }

  const match = range.match(/^[~^]?([0-9]+\.[0-9]+\.[0-9]+)$/);
  if (!match) {
    throw new Error(
      'Clean documentation tooling version for ' +
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

function expectContains(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(label + ' is missing required text: ' + expected);
  }
}

function readDocsSources() {
  return Object.fromEntries(
    Object.entries(docsPaths).map(([key, filePath]) => [
      key,
      fs.readFileSync(filePath, 'utf8'),
    ])
  );
}

function verifyInstallContract(sources, candidate) {
  const reactPackage = readJson('packages/react/package.json');
  const nativePackage = readJson('packages/react-native/package.json');

  if (
    reactPackage.version !== candidate.manifest.version ||
    nativePackage.version !== candidate.manifest.version
  ) {
    throw new Error(
      'First-use documentation checkout package versions do not match the exact candidate version.'
    );
  }

  for (const [label, source] of [
    ['root README', sources.rootReadme],
    ['Getting Started', sources.gettingStarted],
    ['React docs', sources.reactDocs],
  ]) {
    expectContains(source, 'pnpm add ' + reactPackage.name, label);
    expectContains(source, "import '@vellira-ui/react/styles';", label);
  }

  expectContains(
    sources.reactReadme,
    'pnpm add ' + reactPackage.name,
    'React package README'
  );
  expectContains(
    sources.reactReadme,
    "import '@vellira-ui/react/styles';",
    'React package README'
  );

  for (const [peer, range] of Object.entries(reactPackage.peerDependencies ?? {})) {
    for (const [label, source] of [
      ['React package README', sources.reactReadme],
      ['Getting Started', sources.gettingStarted],
      ['React docs', sources.reactDocs],
    ]) {
      expectContains(source, peer + ' ' + range, label);
    }
  }

  const nativeInstallSources = [
    ['root README', sources.rootReadme],
    ['React Native package README', sources.nativeReadme],
    ['Getting Started', sources.gettingStarted],
    ['React Native docs', sources.nativeDocs],
  ];
  const requiredNativeInstallPeers = Object.keys(
    nativePackage.peerDependencies ?? {}
  ).filter((name) => name !== 'react' && name !== 'react-native');

  for (const [label, source] of nativeInstallSources) {
    const commands = source.match(
      /^pnpm add @vellira-ui\/react-native(?: [^\r\n]+)?$/gm
    );
    if (!commands || commands.length === 0) {
      throw new Error(label + ' is missing the React Native install command.');
    }

    for (const command of commands) {
      for (const peer of requiredNativeInstallPeers) {
        expectContains(command, peer, label + ' React Native install command');
      }
    }
  }

  for (const [peer, range] of Object.entries(nativePackage.peerDependencies ?? {})) {
    for (const [label, source] of [
      ['React Native package README', sources.nativeReadme],
      ['Getting Started', sources.gettingStarted],
      ['React Native docs', sources.nativeDocs],
    ]) {
      expectContains(source, peer + ' ' + range, label);
    }
  }

  return {
    packageVersion: candidate.manifest.version,
    reactPackage: reactPackage.name,
    nativePackage: nativePackage.name,
    reactStyles: '@vellira-ui/react/styles',
    nativeRequiredInstallPeers: requiredNativeInstallPeers,
  };
}

function extractFirstTsxBlock(filePath, anchor) {
  const source = fs.readFileSync(filePath, 'utf8');
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) {
    throw new Error(filePath + ' is missing example anchor ' + anchor + '.');
  }

  const open = source.indexOf(String.fromCharCode(96).repeat(3) + 'tsx', anchorIndex + anchor.length);
  if (open < 0) {
    throw new Error(filePath + ' has no TSX block after ' + anchor + '.');
  }

  const bodyStart = source.indexOf('\n', open);
  if (bodyStart < 0) {
    throw new Error(filePath + ' has a malformed TSX fence after ' + anchor + '.');
  }

  const close = source.indexOf('\n' + String.fromCharCode(96).repeat(3), bodyStart + 1);
  if (close < 0) {
    throw new Error(filePath + ' has an unterminated TSX block after ' + anchor + '.');
  }

  const snippet = source.slice(bodyStart + 1, close).trim();
  if (!snippet) {
    throw new Error(filePath + ' has an empty TSX block after ' + anchor + '.');
  }

  return snippet + '\n';
}

function exampleSpecs() {
  return {
    web: [
      {
        id: 'root-react',
        file: docsPaths.rootReadme,
        anchor: '**React**',
      },
      {
        id: 'root-quick-example',
        file: docsPaths.rootReadme,
        anchor: '## Quick Example',
      },
      {
        id: 'react-package-readme',
        file: docsPaths.reactReadme,
        anchor: 'Then use the components:',
      },
      {
        id: 'getting-started-react',
        file: docsPaths.gettingStarted,
        anchor: '### React',
      },
      {
        id: 'react-docs-quick-example',
        file: docsPaths.reactDocs,
        anchor: '## Quick Example',
      },
    ],
    native: [
      {
        id: 'root-react-native',
        file: docsPaths.rootReadme,
        anchor: '**React Native**',
      },
      {
        id: 'react-native-package-readme',
        file: docsPaths.nativeReadme,
        anchor: 'Use the components directly in your React Native application:',
      },
      {
        id: 'getting-started-react-native',
        file: docsPaths.gettingStarted,
        anchor: '### React Native',
      },
      {
        id: 'react-native-docs-basic-example',
        file: docsPaths.nativeDocs,
        anchor: '## Basic Example',
      },
    ],
  };
}

function candidateDependencies(candidate, packageNames) {
  const dependencies = {};
  for (const name of packageNames) {
    const evidence = candidate.packages.find((item) => item.name === name);
    if (!evidence) {
      throw new Error('Exact candidate is missing required package ' + name + '.');
    }
    dependencies[name] = 'file:' + evidence.tarballPath;
  }
  return dependencies;
}

function createWebFixture(candidate, examples) {
  const fixtureDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-docs-web-consumer-')
  );
  const playgroundPackage = readJson('apps/react-playground/package.json');

  const dependencies = {
    ...candidateDependencies(candidate, WEB_PACKAGE_NAMES),
    react: exactVersion(playgroundPackage.dependencies?.react, 'react'),
    'react-dom': exactVersion(
      playgroundPackage.dependencies?.['react-dom'],
      'react-dom'
    ),
  };
  const devDependencies = {
    '@types/react': exactVersion(
      playgroundPackage.devDependencies?.['@types/react'],
      '@types/react'
    ),
    '@types/react-dom': exactVersion(
      playgroundPackage.devDependencies?.['@types/react-dom'],
      '@types/react-dom'
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
        name: 'vellira-docs-first-use-web',
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: { typecheck: 'tsc --noEmit' },
        dependencies,
        devDependencies,
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
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          skipLibCheck: false,
        },
        include: ['examples/**/*.tsx'],
      },
      null,
      2
    ) + '\n'
  );

  for (const example of examples) {
    writeFile(
      fixtureDir,
      'examples/' + example.id + '.tsx',
      extractFirstTsxBlock(example.file, example.anchor)
    );
  }

  return fixtureDir;
}

function createNativeFixture(candidate, examples) {
  const fixtureDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-docs-native-consumer-')
  );
  const playgroundPackage = readJson('apps/native-playground/package.json');
  const nativePackage = readJson('packages/react-native/package.json');
  const peerDependencies = Object.fromEntries(
    Object.keys(nativePackage.peerDependencies ?? {}).map((name) => [
      name,
      exactVersion(playgroundPackage.dependencies?.[name], name),
    ])
  );

  const dependencies = {
    ...candidateDependencies(candidate, NATIVE_PACKAGE_NAMES),
    ...peerDependencies,
  };
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
        name: 'vellira-docs-first-use-native',
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: { typecheck: 'tsc --noEmit' },
        dependencies,
        devDependencies,
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
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022'],
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          skipLibCheck: true,
        },
        include: ['examples/**/*.tsx'],
      },
      null,
      2
    ) + '\n'
  );

  for (const example of examples) {
    writeFile(
      fixtureDir,
      'examples/' + example.id + '.tsx',
      extractFirstTsxBlock(example.file, example.anchor)
    );
  }

  return fixtureDir;
}

function installAndTypecheckFixture(fixtureDir, candidate, packageNames) {
  run(
    'npm',
    ['install', '--no-audit', '--no-fund', '--package-lock=true'],
    { cwd: fixtureDir }
  );
  const installedPackages = assertInstalledCandidatePackages(
    fixtureDir,
    candidate,
    packageNames
  );
  run('npm', ['run', 'typecheck'], { cwd: fixtureDir });

  return {
    installedPackages,
    npm: run('npm', ['--version'], { cwd: fixtureDir }),
    typescript: readJson(
      path.join(fixtureDir, 'node_modules/typescript/package.json')
    ).version,
  };
}

function collectFiles(root, predicate) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath, predicate));
    } else if (entry.isFile() && predicate(entryPath)) {
      files.push(entryPath);
    }
  }
  return files;
}

function routeForMarkdown(docsRoot, filePath) {
  const relative = path.relative(docsRoot, filePath).replaceAll('\\', '/');
  const withoutExtension = relative.replace(/\.md$/, '');
  if (withoutExtension === 'index') return '/';
  if (withoutExtension.endsWith('/index')) {
    return '/' + withoutExtension.slice(0, -'/index'.length) + '/';
  }
  return '/' + withoutExtension;
}

function verifyWebsiteDocsLinks() {
  const docsRoot = path.resolve('apps/docs/src');
  const websiteRoots = [
    path.resolve('apps/website/src'),
    path.resolve('apps/website/content/blog'),
  ];
  const websiteExtensions = new Set(['.md', '.mdx', '.ts', '.tsx']);
  const routes = new Set(
    collectFiles(docsRoot, (filePath) => filePath.endsWith('.md')).map(
      (filePath) => routeForMarkdown(docsRoot, filePath)
    )
  );
  const docsUrlPattern =
    /https:\/\/docs\.vellira\.dev(?:\/[A-Za-z0-9._~:@%/-]*)?/g;
  const invalidLinks = [];
  let checkedLinks = 0;

  for (const root of websiteRoots) {
    for (const filePath of collectFiles(root, (candidate) =>
      websiteExtensions.has(path.extname(candidate))
    )) {
      const source = fs.readFileSync(filePath, 'utf8');
      for (const match of source.matchAll(docsUrlPattern)) {
        const start = match.index ?? 0;
        const lookahead = source.slice(start, start + match[0].length + 2);
        if (lookahead.includes('$' + '{')) continue;

        checkedLinks += 1;
        const url = match[0];
        const pathname = new URL(url).pathname;
        const normalized =
          pathname !== '/' && pathname.endsWith('/')
            ? pathname.slice(0, -1)
            : pathname;
        const exists =
          routes.has(pathname) ||
          routes.has(normalized) ||
          routes.has(normalized + '/');
        if (!exists) {
          invalidLinks.push({
            file: path.relative(process.cwd(), filePath),
            url,
          });
        }
      }
    }
  }

  if (invalidLinks.length > 0) {
    throw new Error(
      'Public website references stale documentation routes: ' +
        JSON.stringify(invalidLinks)
    );
  }

  return { checkedLinks, invalidLinks: [] };
}

function candidateEvidence(candidate) {
  return {
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
  };
}

async function main() {
  const candidate = validateCandidateArtifactDirectory(
    candidateDir,
    expectedSha
  );
  const sources = readDocsSources();
  const installContract = verifyInstallContract(sources, candidate);
  const links = verifyWebsiteDocsLinks();
  const specs = exampleSpecs();
  const webFixture = createWebFixture(candidate, specs.web);
  const nativeFixture = createNativeFixture(candidate, specs.native);

  try {
    const web = installAndTypecheckFixture(
      webFixture,
      candidate,
      WEB_PACKAGE_NAMES
    );
    const native = installAndTypecheckFixture(
      nativeFixture,
      candidate,
      NATIVE_PACKAGE_NAMES
    );

    const evidence = {
      schemaVersion: 1,
      consumer: 'docs-first-use',
      candidate: candidateEvidence(candidate),
      tooling: {
        node: process.version,
        webNpm: web.npm,
        nativeNpm: native.npm,
        webTypescript: web.typescript,
        nativeTypescript: native.typescript,
      },
      checks: {
        artifactProvenance: true,
        exactPackageVersion: installContract.packageVersion,
        installationInstructions: installContract,
        requiredStylesheetImport: true,
        representativeWebExamplesTypecheck: specs.web.map(({ id, file, anchor }) => ({
          id,
          file,
          anchor,
        })),
        representativeNativeExamplesTypecheck: specs.native.map(
          ({ id, file, anchor }) => ({ id, file, anchor })
        ),
        referencedApisResolveFromPackedDeclarations: true,
        noWorkspaceResolution: true,
        websiteDocsLinks: links,
        webInstalledPackages: web.installedPackages,
        nativeInstalledPackages: native.installedPackages,
      },
    };

    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    fs.writeFileSync(
      evidencePath,
      JSON.stringify(evidence, null, 2) + '\n'
    );

    console.log(
      '[docs-first-use] Verified exact candidate ' +
        evidence.candidate.sha +
        ' at version ' +
        evidence.candidate.version +
        ' against public first-use documentation.'
    );
  } finally {
    fs.rmSync(webFixture, { recursive: true, force: true });
    fs.rmSync(nativeFixture, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
