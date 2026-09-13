import fs from 'node:fs';

const REGISTRY_MARKER = 'export const componentMetadata = [';
const REGISTRY_END_MARKER = '] as const;';
const METADATA_IMPORT_PATTERN =
  /^import \{ ([A-Za-z_$][\w$]*Metadata) \} from ['"]\.\/[^'"]+\.metadata['"];$/gm;
const NAMED_EXPORT_BLOCK_PATTERN =
  /export\s*\{([\s\S]*?)\};\s*(?=export const componentMetadata = \[)/;

function readCanonicalRegistryNames(content: string): string[] {
  const registryStart = content.indexOf(REGISTRY_MARKER);

  if (registryStart === -1) {
    throw new Error('Missing canonical componentMetadata registry.');
  }

  const registryEnd = content.indexOf(REGISTRY_END_MARKER, registryStart);

  if (registryEnd === -1) {
    throw new Error('Invalid canonical componentMetadata registry.');
  }

  const names = content
    .slice(registryStart + REGISTRY_MARKER.length, registryEnd)
    .split('\n')
    .map((line) => line.match(/^\s*([A-Za-z_$][\w$]*Metadata),\s*$/)?.[1])
    .filter((name): name is string => Boolean(name));

  if (new Set(names).size !== names.length) {
    throw new Error('Duplicate componentMetadata registry entry.');
  }

  return [...names].sort();
}

function readImportedMetadataNames(content: string): Set<string> {
  return new Set(
    [...content.matchAll(METADATA_IMPORT_PATTERN)].map((match) => match[1])
  );
}

function readNamedExportNames(content: string): string[] {
  const match = content.match(NAMED_EXPORT_BLOCK_PATTERN);

  if (!match) {
    return [];
  }

  return match[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .sort();
}

function assertRegistryImports(content: string, registryNames: string[]) {
  const importedNames = readImportedMetadataNames(content);

  for (const name of registryNames) {
    if (!importedNames.has(name)) {
      throw new Error(
        `Canonical component metadata registry entry ${name} is not imported.`
      );
    }
  }
}

function arraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function renderNamedExportBlock(names: string[]) {
  return `export {\n${names.map((name) => `  ${name},`).join('\n')}\n};\n\n`;
}

export function checkMetadataExportContract(
  metadataBarrelFile: string
): string[] {
  const content = fs.readFileSync(metadataBarrelFile, 'utf8');
  const registryNames = readCanonicalRegistryNames(content);

  assertRegistryImports(content, registryNames);

  return arraysEqual(readNamedExportNames(content), registryNames)
    ? []
    : [metadataBarrelFile];
}

export function synchronizeMetadataExportContract(params: {
  metadataBarrelFile: string;
  updatedFiles: string[];
}): boolean {
  const { metadataBarrelFile, updatedFiles } = params;
  const content = fs.readFileSync(metadataBarrelFile, 'utf8');
  const registryNames = readCanonicalRegistryNames(content);

  assertRegistryImports(content, registryNames);

  if (arraysEqual(readNamedExportNames(content), registryNames)) {
    return false;
  }

  const exportBlock = renderNamedExportBlock(registryNames);
  const existingExportBlock = content.match(NAMED_EXPORT_BLOCK_PATTERN);
  const registryStart = content.indexOf(REGISTRY_MARKER);
  const nextContent = existingExportBlock
    ? content.replace(NAMED_EXPORT_BLOCK_PATTERN, exportBlock)
    : `${content.slice(0, registryStart)}${exportBlock}${content.slice(registryStart)}`;

  fs.writeFileSync(metadataBarrelFile, nextContent);

  if (!updatedFiles.includes(metadataBarrelFile)) {
    updatedFiles.push(metadataBarrelFile);
  }

  return true;
}
