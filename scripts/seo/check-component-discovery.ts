import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  getDiscoveryContentFindings,
  LEGACY_DISCOVERY_COMPONENTS,
  type DiscoveryContentCandidate,
  type DiscoveryPlatform,
} from './component-discovery-contract';

const root = process.cwd();
const componentsRoot = path.join(
  root,
  'apps/website/src/component-catalog/components'
);
const legacy = new Set<string>(LEGACY_DISCOVERY_COMPONENTS);
const directories = fs
  .readdirSync(componentsRoot, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      fs.existsSync(path.join(componentsRoot, entry.name, 'metadata.ts'))
  )
  .map((entry) => entry.name)
  .sort();

const findings: string[] = [];
let adopted = 0;
let exempt = 0;

for (const componentName of directories) {
  const metadataFile = path.join(componentsRoot, componentName, 'metadata.ts');
  const imported = (await import(pathToFileURL(metadataFile).href)) as {
    default?: { discovery?: DiscoveryContentCandidate };
    metadata?: { discovery?: DiscoveryContentCandidate };
  };
  const discovery = (imported.default ?? imported.metadata)?.discovery;

  if (!discovery && legacy.has(componentName)) {
    exempt += 1;
    continue;
  }

  if (discovery && legacy.has(componentName)) {
    findings.push(
      componentName +
        ': discovery was adopted; remove its temporary #1136 exemption'
    );
  }

  const canonicalFile = path.join(
    root,
    'packages/metadata/src/components',
    componentName + '.metadata.ts'
  );
  const canonicalSource = fs.existsSync(canonicalFile)
    ? fs.readFileSync(canonicalFile, 'utf8')
    : '';
  const stable = /\bstatus\s*:\s*['"]stable['"]/.test(canonicalSource);
  const platformBlock =
    canonicalSource.match(/\bplatforms\s*:\s*\[([\s\S]*?)\]/)?.[1] ?? '';
  const platforms = [
    ...new Set(
      [...platformBlock.matchAll(/['"](react|react-native)['"]/g)].map(
        (match) => match[1] as DiscoveryPlatform
      )
    ),
  ];

  const componentFindings = getDiscoveryContentFindings({
    discovery,
    stable,
    platforms,
  });
  findings.push(
    ...componentFindings.map((finding) => componentName + ': ' + finding)
  );
  adopted += discovery ? 1 : 0;
}

for (const componentName of legacy) {
  if (!directories.includes(componentName)) {
    findings.push(
      componentName + ': stale #1136 legacy discovery exemption'
    );
  }
}

if (findings.length > 0) {
  console.error('Component Discovery Content V1 audit failed:');
  for (const finding of findings) {
    console.error('  - ' + finding);
  }
  process.exitCode = 1;
} else {
  console.log(
    'Component Discovery Content V1: ' +
      directories.length +
      ' checked, ' +
      adopted +
      ' adopted, ' +
      exempt +
      ' explicit legacy exceptions'
  );
}
