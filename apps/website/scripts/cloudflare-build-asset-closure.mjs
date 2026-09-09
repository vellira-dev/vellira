import fs from 'node:fs';
import path from 'node:path';

const websiteRoot = path.resolve('apps/website');
const nextRoot = path.join(websiteRoot, '.next');
const nextStaticRoot = path.join(nextRoot, 'static');
const openNextRoot = path.join(websiteRoot, '.open-next');
const openNextAssetsRoot = path.join(openNextRoot, 'assets');
const openNextStaticRoot = path.join(openNextAssetsRoot, '_next/static');

function listFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

  const files = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function relativeCssSet(root) {
  return new Set(
    listFiles(root)
      .filter((file) => file.endsWith('.css'))
      .map((file) => toPosix(path.relative(root, file)))
  );
}

function collectCssReferences(root) {
  const references = new Map();
  const cssAssetPattern =
    /(?:\/?_next\/)?static\/([A-Za-z0-9_./-]+\.css)/g;

  for (const file of listFiles(root)) {
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }

    if (stat.size > 10 * 1024 * 1024) {
      continue;
    }

    let content;
    try {
      content = fs.readFileSync(file, 'utf8').replaceAll('\\/', '/');
    } catch {
      continue;
    }

    for (const match of content.matchAll(cssAssetPattern)) {
      const assetPath = match[1];
      const source = toPosix(path.relative(root, file));
      const sources = references.get(assetPath) ?? new Set();
      sources.add(source);
      references.set(assetPath, sources);
    }
  }

  return references;
}

function missingReferences(references, availableCss) {
  return [...references.entries()]
    .filter(([assetPath]) => !availableCss.has(assetPath))
    .sort(([a], [b]) => a.localeCompare(b));
}

function printMissingReferences(label, missing) {
  console.error(label);
  for (const [assetPath, sources] of missing) {
    console.error(`- ${assetPath}`);
    for (const source of [...sources].sort()) {
      console.error(`  referenced by ${source}`);
    }
  }
}

function readBuildId(file) {
  if (!fs.existsSync(file)) {
    console.error(`Missing build ID file: ${toPosix(path.relative(websiteRoot, file))}`);
    process.exit(1);
  }

  return fs.readFileSync(file, 'utf8').trim();
}

const nextBuildId = readBuildId(path.join(nextRoot, 'BUILD_ID'));
const openNextBuildId = readBuildId(path.join(openNextAssetsRoot, 'BUILD_ID'));
const expectedBuildId = process.env.VELLIRA_BUILD_ID?.trim();

if (nextBuildId !== openNextBuildId) {
  console.error(
    `OpenNext BUILD_ID mismatch: Next=${nextBuildId}, OpenNext=${openNextBuildId}.`
  );
  process.exit(1);
}

if (expectedBuildId && nextBuildId !== expectedBuildId) {
  console.error(
    `Cloudflare BUILD_ID mismatch: expected ${expectedBuildId}, got ${nextBuildId}.`
  );
  process.exit(1);
}

const nextCss = relativeCssSet(nextStaticRoot);
const openNextCss = relativeCssSet(openNextStaticRoot);

if (nextCss.size === 0) {
  console.error('Next.js build emitted no CSS files under .next/static.');
  process.exit(1);
}

const missingCopiedCss = [...nextCss]
  .filter((file) => !openNextCss.has(file))
  .sort();

if (missingCopiedCss.length > 0) {
  console.error('OpenNext omitted CSS files emitted by Next.js:');
  for (const file of missingCopiedCss) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

const nextReferences = collectCssReferences(nextRoot);
const missingNextReferences = missingReferences(nextReferences, nextCss);

if (missingNextReferences.length > 0) {
  printMissingReferences(
    'Next.js output references CSS files absent from .next/static:',
    missingNextReferences
  );
  process.exit(1);
}

const openNextReferences = collectCssReferences(openNextRoot);
const missingOpenNextReferences = missingReferences(
  openNextReferences,
  openNextCss
);

if (missingOpenNextReferences.length > 0) {
  printMissingReferences(
    'OpenNext output references CSS files absent from deployed static assets:',
    missingOpenNextReferences
  );
  process.exit(1);
}

console.log(
  `OK OpenNext CSS asset closure: build ${nextBuildId}, ` +
    `${nextCss.size} Next CSS files, ${openNextCss.size} deployed CSS files, ` +
    `${nextReferences.size} Next asset references, ` +
    `${openNextReferences.size} OpenNext asset references.`
);
