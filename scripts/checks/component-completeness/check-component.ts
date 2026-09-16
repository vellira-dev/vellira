import fs from 'node:fs';
import path from 'node:path';

import type {
  ComponentMetadata,
  ComponentPlatform,
} from '@vellira-ui/metadata';

import {
  canonicalTokenPaths,
  canonicalTokenRegistryPath,
} from '../../design-resources/authority';
import { createComponentGenerationPlan } from '../../generators/component/plan';
import type { ComponentGenerationPlan } from '../../generators/component/plan';
import { validateComponentGenerationAuthorities } from '../../generators/component/preflight';
import {
  renderComponentTokenBarrelExport,
  renderComponentTokenFactoryBarrelExport,
} from '../../generators/component/templates';
import { checkTestCoverageContract } from './check-test-coverage';
import type {
  ComponentCheckResult,
  ComponentCompletenessResult,
} from './types';

function checkFile(
  filePath: string,
  name: ComponentCheckResult['name'],
  platform?: ComponentPlatform
): ComponentCheckResult {
  return {
    name,
    platform,
    ok: fs.existsSync(filePath),
    details: fs.existsSync(filePath) ? undefined : `Missing file: ${filePath}`,
  };
}

function checkExports(params: {
  componentDir: string;
  layerBarrelFile: string;
  componentName: string;
  platform: ComponentPlatform;
}): ComponentCheckResult {
  const { componentDir, layerBarrelFile, componentName, platform } = params;

  const localIndexFile = path.join(componentDir, 'index.ts');

  if (!fs.existsSync(localIndexFile)) {
    return {
      name: 'exports',
      platform,
      ok: false,
      details: `Missing local export file: ${localIndexFile}`,
    };
  }

  if (!fs.existsSync(layerBarrelFile)) {
    return {
      name: 'exports',
      platform,
      ok: false,
      details: `Missing layer barrel file: ${layerBarrelFile}`,
    };
  }

  const localIndex = fs.readFileSync(localIndexFile, 'utf8');
  const layerBarrel = fs.readFileSync(layerBarrelFile, 'utf8');

  const exportsComponent =
    localIndex.includes(`export * from './${componentName}'`) ||
    localIndex.includes(
      `export { ${componentName} } from './${componentName}'`
    );

  if (!exportsComponent) {
    return {
      name: 'exports',
      ok: false,
      platform,
      details: `Missing component export in ${localIndexFile}`,
    };
  }

  const exportsTypes =
    localIndex.includes("export type * from './types'") ||
    localIndex.includes("export * from './types'") ||
    localIndex.includes("from './types'");

  if (!exportsTypes) {
    return {
      name: 'exports',
      ok: false,
      platform,
      details: `Missing public types export in ${localIndexFile}`,
    };
  }

  const layerExport = `export * from './${componentName}';`;

  if (!layerBarrel.includes(layerExport)) {
    return {
      name: 'exports',
      ok: false,
      platform,
      details: `Missing package export in ${layerBarrelFile}`,
    };
  }

  return {
    name: 'exports',
    platform,
    ok: true,
  };
}

function metadataPlatformToGeneratorPlatform(
  platforms: readonly ComponentPlatform[]
): 'web' | 'native' | 'both' {
  const web = platforms.includes('react');
  const native = platforms.includes('react-native');

  if (web && native) return 'both';
  if (web) return 'web';
  if (native) return 'native';

  throw new Error('Component metadata must declare at least one platform.');
}

function createCompletenessGenerationPlan(params: {
  root: string;
  metadata: ComponentMetadata;
}): ComponentGenerationPlan {
  const { root, metadata } = params;
  const componentTokens = metadata.requirements.componentTokens;

  return createComponentGenerationPlan({
    root,
    options: {
      componentName: metadata.name,
      platform: metadataPlatformToGeneratorPlatform(metadata.platforms),
      layer: metadata.layer,
      category: metadata.category,
      profile: metadata.profile,
      capabilities: metadata.capabilities ?? [],
      dependencies: metadata.dependencies,
      icons: metadata.requirements.icons ?? [],
      tokens: metadata.requirements.tokens ?? [],
      assets: metadata.requirements.assets ?? [],
      ...(componentTokens !== undefined ? { componentTokens } : {}),
      parts: [],
      force: false,
      dryRun: false,
      check: false,
    },
  });
}

