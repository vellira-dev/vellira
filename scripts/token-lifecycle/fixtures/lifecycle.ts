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
