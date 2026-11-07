import fs from 'node:fs';
import path from 'node:path';

const generatedDirectories = new Set([
  'node_modules',
  '.next',
  'dist',
  'coverage',
]);

/** Fixtures copy authored inputs and reuse the installed dependency graph. */
export function copyFixtureSource(
  root: string,
  fixture: string,
  relativePath: string
) {
  const source = path.join(root, relativePath);
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, path.join(fixture, relativePath), {
    recursive: true,
    filter: (item) =>
      !path
        .relative(root, item)
        .split(path.sep)
        .some((part) => generatedDirectories.has(part)),
  });
}
