#!/usr/bin/env node
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

async function files(root, prefix = '') {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(prefix, entry.name);
        if (entry.isSymbolicLink())
          throw new Error('Brand sources must not contain symlinks');
        return entry.isDirectory() ? files(root, path) : [path];
      })
    )
  ).flat();
}

// Shared Vellira artwork and app-owned external brands have separate sources.
// Check ownership collisions before replacing any generated destination.
export async function syncBrand({ source, destination, overlay }) {
  if (overlay) {
    const shared = new Set(await files(source));
    for (const path of await files(overlay)) {
      if (shared.has(path))
        throw new Error(`Conflicting brand ownership: ${path}`);
    }
  }
  await mkdir(dirname(destination), { recursive: true });
  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true });
  if (overlay) await cp(overlay, destination, { recursive: true });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [destinationArg, overlayArg] = process.argv.slice(2);
  if (!destinationArg) {
    throw new Error(
      'Usage: sync-brand <destination-public-brand-dir> [app-brand-source-dir]'
    );
  }
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const workspaceRoot = resolve(packageRoot, '..', '..');
  const source = resolve(packageRoot, 'brand');
  const destination = resolve(workspaceRoot, destinationArg);
  const overlay = overlayArg ? resolve(workspaceRoot, overlayArg) : undefined;
  for (const path of [destination, overlay].filter(Boolean)) {
    if (!path.startsWith(`${workspaceRoot}/`))
      throw new Error('Brand paths must be inside the workspace');
  }
  for (const input of [source, overlay].filter(Boolean)) {
    if (
      input === destination ||
      input.startsWith(`${destination}/`) ||
      destination.startsWith(`${input}/`)
    ) {
      throw new Error('Brand source and destination must not overlap');
    }
  }
  await syncBrand({ source, destination, overlay });
}