function checkMetadataRegistration(
  plan: ComponentGenerationPlan
): ComponentCheckResult {
  if (!fs.existsSync(plan.metadataFile)) {
    return {
      name: 'metadata',
      ok: false,
      details: `Missing canonical metadata file: ${plan.metadataFile}`,
    };
  }

  if (!fs.existsSync(plan.metadataBarrelFile)) {
    return {
      name: 'metadata',
      ok: false,
      details: `Missing canonical metadata registry: ${plan.metadataBarrelFile}`,
    };
  }

  const metadataName = `${plan.componentName[0].toLowerCase()}${plan.componentName.slice(1)}Metadata`;
  const metadataImport = `import { ${metadataName} } from './${plan.componentName}.metadata';`;
  const metadataEntry = `  ${metadataName},`;
  const registry = fs.readFileSync(plan.metadataBarrelFile, 'utf8');

  if (!registry.includes(metadataImport) || !registry.includes(metadataEntry)) {
    return {
      name: 'metadata',
      ok: false,
      details: `Missing canonical metadata registration for ${plan.componentName} in ${plan.metadataBarrelFile}`,
    };
  }

  return {
    name: 'metadata',
    ok: true,
  };
}

const MAX_LOCAL_TYPE_MODULES = 64;

function isInsideComponentRoot(
  componentDir: string,
  candidate: string
): boolean {
  const relative = path.relative(componentDir, candidate);

  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

function resolveLocalTypeModule(params: {
  currentFile: string;
  componentDir: string;
  specifier: string;
}): string[] {
  const { currentFile, componentDir, specifier } = params;
  const unresolved = path.resolve(path.dirname(currentFile), specifier);
  const candidates = path.extname(unresolved)
    ? [unresolved]
    : [
        `${unresolved}.ts`,
        `${unresolved}.tsx`,
        path.join(unresolved, 'index.ts'),
        path.join(unresolved, 'index.tsx'),
      ];

  return candidates.filter(
    (candidate) =>
      isInsideComponentRoot(componentDir, candidate) && fs.existsSync(candidate)
  );
}

function rendererTypesDeriveFromSharedAuthority(params: {
  entryFile: string;
  componentDir: string;
}): boolean {
  const { entryFile, componentDir } = params;
  const pending = [entryFile];
  const visited = new Set<string>();

  while (pending.length > 0 && visited.size < MAX_LOCAL_TYPE_MODULES) {
    const currentFile = pending.shift();

    if (!currentFile || visited.has(currentFile)) {
      continue;
    }

    visited.add(currentFile);

    const source = fs.readFileSync(currentFile, 'utf8');

    if (
      source.includes("from '@vellira-ui/types'") ||
      source.includes('from "@vellira-ui/types"')
    ) {
      return true;
    }

    const specifiers = new Set<string>();
    const typeFromPattern =
      /\b(?:import|export)\s+type\b[\s\S]*?\bfrom\s+['"](\.[^'"]+)['"]/g;
    const exportAllPattern = /\bexport\s+\*\s+from\s+['"](\.[^'"]+)['"]/g;

    for (const pattern of [typeFromPattern, exportAllPattern]) {
      for (const match of source.matchAll(pattern)) {
        const specifier = match[1];

        if (specifier) {
          specifiers.add(specifier);
        }
      }
    }

    const nextFiles = [...specifiers]
      .flatMap((specifier) =>
        resolveLocalTypeModule({
          currentFile,
          componentDir,
          specifier,
        })
      )
      .filter((candidate) => !visited.has(candidate))
      .sort();

    pending.push(...nextFiles);
  }

  return false;
}

function checkTypeOwnership(params: {
  plan: ComponentGenerationPlan;
  metadata: ComponentMetadata;
}): ComponentCheckResult {
  const { plan, metadata } = params;

  if (plan.typeOwnership !== 'shared') {
    return {
      name: 'type-ownership',
      ok: true,
    };
  }

  const errors: string[] = [];

  if (!(metadata.dependencies?.packages ?? []).includes('@vellira-ui/types')) {
    errors.push(
      'Shared component semantics must declare @vellira-ui/types as a canonical package dependency.'
    );
  }

  if (!fs.existsSync(plan.sharedTypesFile)) {
    errors.push(`Missing shared type authority: ${plan.sharedTypesFile}`);
  }

  if (!fs.existsSync(plan.sharedTypesBarrelFile)) {
    errors.push(`Missing shared types barrel: ${plan.sharedTypesBarrelFile}`);
  } else {
    const barrel = fs.readFileSync(plan.sharedTypesBarrelFile, 'utf8');
    const sharedFileName = path.basename(plan.sharedTypesFile, '.ts');
    const expectedExport = `export * from './${sharedFileName}';`;

    if (!barrel.includes(expectedExport)) {
      errors.push(
        `Missing shared type export for ${plan.componentName} in ${plan.sharedTypesBarrelFile}`
      );
    }
  }

  for (const target of plan.targets) {
    const localTypesFile = path.join(target.componentDir, 'types.ts');

    if (!fs.existsSync(localTypesFile)) {
      continue;
    }

    if (
      !rendererTypesDeriveFromSharedAuthority({
        entryFile: localTypesFile,
        componentDir: target.componentDir,
      })
    ) {
      errors.push(
        `Renderer types must derive shared semantics from @vellira-ui/types through the local type graph: ${localTypesFile}`
      );
    }
  }

  return {
    name: 'type-ownership',
    ok: errors.length === 0,
    ...(errors.length > 0 ? { details: errors.join('\n') } : {}),
  };
}

function checkProductionAuthorities(
  plan: ComponentGenerationPlan
): ComponentCheckResult {
  const errors = validateComponentGenerationAuthorities(plan);

  return {
    name: 'production-authorities',
    ok: errors.length === 0,
    ...(errors.length > 0 ? { details: errors.join('\n') } : {}),
  };
}

function checkComponentTokenStructure(
  plan: ComponentGenerationPlan
): ComponentCheckResult {
  const errors: string[] = [];
  const expectedFactoryExport = renderComponentTokenFactoryBarrelExport(
    plan.componentName
  );
  const expectedThemeExport = renderComponentTokenBarrelExport(
    plan.componentName
  );
  const factoryBarrel = fs.existsSync(plan.tokenFactoryBarrelFile)
    ? fs.readFileSync(plan.tokenFactoryBarrelFile, 'utf8')
    : '';

  if (plan.componentTokens === false) {
    if (fs.existsSync(plan.tokenFactoryFile)) {
      errors.push(
        `Unexpected component token factory: ${plan.tokenFactoryFile}`
      );
    }

    if (factoryBarrel.includes(expectedFactoryExport)) {
      errors.push(
        `Unexpected component token factory export in ${plan.tokenFactoryBarrelFile}`
      );
    }

    for (const target of plan.tokenThemeTargets) {
      if (fs.existsSync(target.componentFile)) {
        errors.push(
          `Unexpected component token theme file: ${target.componentFile}`
        );
      }

      const barrel = fs.existsSync(target.barrelFile)
        ? fs.readFileSync(target.barrelFile, 'utf8')
        : '';

      if (barrel.includes(expectedThemeExport)) {
        errors.push(
          `Unexpected component token export in ${target.barrelFile}`
        );
      }
    }
  } else {
    if (!fs.existsSync(plan.tokenFactoryFile)) {
      errors.push(`Missing component token factory: ${plan.tokenFactoryFile}`);
    }

    if (!factoryBarrel.includes(expectedFactoryExport)) {
      errors.push(
        `Missing component token factory export in ${plan.tokenFactoryBarrelFile}`
      );
    }

    for (const target of plan.tokenThemeTargets) {
      if (!fs.existsSync(target.componentFile)) {
        errors.push(
          `Missing component token theme file: ${target.componentFile}`
        );
      }

      const barrel = fs.existsSync(target.barrelFile)
        ? fs.readFileSync(target.barrelFile, 'utf8')
        : '';

      if (!barrel.includes(expectedThemeExport)) {
        errors.push(`Missing component token export in ${target.barrelFile}`);
      }
    }
  }

  return {
    name: 'component-tokens',
    ok: errors.length === 0,
    ...(errors.length > 0 ? { details: errors.join('\n') } : {}),
  };
}

export function checkComponentCompleteness(params: {
  root: string;
  metadata: ComponentMetadata;
}): ComponentCompletenessResult {
  const { root, metadata } = params;
  const checks: ComponentCheckResult[] = [];
  const plan = createCompletenessGenerationPlan({ root, metadata });

  checks.push(checkMetadataRegistration(plan));
  checks.push(checkTypeOwnership({ plan, metadata }));
  checks.push(checkProductionAuthorities(plan));

  if (metadata.requirements.componentTokens !== undefined) {
    checks.push(checkComponentTokenStructure(plan));
  }

  for (const platform of metadata.platforms) {
    const packageName = platform === 'react' ? 'react' : 'react-native';

    const componentDir = path.join(
      root,
      'packages',
      packageName,
      'src',
      metadata.layer,
      metadata.name
    );

    const layerBarrelFile = path.join(
      root,
      'packages',
      packageName,
      'src',
      metadata.layer,
      'index.ts'
    );

    checks.push(
      checkFile(
        path.join(componentDir, `${metadata.name}.tsx`),
        'implementation',
        platform
      )
    );

    checks.push(
      checkFile(path.join(componentDir, 'types.ts'), 'types', platform)
    );

    checks.push(
      checkExports({
        componentDir,
        layerBarrelFile,
        componentName: metadata.name,
        platform,
      })
    );

    if (metadata.requirements.tests) {
      const testFile = path.join(componentDir, `${metadata.name}.test.tsx`);
      const contractFile = path.join(
        componentDir,
        `${metadata.name}.test-contract.json`
      );

      checks.push(
        fs.existsSync(contractFile)
          ? checkTestCoverageContract({
              contractFile,
              testFile,
              metadata,
              platform,
            })
          : checkFile(testFile, 'tests', platform)
      );
    }

    if (metadata.requirements.storybook) {
      checks.push(
        checkFile(
          path.join(componentDir, `${metadata.name}.stories.tsx`),
          'storybook',
          platform
        )
      );
    }
  }

  if (metadata.requirements.docs) {
    checks.push(
      checkWebsiteDocumentation({
        root,
        componentName: metadata.name,
      })
    );

    checks.push(
      checkApiDocumentation({
        root,
        componentName: metadata.name,
        platforms: metadata.platforms,
      })
    );
  }

  if (metadata.requirements.accessibility) {
    checks.push(
      checkAccessibilityDocumentation({
        root,
        componentName: metadata.name,
      })
    );
  }

  if (metadata.requirements.tokens?.length) {
    checks.push(
      checkTokenRequirements({
        root,
        requiredTokens: metadata.requirements.tokens,
      })
    );
  }

  return {
    componentName: metadata.name,
    ready: checks.every((check) => check.ok),
    checks,
  };
}

function componentNameToSlug(componentName: string) {
  return componentName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function checkWebsiteDocumentation(params: {
  root: string;
  componentName: string;
}): ComponentCheckResult {
  const { root, componentName } = params;

  const slug = componentNameToSlug(componentName);

  const componentPresentationRegistryFile = path.join(
    root,
    'apps',
    'website',
    'src',
    'component-catalog',
    'registry',
    'componentPresentation.ts'
  );

  const componentPagesRegistryFile = path.join(
    root,
    'apps',
    'website',
    'src',
    'component-catalog',
    'registry',
    'componentPages.ts'
  );

  if (!fs.existsSync(componentPresentationRegistryFile)) {
    return {
      name: 'website',
      ok: false,
      details: `Missing website component presentation registry: ${componentPresentationRegistryFile}`,
    };
  }

  if (!fs.existsSync(componentPagesRegistryFile)) {
    return {
      name: 'website',
      ok: false,
      details: `Missing website component pages registry: ${componentPagesRegistryFile}`,
    };
  }

  const componentPresentationRegistry = fs.readFileSync(
    componentPresentationRegistryFile,
    'utf8'
  );
  const componentPagesRegistry = fs.readFileSync(
    componentPagesRegistryFile,
    'utf8'
  );

  const catalogEntry = `slug: '${slug}'`;
  const quotedPageEntry = `'${slug}':`;
  const plainPageEntry = `${slug}:`;

  if (!componentPresentationRegistry.includes(catalogEntry)) {
    return {
      name: 'website',
      ok: false,
      details: `Missing "${slug}" in website component catalog.`,
    };
  }

  if (
    !componentPagesRegistry.includes(quotedPageEntry) &&
    !componentPagesRegistry.includes(plainPageEntry)
  ) {
    return {
      name: 'website',
      ok: false,
      details: `Missing "${slug}" in website component pages registry.`,
    };
  }

  return {
    name: 'website',
    ok: true,
  };
}

function checkApiDocumentation(params: {
  root: string;
  componentName: string;
  platforms: readonly ('react' | 'react-native')[];
}): ComponentCheckResult {
  const { root, componentName, platforms } = params;

  const slug = componentNameToSlug(componentName);

  const componentPagesRegistryFile = path.join(
    root,
    'apps',
    'website',
    'src',
    'component-catalog',
    'registry',
    'componentPages.ts'
  );

  if (!fs.existsSync(componentPagesRegistryFile)) {
    return {
      name: 'api-docs',
      ok: false,
      details: `Missing website component pages registry: ${componentPagesRegistryFile}`,
    };
  }

  const content = fs.readFileSync(componentPagesRegistryFile, 'utf8');

  const quotedPageEntry = `'${slug}':`;
  const plainPageEntry = `${slug}:`;

  const pageStart = content.includes(quotedPageEntry)
    ? content.indexOf(quotedPageEntry)
    : content.indexOf(plainPageEntry);

  if (pageStart === -1) {
    return {
      name: 'api-docs',
      ok: false,
      details: `Missing "${slug}" component page registration.`,
    };
  }

  const nextEntryMatch = content
    .slice(pageStart + 1)
    .match(/\n\s{2}(?:'[^']+'|[a-zA-Z0-9-]+):\s*{/);

  const pageBlock =
    nextEntryMatch?.index !== undefined
      ? content.slice(pageStart, pageStart + 1 + nextEntryMatch.index)
      : content.slice(pageStart);

  if (!pageBlock.includes('api:')) {
    return {
      name: 'api-docs',
      ok: false,
      details: `Missing API documentation for "${slug}".`,
    };
  }

  for (const platform of platforms) {
    const platformKey =
      platform === 'react-native' ? `'react-native':` : 'react:';

    if (!pageBlock.includes(platformKey)) {
      return {
        name: 'api-docs',
        ok: false,
        details: `Missing ${platform} API documentation for "${slug}".`,
      };
    }
  }

  return {
    name: 'api-docs',
    ok: true,
  };
}

function checkAccessibilityDocumentation(params: {
  root: string;
  componentName: string;
}): ComponentCheckResult {
  const { root, componentName } = params;

  const slug = componentNameToSlug(componentName);

  const componentPagesRegistryFile = path.join(
    root,
    'apps',
    'website',
    'src',
    'component-catalog',
    'registry',
    'componentPages.ts'
  );

  if (!fs.existsSync(componentPagesRegistryFile)) {
    return {
      name: 'accessibility',
      ok: false,
      details: `Missing website component pages registry: ${componentPagesRegistryFile}`,
    };
  }

  const content = fs.readFileSync(componentPagesRegistryFile, 'utf8');

  const quotedPageEntry = `'${slug}':`;
  const plainPageEntry = `${slug}:`;

  const pageStart = content.includes(quotedPageEntry)
    ? content.indexOf(quotedPageEntry)
    : content.indexOf(plainPageEntry);

  if (pageStart === -1) {
    return {
      name: 'accessibility',
      ok: false,
      details: `Missing "${slug}" component page registration.`,
    };
  }

  const nextEntryMatch = content
    .slice(pageStart + 1)
    .match(/\n\s{2}(?:'[^']+'|[a-zA-Z0-9-]+):\s*{/);

  const pageBlock =
    nextEntryMatch?.index !== undefined
      ? content.slice(pageStart, pageStart + 1 + nextEntryMatch.index)
      : content.slice(pageStart);

  if (!pageBlock.includes('Accessibility:')) {
    return {
      name: 'accessibility',
      ok: false,
      details: `Missing accessibility documentation for "${slug}".`,
    };
  }

  return {
    name: 'accessibility',
    ok: true,
  };
}

function checkTokenRequirements(params: {
  root: string;
  requiredTokens: readonly string[];
}): ComponentCheckResult {
  const { root, requiredTokens } = params;

  if (requiredTokens.length === 0) {
    return {
      name: 'tokens',
      ok: true,
    };
  }

  const tokenPaths = canonicalTokenPaths(root);

  if (!tokenPaths) {
    return {
      name: 'tokens',
      ok: false,
      details: `Missing generated token registry: ${canonicalTokenRegistryPath(root)}`,
    };
  }

  const missingTokens = requiredTokens.filter(
    (token) => !tokenPaths.has(token)
  );

  if (missingTokens.length > 0) {
    return {
      name: 'tokens',
      ok: false,
      details: `Missing required tokens: ${missingTokens.join(', ')}`,
    };
  }

  return {
    name: 'tokens',
    ok: true,
  };
}
