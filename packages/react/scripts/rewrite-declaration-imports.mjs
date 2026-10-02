import fs from 'node:fs';
import path from 'node:path';

const packageRoot = path.resolve(import.meta.dirname, '..');
const distRoot = path.join(packageRoot, 'dist');
const manifest = JSON.parse(
  fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
);

function sourceImportTarget(mapping) {
  if (typeof mapping === 'string') return mapping;
  if (!mapping || typeof mapping !== 'object') return null;

  return (
    mapping['vellira-source'] ??
    mapping.source ??
    mapping.default ??
    null
  );
}

const importMappings = Object.entries(manifest.imports ?? {}).map(
  ([specifier, mapping]) => ({
    specifier,
    target: sourceImportTarget(mapping),
  })
);

function resolveSourceTarget(specifier) {
  const exact = importMappings.find(
    (mapping) => mapping.specifier === specifier
  );
  if (exact?.target) return exact.target;

  for (const mapping of importMappings) {
    const starIndex = mapping.specifier.indexOf('*');
    if (starIndex === -1 || !mapping.target) continue;

    const prefix = mapping.specifier.slice(0, starIndex);
    const suffix = mapping.specifier.slice(starIndex + 1);

    if (
      !specifier.startsWith(prefix) ||
      !specifier.endsWith(suffix)
    ) {
      continue;
    }

    const wildcard = specifier.slice(
      prefix.length,
      specifier.length - suffix.length
    );

    return mapping.target.replace('*', wildcard);
  }

  return null;
}

function declarationTargetFor(specifier) {
  const sourceTarget = resolveSourceTarget(specifier);

  if (!sourceTarget || !sourceTarget.startsWith('./src/')) {
    throw new Error(
      'Unable to map package-local declaration import ' +
        specifier +
        ' to package source.'
    );
  }

  const relativeSource = sourceTarget
    .slice('./src/'.length)
    .replace(/\.(?:[cm]?ts|tsx)$/, '');

  const target = path.join(distRoot, relativeSource + '.d.ts');

  if (!fs.existsSync(target)) {
    throw new Error(
      'Declaration target for ' +
        specifier +
        ' does not exist: ' +
        path.relative(packageRoot, target) +
        '.'
    );
  }

  return target;
}

function declarationFiles(root, current = root, files = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name);

    if (entry.isDirectory()) {
      declarationFiles(root, entryPath, files);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.d.ts')) {
      files.push(entryPath);
    }
  }

  return files;
}

function relativeDeclarationSpecifier(fromFile, targetFile) {
  let relative = path
    .relative(path.dirname(fromFile), targetFile)
    .replaceAll(path.sep, '/')
    .replace(/\.d\.ts$/, '');

  if (!relative.startsWith('.')) {
    relative = './' + relative;
  }

  return relative;
}

const files = declarationFiles(distRoot);
let rewrites = 0;

for (const filePath of files) {
  const source = fs.readFileSync(filePath, 'utf8');

  const moduleSpecifierPattern =
    /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])(#[A-Za-z0-9_./*-]+)\2/g;

  const rewritten = source.replace(
    moduleSpecifierPattern,
    (_match, prefix, quote, specifier) => {
      const target = declarationTargetFor(specifier);
      rewrites += 1;
      return (
        prefix +
        quote +
        relativeDeclarationSpecifier(filePath, target) +
        quote
      );
    }
  );

  const unresolved = [
    ...rewritten.matchAll(
      /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])(#[A-Za-z0-9_./*-]+)\1/g
    ),
  ].map((match) => match[2]);
  if (unresolved.length > 0) {
    throw new Error(
      path.relative(packageRoot, filePath) +
        ' retains package-local declaration imports: ' +
        unresolved.join(', ') +
        '.'
    );
  }

  if (rewritten !== source) {
    fs.writeFileSync(filePath, rewritten);
  }
}

console.log(
  '[react] Rewrote ' +
    String(rewrites) +
    ' package-local declaration import(s) across ' +
    String(files.length) +
    ' declaration files.'
);
