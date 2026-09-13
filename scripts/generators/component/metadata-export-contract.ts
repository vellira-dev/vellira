import fs from 'node:fs';

const REGISTRY_MARKER = 'export const componentMetadata = [';
const REGISTRY_END_MARKER = '] as const;';
const METADATA_NAME_PATTERN = /^[A-Za-z_$][\w$]*Metadata$/;
const METADATA_IMPORT_PATTERN =
  /^import \{ ([A-Za-z_$][\w$]*Metadata) \} from ['"]\.\/[^'"]+\.metadata['"];$/gm;
const NAMED_EXPORT_BLOCK_PATTERN =
  /export\s*\{([\s\S]*?)\};\s*(?=export const componentMetadata = \[)/;

function getCanonicalRegistryBounds(content: string) {
  const registryStart = content.indexOf(REGISTRY_MARKER);

  if (registryStart === -1) {
    throw new Error('Missing canonical componentMetadata registry.');
  }

  const registryEnd = content.indexOf(REGISTRY_END_MARKER, registryStart);

  if (registryEnd === -1) {
    throw new Error('Invalid canonical componentMetadata registry.');
  }

  return { registryStart, registryEnd };
}

function readCanonicalRegistryNames(content: string): string[] {
  const { registryStart, registryEnd } = getCanonicalRegistryBounds(content);
  const names = content
    .slice(registryStart + REGISTRY_MARKER.length, registryEnd)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  for (const name of names) {
    if (!METADATA_NAME_PATTERN.test(name)) {
      throw new Error(`Invalid componentMetadata registry entry: ${name}`);
    }
  }

  if (new Set(names).size !== names.length) {
    throw new Error('Duplicate componentMetadata registry entry.');
  }

  return names;
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

function renderCanonicalRegistryBlock(names: string[]) {
  const entries = names.map((name) => `  ${name},`).join('\n');

  return `${REGISTRY_MARKER}\n${entries}${entries ? '\n' : ''}${REGISTRY_END_MARKER}`;
}

function renderNamedExportBlock(names: string[]) {
  if (names.length === 0) {
    return '';
  }

  if (names.length === 1) {
    return `export { ${names[0]} };\n\n`;
  }

  return `export {\n${names.map((name) => `  ${name},`).join('\n')}\n};\n\n`;
}

export function normalizeMetadataRegistryForMutation(
  metadataBarrelFile: string
): boolean {
  const content = fs.readFileSync(metadataBarrelFile, 'utf8');
  const registryNames = readCanonicalRegistryNames(content);

  assertRegistryImports(content, registryNames);

  const { registryStart, registryEnd } = getCanonicalRegistryBounds(content);
  const nextContent =
    content.slice(0, registryStart) +
    renderCanonicalRegistryBlock(registryNames) +
    content.slice(registryEnd + REGISTRY_END_MARKER.length);

  if (content === nextContent) {
    return false;
  }

  fs.writeFileSync(metadataBarrelFile, nextContent);
  return true;
}

export function checkMetadataExportContract(
  metadataBarrelFile: string
): string[] {
  const content = fs.readFileSync(metadataBarrelFile, 'utf8');
  const registryNames = [...readCanonicalRegistryNames(content)].sort();

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
  const registryNames = [...readCanonicalRegistryNames(content)].sort();

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
