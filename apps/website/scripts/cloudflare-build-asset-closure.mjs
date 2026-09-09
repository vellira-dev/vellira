import fs from 'node:fs';
import path from 'node:path';

const websiteRoot = path.resolve('apps/website');
const nextCssRoot = path.join(websiteRoot, '.next/static/chunks');
const openNextCssRoot = path.join(
  websiteRoot,
  '.open-next/assets/_next/static/chunks'
);
const openNextRoot = path.join(websiteRoot, '.open-next');

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

function relativeCssSet(root) {
  return new Set(
    listFiles(root)
      .filter((file) => file.endsWith('.css'))
      .map((file) => path.relative(root, file).split(path.sep).join('/'))
  );
}

const nextCss = relativeCssSet(nextCssRoot);
const openNextCss = relativeCssSet(openNextCssRoot);
const missingCopiedCss = [...nextCss].filter((file) => !openNextCss.has(file)).sort();

if (missingCopiedCss.length > 0) {
  console.error('OpenNext omitted CSS files emitted by Next.js:');
  for (const file of missingCopiedCss) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

const deployedCssBasenames = new Set(
  [...openNextCss].map((file) => path.posix.basename(file))
);
const referencedCss = new Set();
const cssTokenPattern = /[A-Za-z0-9_-]+\.css/g;

for (const file of listFiles(openNextRoot)) {
  if (file.startsWith(openNextCssRoot)) {
    continue;
  }

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
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const match of content.matchAll(cssTokenPattern)) {
    referencedCss.add(match[0]);
  }
}

const missingReferencedCss = [...referencedCss]
  .filter((file) => !deployedCssBasenames.has(file))
  .sort();

if (missingReferencedCss.length > 0) {
  console.error('OpenNext output references CSS files absent from deployed static assets:');
  for (const file of missingReferencedCss) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log(
  `OK OpenNext CSS asset closure: ${nextCss.size} Next CSS files, ` +
    `${openNextCss.size} deployed CSS files, ${referencedCss.size} referenced CSS names.`
);
