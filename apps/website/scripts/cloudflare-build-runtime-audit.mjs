import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('next/dist/compiled/acorn');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const posix = (name) => name.split(path.sep).join('/');
function files(root) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const name = path.join(root, entry.name);
      return entry.isDirectory() ? files(name) : entry.isFile() ? [name] : [];
    })
    .sort();
}
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}

// Inspect only generated client runtimes, never application modules. Parse the
// filename functions and evaluate them against every ID in their mapping tables.
export function runtimeReferences(source) {
  const references = [];
  const functions = new Set();
  walk(parse(source, { ecmaVersion: 'latest' }), (node) => {
    if (
      node.type !== 'AssignmentExpression' ||
      node.left.type !== 'MemberExpression'
    )
      return;
    const name = node.left.property.name;
    if (
      !['u', 'miniCssF'].includes(name) ||
      !['ArrowFunctionExpression', 'FunctionExpression'].includes(
        node.right.type
      )
    )
      return;
    functions.add(name);
    const ids = new Set();
    walk(node.right, (child) => {
      if (child.type === 'Property' && child.key.type === 'Literal')
        ids.add(child.key.value);
      // Include optimized conditional mappings as well as object tables.
      if (
        child.type === 'BinaryExpression' &&
        ['===', '=='].includes(child.operator)
      ) {
        for (const side of [child.left, child.right])
          if (side.type === 'Literal') ids.add(side.value);
      }
    });
    const code = source.slice(node.right.start, node.right.end);
    // Also cover a constant filename function. Empty miniCssF is valid.
    if (!ids.size) ids.add(0);
    for (const id of ids) {
      const result = vm.runInNewContext(
        `(${code})(${JSON.stringify(id)})`,
        {},
        { timeout: 1_000 }
      );
      if (result !== undefined)
        references.push({ function: name, id, asset: result });
    }
  });
  if (!functions.has('u'))
    throw new Error('Unsupported Webpack runtime: no chunk filename function');
  if (!references.length)
    throw new Error('Webpack runtime yielded no filename mappings');
  return references;
}

export function auditWebsite(websiteRoot) {
  const root = path.resolve(websiteRoot);
  const nextStatic = path.join(root, '.next/static');
  const assets = path.join(root, '.open-next/assets');
  const inventory = {};
  for (const file of files(assets))
    inventory[posix(path.relative(assets, file))] = hash(fs.readFileSync(file));
  const failures = [];
  const emitted = files(nextStatic);
  if (!emitted.length) throw new Error('No Next static output to audit');
  for (const file of emitted) {
    const name = `_next/static/${posix(path.relative(nextStatic, file))}`;
    if (inventory[name] !== hash(fs.readFileSync(file)))
      failures.push(`Missing or different copied asset: ${name}`);
  }
  const references = [];
  const check = (asset, source) => {
    const name = `_next/${decodeURIComponent(asset).replace(/^\/?_next\//, '')}`;
    references.push({ asset: name, source });
    if (!inventory[name])
      failures.push(`Absent reference: ${name} from ${source}`);
  };
  // Runtime outputs only. .next/dev, compiler caches and trace telemetry are not
  // part of the production reference graph. No size-based skipping of manifests.
  const outputs = [
    ...files(path.join(root, '.next/server')),
    ...files(path.join(root, '.next/static')),
    ...files(path.join(root, '.open-next/cache')),
    ...files(path.join(root, '.open-next/server-functions')).filter(
      (file) => !posix(file).includes('/node_modules/')
    ),
    ...files(assets),
    ...fs
      .readdirSync(path.join(root, '.next'))
      .filter((f) => f.endsWith('manifest.json'))
      .map((f) => path.join(root, '.next', f)),
  ];
  const manifests = {};
  for (const file of outputs) {
    if (!/\.(?:m?js|json|html|rsc|cache)$/.test(file)) continue;
    const source = posix(path.relative(root, file));
    const bytes = fs.readFileSync(file);
    if (/manifest|\.cache$/.test(source)) manifests[source] = hash(bytes);
    const text = bytes
      .toString('utf8')
      .replaceAll('\\"', '"')
      .replaceAll('\\/', '/');
    for (const match of text.matchAll(
      /(?:\/?_next\/)?static\/([^"'\\\s<>]+\.(?:js|css))/g
    )) {
      check(`static/${match[1]}`, source);
    }
  }
  const runtimes = emitted.filter((file) =>
    /\/webpack-[^/]+\.js$/.test(posix(file))
  );
  if (!runtimes.length)
    throw new Error('Expected Webpack runtime in production build');
  const mappings = [];
  for (const file of runtimes) {
    const source = posix(path.relative(root, file));
    for (const ref of runtimeReferences(fs.readFileSync(file, 'utf8'))) {
      mappings.push({ ...ref, source });
      check(ref.asset, `${source} ${ref.function}(${ref.id})`);
    }
  }
  const buildId = fs
    .readFileSync(path.join(root, '.next/BUILD_ID'), 'utf8')
    .trim();
  const report = {
    buildId,
    emittedCount: emitted.length,
    inventory,
    manifests,
    mappings,
    references,
    failures: [...new Set(failures)],
  };
  return report;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = process.argv[2] ?? 'apps/website';
  const report = auditWebsite(root);
  const output =
    process.argv[3] ?? path.join(root, '.open-next/asset-audit.json');
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(
    `Runtime audit: build=${report.buildId}, emitted=${report.emittedCount}, mappings=${report.mappings.length}, references=${report.references.length}, failures=${report.failures.length}; ${output}`
  );
  if (report.failures.length) {
    console.error(report.failures.join('\n'));
    process.exitCode = 1;
  }
}
