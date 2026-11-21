import fs from 'node:fs';
import path from 'node:path';

import { compositionReport } from './link-compositions';

type Evidence = {
  path: string;
  line: number;
  kind: string;
  testFile: string;
  testTitle: string;
  scope: 'source-contract';
};

const contracts: Evidence[] = [
  {
    path: 'apps/website/src/component-catalog/shared/ComponentSidebar/ComponentSidebar.tsx',
    line: 34,
    kind: 'next-link',
    testFile: 'scripts/checks/vellira-ui-usage/navigation-contracts.test.ts',
    testTitle: 'preserves active location and drawer close callback for catalog navigation',
    scope: 'source-contract',
  },
  {
    path: 'apps/website/src/product-app/AppShell.tsx',
    line: 105,
    kind: 'next-link',
    testFile: 'scripts/checks/vellira-ui-usage/navigation-contracts.test.ts',
    testTitle: 'preserves active state and intercepted components navigation in AppShell',
    scope: 'source-contract',
  },
  {
    path: 'apps/website/src/product-app/AppShell.tsx',
    line: 120,
    kind: 'next-link',
    testFile: 'scripts/checks/vellira-ui-usage/navigation-contracts.test.ts',
    testTitle: 'preserves active state and intercepted components navigation in AppShell',
    scope: 'source-contract',
  },
  {
    path: 'apps/website/src/product-app/AppShell.tsx',
    line: 149,
    kind: 'raw-anchor',
    testFile: 'scripts/checks/vellira-ui-usage/navigation-contracts.test.ts',
    testTitle: 'keeps external workspace navigation protected and drawer-aware',
    scope: 'source-contract',
  },
  {
    path: 'apps/website/src/components/navigation/DesignSystemLink.tsx',
    line: 56,
    kind: 'canonical-button',
    testFile: 'scripts/checks/vellira-ui-usage/dynamic-navigation-evidence.test.ts',
    testTitle: 'keeps canonical link fail-closed for missing href and routes internal links',
    scope: 'source-contract',
  },
  {
    path: 'apps/website/src/sections/home/ProductInterfaceDemo/ProductInterfaceDemo.tsx',
    line: 75,
    kind: 'canonical-button',
    testFile: 'scripts/checks/vellira-ui-usage/dynamic-navigation-evidence.test.ts',
    testTitle: 'uses fixed canonical source destinations for both preview modes',
    scope: 'source-contract',
  },
  {
    path: 'apps/website/src/sections/home/ProductInterfaceDemo/ProductInterfaceDemo.tsx',
    line: 84,
    kind: 'canonical-button',
    testFile: 'scripts/checks/vellira-ui-usage/dynamic-navigation-evidence.test.ts',
    testTitle: 'uses fixed canonical source destinations for both preview modes',
    scope: 'source-contract',
  },
  {
    path: 'apps/website/src/sections/home/Roadmap/Roadmap.tsx',
    line: 362,
    kind: 'canonical-button',
    testFile: 'scripts/checks/vellira-ui-usage/dynamic-navigation-evidence.test.ts',
    testTitle: 'keeps release URL in the fixed GitHub releases namespace',
    scope: 'source-contract',
  },
];

function key(entry: { path: string; line: number; kind: string }): string {
  return [entry.path, entry.line, entry.kind].join(':');
}

export function reconcileLinkEvidence(root = process.cwd()) {
  const inventory = compositionReport(root);
  const pending = inventory.entries.filter(
    (entry) => entry.reviewStatus === 'needs-review'
  );
  const contractByKey = new Map(contracts.map((item) => [key(item), item]));
  const pendingKeys = new Set(pending.map(key));
  const missingContracts = contracts
    .filter((item) => !pendingKeys.has(key(item)))
    .map(key);
  const rows = pending.map((entry) => {
    const contract = contractByKey.get(key(entry));
    const testSource = contract
      ? path.join(root, contract.testFile)
      : undefined;
    const found =
      contract !== undefined &&
      testSource !== undefined &&
      fs.existsSync(testSource) &&
      fs.readFileSync(testSource, 'utf8').includes(contract.testTitle);
    return {
      path: entry.path,
      line: entry.line,
      tag: entry.tag,
      kind: entry.kind,
      status: found ? 'evidence-referenced' : 'unmapped',
      evidence: found ? contract : null,
      // A test reference does not attest the current CI result or browser behavior.
      runtimeVerified: false,
    };
  });
  const referenced = rows.filter(
    (entry) => entry.status === 'evidence-referenced'
  ).length;
  return {
    schemaVersion: 1,
    policy: 'read-only-evidence-index;no-automatic-pass',
    original: {
      total: inventory.total,
      confirmed: inventory.confirmed,
      needsReview: inventory.needsReview,
      complete: inventory.complete,
    },
    referenced,
    unmapped: rows.length - referenced,
    missingContracts,
    rows,
  };
}

if (process.argv[1]?.endsWith('link-evidence-reconciliation.ts')) {
  process.stdout.write(JSON.stringify(reconcileLinkEvidence(), null, 2) + '\n');
}
