import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  checkMetadataExportContract,
  synchronizeMetadataExportContract,
} from './metadata-export-contract';

const tempRoots: string[] = [];

function createMetadataBarrel(content: string) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-metadata-export-contract-')
  );
  const filePath = path.join(root, 'index.ts');

  tempRoots.push(root);
  fs.writeFileSync(filePath, content);

  return filePath;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('metadata export contract', () => {
  it('synchronizes named exports from the canonical registry', () => {
    const filePath = createMetadataBarrel(`import { avatarMetadata } from './Avatar.metadata';
import { buttonMetadata } from './Button.metadata';

export {
  buttonMetadata,
};

export const componentMetadata = [
  buttonMetadata,
  avatarMetadata,
] as const;
`);
    const updatedFiles: string[] = [];

    expect(checkMetadataExportContract(filePath)).toEqual([filePath]);
    expect(
      synchronizeMetadataExportContract({
        metadataBarrelFile: filePath,
        updatedFiles,
      })
    ).toBe(true);
    expect(checkMetadataExportContract(filePath)).toEqual([]);
    expect(updatedFiles).toEqual([filePath]);
    expect(fs.readFileSync(filePath, 'utf8')).toContain(`export {
  avatarMetadata,
  buttonMetadata,
};`);
  });

  it('is idempotent after the registry and named exports agree', () => {
    const filePath = createMetadataBarrel(`import { avatarMetadata } from './Avatar.metadata';

export {
  avatarMetadata,
};

export const componentMetadata = [
  avatarMetadata,
] as const;
`);
    const updatedFiles: string[] = [];
    const before = fs.readFileSync(filePath, 'utf8');

    expect(
      synchronizeMetadataExportContract({
        metadataBarrelFile: filePath,
        updatedFiles,
      })
    ).toBe(false);
    expect(fs.readFileSync(filePath, 'utf8')).toBe(before);
    expect(updatedFiles).toEqual([]);
  });

  it('fails closed when a canonical registry entry is not imported', () => {
    const filePath = createMetadataBarrel(`export const componentMetadata = [
  avatarMetadata,
] as const;
`);

    expect(() => checkMetadataExportContract(filePath)).toThrow(
      'Canonical component metadata registry entry avatarMetadata is not imported.'
    );
  });

  it('rejects duplicate canonical registry entries', () => {
    const filePath = createMetadataBarrel(`import { avatarMetadata } from './Avatar.metadata';

export const componentMetadata = [
  avatarMetadata,
  avatarMetadata,
] as const;
`);

    expect(() => checkMetadataExportContract(filePath)).toThrow(
      'Duplicate componentMetadata registry entry.'
    );
  });
});
