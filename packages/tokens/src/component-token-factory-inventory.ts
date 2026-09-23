/** Validate historical, generated, maintained and filesystem evidence together. */
export type ComponentFactoryInventoryEntry = {
  name: string;
  source: string;
};

export type ComponentFactoryInventoryInput = {
  historicalNames: readonly string[];
  generated: readonly ComponentFactoryInventoryEntry[];
  maintained: readonly ComponentFactoryInventoryEntry[];
  files: readonly { name: string; regularFile: boolean }[];
};

const sourceDirectory = 'packages/tokens/src/factories/components';

export function validateComponentFactoryInventory({
  historicalNames,
  generated,
  maintained,
  files,
}: ComponentFactoryInventoryInput): readonly string[] {
  const findings: string[] = [];
  const expected = [
    ...historicalNames.map((name) => ({
      name,
      source: `${sourceDirectory}/${name}.ts`,
    })),
    ...generated,
  ];

  for (const [label, entries] of [
    ['authority', expected],
    ['maintained', maintained],
  ] as const) {
    const names = new Set<string>();
    const sources = new Set<string>();
    for (const { name, source } of entries) {
      if (
        !/^create[A-Z][A-Za-z0-9]*Tokens$/.test(name) ||
        name.includes('Palette')
      ) {
        findings.push(`${label}: invalid factory name ${name}`);
      }
      if (source !== `${sourceDirectory}/${name}.ts`) {
        findings.push(`${label}: noncanonical source for ${name}`);
      }
      if (names.has(name)) findings.push(`${label}: duplicate name ${name}`);
      if (sources.has(source)) {
        findings.push(`${label}: duplicate source ${source}`);
      }
      names.add(name);
      sources.add(source);
    }
  }

  const signatures = (entries: readonly ComponentFactoryInventoryEntry[]) =>
    entries.map(({ name, source }) => JSON.stringify([name, source])).sort();
  if (
    JSON.stringify(signatures(expected)) !==
    JSON.stringify(signatures(maintained))
  ) {
    findings.push('maintained inventory differs from authority');
  }

  for (const file of files) {
    if (!file.regularFile) {
      findings.push(`factory entry is not a regular file: ${file.name}`);
    }
    if (!file.name.endsWith('.ts')) {
      findings.push(`unexpected factory entry: ${file.name}`);
    }
  }
  const expectedFiles = expected.map(({ name }) => `${name}.ts`).sort();
  const observedFiles = files.map(({ name }) => name).sort();
  if (JSON.stringify(expectedFiles) !== JSON.stringify(observedFiles)) {
    findings.push('factory files differ from authority');
  }

  return findings;
}
