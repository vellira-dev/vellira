#!/usr/bin/env node
// #1906: unpublished candidate for React Native subpath exports.
// All builds, manifests, and resolution checks remain inside a temporary directory.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const pkg = path.join(repo, 'packages/react-native');
const workspaceManifest = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-native-subpaths-'));
const candidate = path.join(temp, 'consumer', 'node_modules', '@vellira-ui', 'react-native');
const variants = [
  { name: 'root', entry: 'src/index.ts', output: 'index.js', declaration: 'index.d.ts', exportKey: '.' },
  { name: 'button', entry: 'src/primitives/Button/index.ts', output: 'button.js',
    declaration: 'primitives/Button/index.d.ts', exportKey: './button' },
  { name: 'theme', entry: 'src/theme/index.ts', output: 'theme.js',
    declaration: 'theme/index.d.ts', exportKey: './theme' },
];
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error([command, ...args, result.error?.message, result.stdout, result.stderr]
      .filter(Boolean).join('\n').slice(-10000));
  }
}
function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
const evidence = { schemaVersion: 1, issue: 1906, kind: 'unpublished-subpath-manifest',
  sourceVersion: workspaceManifest.version, cases: {}, limitations: [
    'This temporary manifest is NOT an npm publication or an approved public API.',
    'Resolving exported paths does not prove Metro runtime, TypeScript typechecking, native linking, or device startup.',
    'Existing Vellira workspace package manifest and dist remain unchanged.',
  ] };
try {
  const types = path.join(temp, 'declarations');
  run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json',
    '--emitDeclarationOnly', '--declarationMap', 'false', '--outDir', types], pkg);
  for (const item of variants) {
    const out = path.join(temp, 'build-' + item.name);
    run('pnpm', ['exec', 'tsdown', item.entry,
      '--config', 'tsdown.config.ts', '--out-dir', out], pkg);
    const js = fs.readdirSync(out).filter(name => /\.(?:js|mjs)$/.test(name));
    if (js.length !== 1) throw new Error(item.name + ': expected exactly one JS output');
    const declarationPath = path.join(types, item.declaration);
    if (!fs.existsSync(declarationPath)) {
      throw new Error(item.name + ': missing actual generated declaration ' + item.declaration);
    }
    copy(path.join(out, js[0]), path.join(candidate, 'dist', item.output));
    evidence.cases[item.name] = {
      entry: item.entry,
      javascriptBytes: fs.statSync(path.join(candidate, 'dist', item.output)).size,
      declaration: item.declaration,
    };
  }
  fs.cpSync(types, path.join(candidate, 'types'), { recursive: true });
  const exports = {};
  for (const item of variants) {
    exports[item.exportKey] = {
      types: './types/' + item.declaration,
      'react-native': './dist/' + item.output,
      import: './dist/' + item.output,
      default: './dist/' + item.output,
    };
  }
  fs.writeFileSync(path.join(candidate, 'package.json'), JSON.stringify({
    name: workspaceManifest.name,
    version: workspaceManifest.version,
    private: true,
    type: 'module',
    exports,
  }, null, 2));
  const consumer = path.join(temp, 'consumer', 'probe.cjs');
  fs.writeFileSync(consumer, '');
  const resolver = createRequire(consumer);
  for (const item of variants) {
    const specifier = workspaceManifest.name +
      (item.exportKey === '.' ? '' : item.exportKey.slice(1));
    const resolved = resolver.resolve(specifier);
    const expected = path.join(candidate, 'dist', item.output);
    if (fs.realpathSync(resolved) !== fs.realpathSync(expected)) {
      throw new Error(item.name + ': export target mismatch (' + resolved + ')');
    }
    const typesTarget = path.join(candidate, 'types', item.declaration);
    if (!fs.existsSync(typesTarget)) throw new Error(item.name + ': missing published type target');
    evidence.cases[item.name].exportsResolve = true;
    evidence.cases[item.name].typeTargetExists = true;
  }
  // Exercise TypeScript's actual Bundler module resolver, not only Node's runtime resolution.
  // This is an export/declaration resolution proof; it is not a complete typecheck
  // of the transitive React Native consumer dependency graph.
  const ts = require(path.join(repo, 'node_modules', 'typescript'));
  const consumerTs = path.join(temp, 'consumer', 'probe.ts');
  fs.writeFileSync(consumerTs, [
    "import type { ButtonProps } from '@vellira-ui/react-native/button';",
    "import type { ThemeProviderProps } from '@vellira-ui/react-native/theme';",
    "import type { ButtonProps as RootButtonProps } from '@vellira-ui/react-native';",
    'export type ConsumerTypes = [ButtonProps, ThemeProviderProps, RootButtonProps];',
    '',
  ].join('\\n'));
  const compilerOptions = {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
  };
  const host = ts.createCompilerHost(compilerOptions);
  for (const item of variants) {
    const specifier = workspaceManifest.name +
      (item.exportKey === '.' ? '' : item.exportKey.slice(1));
    const resolution = ts.resolveModuleName(
      specifier, consumerTs, compilerOptions, host
    ).resolvedModule;
    const expected = path.join(candidate, 'types', item.declaration);
    if (!resolution || fs.realpathSync(resolution.resolvedFileName) !== fs.realpathSync(expected)) {
      throw new Error(item.name + ': TypeScript Bundler export mismatch (' +
        (resolution?.resolvedFileName ?? 'not resolved') + ')');
    }
    evidence.cases[item.name].typescriptBundlerResolves = true;
  }
  const output = path.resolve(process.env.VELLIRA_SUBPATH_EVIDENCE ??
    'consumer-evidence/native-subpath-candidate.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log('[native-subpath-candidate] root', evidence.cases.root.javascriptBytes);
  console.log('[native-subpath-candidate] button', evidence.cases.button.javascriptBytes);
  console.log('[native-subpath-candidate] theme', evidence.cases.theme.javascriptBytes);
  console.log('[native-subpath-candidate] evidence:', output);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
