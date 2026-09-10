import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const jsonMode = process.argv.includes('--json');

const maintainedRoots = ['packages', 'apps', 'scripts'];
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.mts', '.cts', '.ts', '.tsx']);
const ignoredDirectoryNames = new Set([
  '.git',
  '.next',
  '.turbo',
  '.vitepress',
  'android',
  'build',
  'coverage',
  'dist',
  'ios',
  'node_modules',
  'storybook-static',
]);

const nonBlockingClonePatterns = [
  /(?:^|\/)__fixtures__(?:\/|$)/,
  /(?:^|\/)__snapshots__(?:\/|$)/,
  /\.manual\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /\.stories\.[cm]?[jt]sx?$/,
  /\.test\.[cm]?[jt]sx?$/,
];

const generatedPathPatterns = [
  /(?:^|\/)generated(?:\/|$)/,
  /(?:^|\/)fixtures(?:\/|$)/,
];

const cloneBaselinePath = path.join(root, 'scripts/source-hygiene-baseline.json');
const cloneBaseline = JSON.parse(fs.readFileSync(cloneBaselinePath, 'utf8'));

if (
  cloneBaseline.schemaVersion !== 1 ||
  !Array.isArray(cloneBaseline.intentionalClonePairs)
) {
  throw new Error('Invalid source-hygiene baseline contract.');
}

const intentionalClonePairs = new Map(
  cloneBaseline.intentionalClonePairs.map((entry) => {
    if (
      !Array.isArray(entry.paths) ||
      entry.paths.length !== 2 ||
      entry.paths.some((entryPath) => typeof entryPath !== 'string') ||
      typeof entry.reason !== 'string' ||
      entry.reason.trim() === ''
    ) {
      throw new Error('Invalid intentional clone baseline entry.');
    }

    return [[...entry.paths].sort().join('::'), entry.reason];
  })
);

const reactSourceRoot = path.join(root, 'packages/react/src');
const canonicalReactImports = [
  {
    root: path.join(reactSourceRoot, 'hooks'),
    rootAlias: '#hooks',
    childAlias: '#hooks',
    kind: 'flat-files',
  },
  {
    root: path.join(reactSourceRoot, 'managers'),
    rootAlias: '#managers',
    childAlias: '#managers',
    kind: 'directory-index',
  },
  {
    root: path.join(reactSourceRoot, 'patterns'),
    rootAlias: '#patterns',
    childAlias: '#patterns',
    kind: 'directory-index',
  },
  {
    root: path.join(reactSourceRoot, 'primitives'),
    rootAlias: '#primitives',
    childAlias: '#primitives',
    kind: 'directory-index',
  },
  {
    root: path.join(reactSourceRoot, 'utils'),
    childAlias: '#utils',
    kind: 'flat-files',
  },
];

const toolingOnlyReactPrefixes = [
  '@assets/',
  '@components/',
  '@patterns/',
  '@primitives/',
  '@styles/',
  '@utils/',
];

const findings = [];

function normalizePath(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function isInside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isTestLike(relativePath) {
  return nonBlockingClonePatterns.some((pattern) => pattern.test(relativePath));
}

function stripKnownSourceExtension(specifier) {
  return specifier.replace(/\.(?:[cm]?[jt]sx?)$/, '');
}

function resolveRelativeSpecifier(sourcePath, specifier) {
  return path.resolve(path.dirname(sourcePath), stripKnownSourceExtension(specifier));
}

function expectedReactAlias(targetPath, rule) {
  const relative = path.relative(rule.root, targetPath).split(path.sep).join('/');
  const withoutIndex = relative.replace(/\/index$/, '').replace(/^index$/, '');

  if (withoutIndex === '' && rule.rootAlias) {
    return rule.rootAlias;
  }

  if (rule.kind === 'flat-files' && withoutIndex && !withoutIndex.includes('/')) {
    return `${rule.childAlias}/${withoutIndex}`;
  }

  if (rule.kind === 'directory-index' && withoutIndex && !withoutIndex.includes('/')) {
    return `${rule.childAlias}/${withoutIndex}`;
  }

  return null;
}

function extractImportSpecifiers(source) {
  const specifiers = [];
  const staticPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const dynamicPattern = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const pattern of [staticPattern, dynamicPattern]) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      specifiers.push({ specifier: match[1], index: match.index });
    }
  }

  return specifiers;
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function addFinding(finding) {
  findings.push({ blocking: true, ...finding });
}

