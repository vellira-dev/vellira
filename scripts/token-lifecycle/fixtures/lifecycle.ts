import fs from 'node:fs';
import path from 'node:path';

import {
  getTokenLifecycleRegistryFile,
  readTokenLifecycleAuthority,
} from '../authority';

// Fixtures copy and mutate the real authority; no test-owned family registry.
export function copyTokenLifecycleFixture(root: string) {
  const file = getTokenLifecycleRegistryFile(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.copyFileSync(getTokenLifecycleRegistryFile(process.cwd()), file);
}

export function mutateTokenLifecycleFixture(
  root: string,
  mutate: (authority: ReturnType<typeof readTokenLifecycleAuthority>) => void
) {
  const authority = readTokenLifecycleAuthority(root);
  mutate(authority);
  let source = authority.source;
  const edits = [
    { node: authority.componentObject, value: authority.components },
    { node: authority.semanticObject, value: authority.semantics },
  ].sort((a, b) => b.node.pos - a.node.pos);
  for (const { node, value } of edits) {
    source =
      source.slice(0, node.getStart(authority.ast)) +
      JSON.stringify(value, null, 2) +
      source.slice(node.end);
  }
  fs.writeFileSync(authority.file, source);
}

export function reserveTokenLifecycleFixture(
  root: string,
  componentName: string
) {
  mutateTokenLifecycleFixture(root, ({ components }) => {
    components[componentName] = {
      ...components.Button,
      status: 'reserved',
      owner: componentName,
      purpose: 'Explicit reservation for this isolated generator fixture.',
    };
  });
}

/**
 * Build root-local Generator V2 token authority for synthetic component tests.
 *
 * The lifecycle registry and preservation baseline are canonical input shapes,
 * but generated addition provenance is deliberately empty. Copying the live
 * migration manifest would couple a synthetic work item to whichever real
 * component was most recently materialized in the checkout.
 */
export function createIsolatedComponentTokenAuthorityFixture(
  root: string,
  componentNames: readonly string[]
) {
  copyTokenLifecycleFixture(root);
  for (const componentName of componentNames) {
    reserveTokenLifecycleFixture(root, componentName);
  }

  const preservationDir = path.join(
    root,
    'packages',
    'tokens',
    'src',
    'preservation'
  );
  fs.mkdirSync(preservationDir, { recursive: true });
  fs.copyFileSync(
    path.resolve(
      'packages/tokens/src/preservation/token-preservation-baseline.v1.json'
    ),
    path.join(preservationDir, 'token-preservation-baseline.v1.json')
  );
  fs.writeFileSync(
    path.join(preservationDir, 'token-migrations.ts'),
    'export const generatedComponentTokenAdditionMigrationsV1 = [] as const;\n'
  );
  fs.copyFileSync(
    path.resolve('packages/tokens/package.json'),
    path.join(root, 'packages/tokens/package.json')
  );
}
