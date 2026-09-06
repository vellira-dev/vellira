import fs from 'node:fs';
import path from 'node:path';

import {
  renderSharedBaseTypesTemplate,
  renderSharedCompoundTypesTemplate,
  renderSharedOverlayTypesTemplate,
} from './templates';

import type { ComponentGenerationPlan } from './plan';

export type SharedTypesResult = {
  createdFiles: string[];
  updatedFiles: string[];
};

function insertSharedTypesExport(content: string, exportLine: string) {
  if (content.includes(exportLine)) {
    return content;
  }

  const matches = [...content.matchAll(/^export \* from '([^']+)';$/gm)];

  if (matches.length === 0) {
    return content.length === 0
      ? `${exportLine}\n`
      : `${content.trimEnd()}\n${exportLine}\n`;
  }

  const source = exportLine.match(/'([^']+)'/)?.[1];

  if (!source) {
    throw new Error(`Invalid shared type export: ${exportLine}`);
  }

  for (const match of matches) {
    const matchedSource = match[1];

    if (matchedSource > source) {
      if (match.index === undefined) {
        throw new Error(
          'Unable to resolve shared type export insertion point.'
        );
      }

      return (
        content.slice(0, match.index) +
        `${exportLine}\n` +
        content.slice(match.index)
      );
    }
  }

  const last = matches.at(-1);

  if (!last || last.index === undefined) {
    throw new Error('Unable to resolve shared type export append point.');
  }

  const insertAt = last.index + last[0].length;
  const nextContent =
    content.slice(0, insertAt) + `\n${exportLine}` + content.slice(insertAt);

  return nextContent.endsWith('\n') ? nextContent : `${nextContent}\n`;
}

function renderSharedTypes(plan: ComponentGenerationPlan) {
  switch (plan.profile) {
    case 'base':
      return renderSharedBaseTypesTemplate({
        componentName: plan.componentName,
      });
    case 'compound':
      return renderSharedCompoundTypesTemplate({
        componentName: plan.componentName,
        parts: plan.parts,
      });
    case 'overlay':
      return renderSharedOverlayTypesTemplate({
        componentName: plan.componentName,
      });
    case 'form-control':
      return null;
  }
}

/**
 * Writes shared contracts not already owned by the specialized form-control
 * writer. Whether a contract is shared is decided by plan.typeOwnership; the
 * profile only selects the semantic template shape after ownership is known.
 */
export function writeSharedTypesContract(
  plan: ComponentGenerationPlan
): SharedTypesResult {
  const result: SharedTypesResult = {
    createdFiles: [],
    updatedFiles: [],
  };

  if (plan.typeOwnership !== 'shared') {
    return result;
  }

  const nextSharedTypes = renderSharedTypes(plan);

  if (nextSharedTypes === null) {
    return result;
  }

  const sharedTypesExists = fs.existsSync(plan.sharedTypesFile);
  const currentSharedTypes = sharedTypesExists
    ? fs.readFileSync(plan.sharedTypesFile, 'utf8')
    : '';

  fs.mkdirSync(path.dirname(plan.sharedTypesFile), { recursive: true });

  if (currentSharedTypes !== nextSharedTypes) {
    fs.writeFileSync(plan.sharedTypesFile, nextSharedTypes);

    if (sharedTypesExists) {
      result.updatedFiles.push(plan.sharedTypesFile);
    } else {
      result.createdFiles.push(plan.sharedTypesFile);
    }
  }

  const sharedFileName = path.basename(plan.sharedTypesFile, '.ts');
  const exportLine = `export * from './${sharedFileName}';`;
  const currentBarrel = fs.existsSync(plan.sharedTypesBarrelFile)
    ? fs.readFileSync(plan.sharedTypesBarrelFile, 'utf8')
    : '';
  const nextBarrel = insertSharedTypesExport(currentBarrel, exportLine);

  if (currentBarrel !== nextBarrel) {
    fs.mkdirSync(path.dirname(plan.sharedTypesBarrelFile), { recursive: true });
    fs.writeFileSync(plan.sharedTypesBarrelFile, nextBarrel);
    result.updatedFiles.push(plan.sharedTypesBarrelFile);
  }

  return result;
}

export function checkSharedTypesContract(
  plan: ComponentGenerationPlan
): string[] {
  if (plan.typeOwnership !== 'shared') {
    return [];
  }

  const driftedFiles: string[] = [];
  const sharedFileName = path.basename(plan.sharedTypesFile, '.ts');
  const expectedBarrelExport = `export * from './${sharedFileName}';`;

  if (!fs.existsSync(plan.sharedTypesFile)) {
    driftedFiles.push(plan.sharedTypesFile);
  }

  if (
    !fs.existsSync(plan.sharedTypesBarrelFile) ||
    !fs
      .readFileSync(plan.sharedTypesBarrelFile, 'utf8')
      .includes(expectedBarrelExport)
  ) {
    driftedFiles.push(plan.sharedTypesBarrelFile);
  }

  const metadataSource = fs.existsSync(plan.metadataFile)
    ? fs.readFileSync(plan.metadataFile, 'utf8')
    : '';

  if (
    !metadataSource.includes('dependencies:') ||
    !metadataSource.includes("'@vellira-ui/types'")
  ) {
    driftedFiles.push(plan.metadataFile);
  }

  for (const target of plan.targets) {
    const componentTypesFile = path.join(target.componentDir, 'types.ts');
    const componentTypes = fs.existsSync(componentTypesFile)
      ? fs.readFileSync(componentTypesFile, 'utf8')
      : '';

    if (
      !componentTypes.includes('@vellira-ui/types') ||
      !componentTypes.includes(`Base${plan.componentName}Props`)
    ) {
      driftedFiles.push(componentTypesFile);
    }

    if (plan.parts.includes('Root')) {
      const rootTypesFile = path.join(target.componentDir, 'Root', 'types.ts');
      const rootTypes = fs.existsSync(rootTypesFile)
        ? fs.readFileSync(rootTypesFile, 'utf8')
        : '';
      const rootComponentFile = path.join(
        target.componentDir,
        'Root',
        `${plan.componentName}Root.tsx`
      );
      const rootComponent = fs.existsSync(rootComponentFile)
        ? fs.readFileSync(rootComponentFile, 'utf8')
        : '';

      if (
        !fs.existsSync(rootTypesFile) ||
        !rootTypes.includes(`${plan.componentName}Root consumes`)
      ) {
        driftedFiles.push(rootTypesFile);
      }

      if (
        !rootComponent.includes(`${plan.componentName}Props`) ||
        !rootComponent.includes("from '../types'") ||
        rootComponent.includes(`${plan.componentName}RootProps`)
      ) {
        driftedFiles.push(rootComponentFile);
      }
    }

    if (plan.profile === 'compound') {
      for (const partName of plan.parts.filter(
        (candidate) => candidate !== 'Root'
      )) {
        const partTypesFile = path.join(
          target.componentDir,
          partName,
          'types.ts'
        );
        const partTypes = fs.existsSync(partTypesFile)
          ? fs.readFileSync(partTypesFile, 'utf8')
          : '';

        if (
          !partTypes.includes('@vellira-ui/types') ||
          !partTypes.includes(`Base${plan.componentName}${partName}Props`)
        ) {
          driftedFiles.push(partTypesFile);
        }
      }
    }
  }

  return [...new Set(driftedFiles)];
}