function checkReactImportPolicy(filePath, source) {
  if (!isInside(filePath, reactSourceRoot)) {
    return;
  }

  const relativePath = normalizePath(filePath);
  const isPublicBarrel = relativePath === 'packages/react/src/index.ts';

  for (const { specifier, index } of extractImportSpecifiers(source)) {
    const line = lineNumberAt(source, index);

    if (specifier.startsWith('@/test-utils/')) {
      addFinding({
        rule: 'imports.react-test-utils-alias',
        category: 'imports',
        path: relativePath,
        line,
        reason: `Test import '${specifier}' must use the canonical '@test-utils/${specifier.slice('@/test-utils/'.length)}' alias.`,
      });
      continue;
    }

    if (specifier === '@/primitives') {
      addFinding({
        rule: 'imports.react-tooling-alias',
        category: 'imports',
        path: relativePath,
        line,
        reason: `Source import '${specifier}' uses a tooling-only alias. Use '#primitives'.`,
      });
      continue;
    }

    if (
      specifier.startsWith('@/') ||
      toolingOnlyReactPrefixes.some((prefix) => specifier.startsWith(prefix))
    ) {
      addFinding({
        rule: 'imports.react-tooling-alias',
        category: 'imports',
        path: relativePath,
        line,
        reason: `Source import '${specifier}' uses a tooling-only @ alias. Use the canonical # package import when one exists, otherwise keep the dependency relative.`,
      });
      continue;
    }

    if (!specifier.startsWith('.') || isPublicBarrel) {
      continue;
    }

    const targetPath = resolveRelativeSpecifier(filePath, specifier);

    for (const rule of canonicalReactImports) {
      if (!isInside(targetPath, rule.root) || isInside(filePath, rule.root)) {
        continue;
      }

      const expected = expectedReactAlias(targetPath, rule);
      if (!expected) {
        continue;
      }

      addFinding({
        rule: 'imports.react-canonical-package-import',
        category: 'imports',
        path: relativePath,
        line,
        reason: `Import '${specifier}' crosses a stable package-internal boundary. Use '${expected}'.`,
      });
    }
  }
}

function checkTokenEsmImportPolicy(filePath, source) {
  const tokensSourceRoot = path.join(root, 'packages/tokens/src');
  const relativePath = normalizePath(filePath);
  if (!isInside(filePath, tokensSourceRoot) || isTestLike(relativePath)) {
    return;
  }

  for (const { specifier, index } of extractImportSpecifiers(source)) {
    if (!specifier.startsWith('.')) {
      continue;
    }

    if (/\.(?:css|json|js|mjs|cjs)$/.test(specifier)) {
      continue;
    }

    addFinding({
      rule: 'imports.tokens-explicit-esm-extension',
      category: 'imports',
      path: relativePath,
      line: lineNumberAt(source, index),
      reason: `Relative token-package import '${specifier}' must keep an explicit emitted-runtime extension (normally .js). Do not accept IDE directory-import shortening blindly.`,
    });
  }
}

function walk(directory, files) {
  if (!fs.existsSync(directory)) {
    return;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) {
      continue;
    }

    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, files);
      continue;
    }

    if (!sourceExtensions.has(path.extname(entry.name))) {
      continue;
    }

    files.push(absolute);
  }
}

function normalizedCloneLines(source) {
  const lines = source.split('\n');
  const result = [];
  let inBlockComment = false;

  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index].trim();

    if (inBlockComment) {
      if (line.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (line.startsWith('/*')) {
      if (!line.includes('*/')) {
        inBlockComment = true;
      }
      continue;
    }

    if (
      line === '' ||
      line.startsWith('//') ||
      /^import\b/.test(line) ||
      /^export\s+\{/.test(line)
    ) {
      continue;
    }

    line = line.replace(/\s+/g, ' ');
    result.push({ line, originalLine: index + 1 });
  }

  return result;
}

function isCrossPlatformParityPair(a, b) {
  return (
    (a.startsWith('packages/react/src/') && b.startsWith('packages/react-native/src/')) ||
    (b.startsWith('packages/react/src/') && a.startsWith('packages/react-native/src/'))
  );
}

function isGeneratorOwnedPair(a, b) {
  const generatedWebsiteSurface = /^apps\/website\/src\/component-catalog\/components\/[^/]+\/(?:metadata|.*Api)\.tsx?$/i;
  const websiteReviewSurface = /^apps\/website\/src\/component-catalog\/components\/[^/]+\/(?:.*Accessibility|.*Demo|Native.*Demo|.*Examples|.*Usage)\.tsx$/;
  const generatorTemplate = /^scripts\/generators\/.+\/templates\//;

  if (generatedWebsiteSurface.test(a) || generatedWebsiteSurface.test(b)) {
    return true;
  }

  if (websiteReviewSurface.test(a) && websiteReviewSurface.test(b)) {
    return true;
  }

  if (
    (websiteReviewSurface.test(a) && generatedWebsiteSurface.test(b)) ||
    (websiteReviewSurface.test(b) && generatedWebsiteSurface.test(a))
  ) {
    return true;
  }

  return generatorTemplate.test(a) || generatorTemplate.test(b);
}

function isDeclarativeContractPair(a, b) {
  if (a.endsWith('/index.ts') && b.endsWith('/index.ts')) {
    return true;
  }

  return (
    a === 'apps/website/src/component-catalog/metadata.ts' &&
    b === 'scripts/generators/component-page/model/types.ts'
  ) || (
    b === 'apps/website/src/component-catalog/metadata.ts' &&
    a === 'scripts/generators/component-page/model/types.ts'
  );
}

function cloneSeverity(fileA, fileB) {
  const a = normalizePath(fileA);
  const b = normalizePath(fileB);

  if (intentionalClonePairs.has([a, b].sort().join('::'))) {
    return 'warning';
  }

  if (
    isTestLike(a) ||
    isTestLike(b) ||
    isCrossPlatformParityPair(a, b) ||
    isGeneratorOwnedPair(a, b) ||
    isDeclarativeContractPair(a, b)
  ) {
    return 'warning';
  }

  return 'error';
}

function isThemeComponentFile(relativePath) {
  return /^packages\/tokens\/src\/(?:light|dark|highContrast)\/components\/[^/]+\.ts$/.test(relativePath);
}

export function usesSharedThemeFactory(filePath, sources) {
  const source = sources.get(filePath);
  if (!source) {
    return false;
  }

  const importPattern =
    /import\s+\{\s*(create[A-Z][A-Za-z0-9]*TokensFrom[A-Z][A-Za-z0-9]*)\s*\}\s+from\s+['"]\.\.\/\.\.\/factories\/components\/create[A-Z][A-Za-z0-9]*Tokens\.js['"]/g;
  const themeInputs = new Set(extractThemeInputImports(source));

  let match;
  while ((match = importPattern.exec(source)) !== null) {
    if (exportsThinThemeDelegation(source, match[1], themeInputs)) {
      return true;
    }
  }

  return false;
}

function extractThemeInputImports(source) {
  const themeInputs = [];
  const importPattern =
    /import\s+\{\s*([^}]+?)\s*\}\s+from\s+['"](?:\.\.\/semantic\/[^'"]+|\.\.\/\.\.\/tokens\/[^'"]+)\.js['"]/g;

  let match;
  while ((match = importPattern.exec(source)) !== null) {
    for (const specifier of match[1].split(',')) {
      const [, importedName, localName] =
        /^\s*([A-Za-z][A-Za-z0-9]*)(?:\s+as\s+([A-Za-z][A-Za-z0-9]*))?\s*$/.exec(specifier) ?? [];

      if (importedName) {
        themeInputs.push(localName ?? importedName);
      }
    }
  }

  return themeInputs;
}

function exportsThinThemeDelegation(source, factoryName, themeInputs) {
  const escapedFactory = factoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const directSemanticInputPattern = new RegExp(
    String.raw`export\s+const\s+[A-Za-z][A-Za-z0-9]*\s*=\s*${escapedFactory}\s*\(\s*[A-Za-z][A-Za-z0-9]*\s*\)\s*;`
  );

  const directMatch = directSemanticInputPattern.exec(source);
  if (directMatch) {
    const inputNameMatch = new RegExp(
      String.raw`${escapedFactory}\s*\(\s*([A-Za-z][A-Za-z0-9]*)\s*\)`
    ).exec(directMatch[0]);

    return Boolean(inputNameMatch && themeInputs.has(inputNameMatch[1]));
  }

  const delegationPattern = new RegExp(
    String.raw`export\s+const\s+[A-Za-z][A-Za-z0-9]*\s*=\s*${escapedFactory}\s*\(\s*\{([\s\S]*?)\}\s*\)\s*;`
  );
  const match = delegationPattern.exec(source);

  if (!match) {
    return false;
  }

  const entries = match[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return (
    entries.length > 0 &&
    entries.every((entry) => /^[A-Za-z][A-Za-z0-9]*$/.test(entry) && themeInputs.has(entry))
  );
}

function checkExactThemeComponentDuplication(files, sources) {
  const byDigest = new Map();

  for (const filePath of files) {
    const relative = normalizePath(filePath);
    if (!isThemeComponentFile(relative) || relative.endsWith('/components/index.ts')) {
      continue;
    }

    const digest = crypto.createHash('sha256').update(sources.get(filePath)).digest('hex');
    const group = byDigest.get(digest) ?? [];
    group.push(filePath);
    byDigest.set(digest, group);
  }

  for (const [digest, group] of byDigest.entries()) {
    if (group.length < 2) {
      continue;
    }

    const [first, ...rest] = group;
    const centralized = group.every((filePath) => usesSharedThemeFactory(filePath, sources));
    findings.push({
      rule: 'duplication.theme-component-matrix',
      category: 'duplication',
      severity: centralized ? 'warning' : 'error',
      blocking: !centralized,
      fingerprint: digest,
      path: normalizePath(first),
      line: 1,
      relatedPath: rest.map(normalizePath).join(', '),
      relatedLine: 1,
      reason: centralized
        ? `Theme entry files are byte-identical, but their semantic-to-component mapping is centralized in a shared runtime-safe factory. Keep the thin per-theme entrypoints explicit.`
        : `Theme component files are byte-identical across themes. Centralize theme-independent mapping/geometry in a shared runtime-safe factory/helper so each theme file only supplies theme-local semantic inputs.`,
    });
  }
}

function checkStructuralDuplication(files, sources) {
  const windowSize = 14;
  const minimumCharacters = 320;
  const windows = new Map();

  for (const filePath of files) {
    const relative = normalizePath(filePath);
    if (
      generatedPathPatterns.some((pattern) => pattern.test(relative)) ||
      isThemeComponentFile(relative)
    ) {
      continue;
    }

    const lines = normalizedCloneLines(sources.get(filePath));
    if (lines.length < windowSize) {
      continue;
    }

    for (let index = 0; index <= lines.length - windowSize; index += 1) {
      const slice = lines.slice(index, index + windowSize);
      const normalized = slice.map(({ line }) => line).join('\n');
      if (normalized.length < minimumCharacters) {
        continue;
      }

      const digest = crypto.createHash('sha256').update(normalized).digest('hex');
      const occurrences = windows.get(digest) ?? [];
      occurrences.push({
        filePath,
        line: slice[0].originalLine,
        endLine: slice[slice.length - 1].originalLine,
      });
      windows.set(digest, occurrences);
    }
  }

  const reportedPairs = new Set();
  for (const [digest, occurrences] of windows.entries()) {
    const byFile = new Map();
    for (const occurrence of occurrences) {
      if (!byFile.has(occurrence.filePath)) {
        byFile.set(occurrence.filePath, occurrence);
      }
    }

    const distinct = [...byFile.values()];
    if (distinct.length < 2) {
      continue;
    }

    for (let left = 0; left < distinct.length; left += 1) {
      for (let right = left + 1; right < distinct.length; right += 1) {
        const a = distinct[left];
        const b = distinct[right];
        const pair = [normalizePath(a.filePath), normalizePath(b.filePath)].sort().join('::');
        if (reportedPairs.has(pair)) {
          continue;
        }
        reportedPairs.add(pair);

        const severity = cloneSeverity(a.filePath, b.filePath);
        const baselineReason = intentionalClonePairs.get(pair);
        findings.push({
          rule: 'duplication.material-clone',
          category: 'duplication',
          severity,
          blocking: severity === 'error',
          fingerprint: digest,
          path: normalizePath(a.filePath),
          line: a.line,
          relatedPath: normalizePath(b.filePath),
          relatedLine: b.line,
          reason: severity === 'error'
            ? `Material ${windowSize}-line structural clone also appears at ${normalizePath(b.filePath)}:${b.line}. Extract a clear shared abstraction or add a narrow documented classification if the duplication is intentionally declarative.`
            : baselineReason
              ? `Material ${windowSize}-line clone is an explicit path-scoped baseline exception: ${baselineReason}`
              : `Material ${windowSize}-line clone is in a classified test/story/cross-platform/generator-owned/declarative surface. Keep explicit unless a clearer shared abstraction exists.`,
        });
      }
    }
  }
}

function runSourceHygieneCli() {
  const files = [];
  for (const maintainedRoot of maintainedRoots) {
    walk(path.join(root, maintainedRoot), files);
  }
  files.sort((a, b) => normalizePath(a).localeCompare(normalizePath(b)));

  const sources = new Map();
  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    sources.set(filePath, source);
    checkReactImportPolicy(filePath, source);
    checkTokenEsmImportPolicy(filePath, source);
  }

  checkExactThemeComponentDuplication(files, sources);
  checkStructuralDuplication(files, sources);

  findings.sort((a, b) =>
    [a.path, a.line ?? 0, a.rule, a.relatedPath ?? ''].join(':').localeCompare(
      [b.path, b.line ?? 0, b.rule, b.relatedPath ?? ''].join(':')
    )
  );

  const blockingFindings = findings.filter((finding) => finding.blocking);

  if (jsonMode) {
    process.stdout.write(
      `${JSON.stringify(
        {
          schemaVersion: 1,
          filesScanned: files.length,
          blockingFindings: blockingFindings.length,
          warnings: findings.length - blockingFindings.length,
          findings,
        },
        null,
        2
      )}\n`
    );
  } else if (findings.length === 0) {
    console.log(`Source hygiene: PASS (${files.length} maintained source files scanned)`);
  } else {
    for (const finding of findings) {
      const level = finding.blocking ? 'ERROR' : 'WARN';
      const related = finding.relatedPath
        ? ` -> ${finding.relatedPath}:${finding.relatedLine ?? 1}`
        : '';
      const fingerprint = finding.fingerprint ? ` [${finding.fingerprint.slice(0, 12)}]` : '';
      console.log(
        `${level} ${finding.rule}${fingerprint} ${finding.path}:${finding.line ?? 1}${related}\n  ${finding.reason}`
      );
    }

    console.log(
      `\nSource hygiene: ${blockingFindings.length === 0 ? 'PASS_WITH_WARNINGS' : 'FAIL'} (${blockingFindings.length} blocking, ${findings.length - blockingFindings.length} warnings, ${files.length} files scanned)`
    );
  }

  if (blockingFindings.length > 0) {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runSourceHygieneCli();
}