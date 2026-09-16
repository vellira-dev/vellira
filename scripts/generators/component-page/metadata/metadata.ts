import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

import type { ComponentPageMetadata } from '../../../../apps/website/src/component-catalog/metadata';
import {
  CANONICAL_RELATED_COMPONENT_CONSTRAINTS,
  canonicalComponentSlugs,
} from '../../../../apps/website/src/component-catalog/registry/componentIdentity';
import type { ExtractedProp, Platform } from '../model/types';
import { slugify } from '../helpers/format';

export type { ComponentPageMetadata };

export type ComponentPageProfile = NonNullable<
  ComponentPageMetadata['profile']
>;

export function loadGeneratedComponentProfile(params: {
  root: string;
  componentName: string;
}): ComponentPageProfile | undefined {
  const metadataFile = path.join(
    params.root,
    'packages',
    'metadata',
    'src',
    'components',
    `${params.componentName}.metadata.ts`
  );

  if (!fs.existsSync(metadataFile)) {
    return undefined;
  }

  const source = fs.readFileSync(metadataFile, 'utf8');
  const match = source.match(
    /\bprofile:\s*['"](base|form-control|compound|overlay)['"]/
  );

  const profile = match?.[1];

  if (!profile) {
    return undefined;
  }

  return profile === 'base' ? 'primitive' : (profile as ComponentPageProfile);
}

export type GeneratedComponentCategory =
  | 'action'
  | 'form'
  | 'navigation'
  | 'overlay'
  | 'feedback'
  | 'data-display'
  | 'layout'
  | 'utility';

export function loadGeneratedComponentCategory(params: {
  root: string;
  componentName: string;
}): GeneratedComponentCategory | undefined {
  const metadataFile = path.join(
    params.root,
    'packages',
    'metadata',
    'src',
    'components',
    `${params.componentName}.metadata.ts`
  );

  if (!fs.existsSync(metadataFile)) {
    return undefined;
  }

  const source = fs.readFileSync(metadataFile, 'utf8');
  const match = source.match(
    /\bcategory:\s*['"](action|form|navigation|overlay|feedback|data-display|layout|utility)['"]/
  );

  return match?.[1] as GeneratedComponentCategory | undefined;
}

export function getComponentCatalogDir(params: {
  catalogComponentsRoot: string;
  componentName: string;
}) {
  return path.join(params.catalogComponentsRoot, params.componentName);
}

export function getComponentMetadataFile(params: {
  catalogComponentsRoot: string;
  componentName: string;
}) {
  return path.join(getComponentCatalogDir(params), 'metadata.ts');
}

export async function loadComponentMetadata(params: {
  catalogComponentsRoot: string;
  componentName: string;
}): Promise<ComponentPageMetadata> {
  const metadataFile = getComponentMetadataFile(params);

  if (!fs.existsSync(metadataFile)) {
    return {};
  }

  const metadataModule = (await import(pathToFileURL(metadataFile).href)) as {
    default?: ComponentPageMetadata;
    metadata?: ComponentPageMetadata;
  };

  return metadataModule.default ?? metadataModule.metadata ?? {};
}

function mergeObject<T extends Record<string, unknown>>(
  base: T | undefined,
  override: T | undefined
) {
  return {
    ...(base ?? {}),
    ...(override ?? {}),
  } as T;
}

function mergePlatformMetadata(
  base: ComponentPageMetadata['react'],
  override: ComponentPageMetadata['react']
) {
  const imports = Array.from(
    new Set([...(base?.imports ?? []), ...(override?.imports ?? [])])
  );
  const setup = Array.from(
    new Set([...(base?.setup ?? []), ...(override?.setup ?? [])])
  );

  return {
    ...(base ?? {}),
    ...(override ?? {}),
    ...(imports.length > 0 ? { imports } : {}),
    ...(setup.length > 0 ? { setup } : {}),
  };
}

export function mergeComponentMetadata(
  base: ComponentPageMetadata,
  override: ComponentPageMetadata
): ComponentPageMetadata {
  return {
    ...base,
    ...override,
    react: mergePlatformMetadata(base.react, override.react),
    native: mergePlatformMetadata(base.native, override.native),
    demo: {
      ...(base.demo ?? {}),
      ...(override.demo ?? {}),
      initialValues: mergeObject(
        base.demo?.initialValues,
        override.demo?.initialValues
      ),
      staticProps: mergeObject(
        base.demo?.staticProps,
        override.demo?.staticProps
      ),
    },
    defaults: {
      ...(base.defaults ?? {}),
      ...(override.defaults ?? {}),
      shared: mergeObject(base.defaults?.shared, override.defaults?.shared),
      react: mergeObject(base.defaults?.react, override.defaults?.react),
      native: mergeObject(base.defaults?.native, override.defaults?.native),
    },
    api: {
      ...(base.api ?? {}),
      ...(override.api ?? {}),
      descriptions: mergeObject(
        base.api?.descriptions,
        override.api?.descriptions
      ),
      sections: override.api?.sections ?? base.api?.sections,
    },
    examples: override.examples ?? base.examples,
    accessibility: {
      ...(base.accessibility ?? {}),
      ...(override.accessibility ?? {}),
      react: override.accessibility?.react ?? base.accessibility?.react,
      native: override.accessibility?.native ?? base.accessibility?.native,
    },
    related: override.related ?? base.related,
  };
}

function importLocallyBindsName(source: string, localName: string) {
  const sourceFile = ts.createSourceFile(
    'component-page-metadata-import.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  return sourceFile.statements.some((statement) => {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) {
      return false;
    }

    const { importClause } = statement;

    if (importClause.name?.text === localName) {
      return true;
    }

    const { namedBindings } = importClause;

    if (!namedBindings) {
      return false;
    }

    if (ts.isNamespaceImport(namedBindings)) {
      return namedBindings.name.text === localName;
    }

    return namedBindings.elements.some(
      (element) => element.name.text === localName
    );
  });
}

function getParseError(sourceFile: ts.SourceFile) {
  const diagnostics =
    (sourceFile as ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] })
      .parseDiagnostics ?? [];
  const diagnostic = diagnostics.find(
    (item) => item.category === ts.DiagnosticCategory.Error
  );

  return diagnostic
    ? ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    : null;
}

function validateImportDeclaration(source: string) {
  if (!source.trim()) {
    return 'must not be empty';
  }

  const sourceFile = ts.createSourceFile(
    'component-page-metadata-import.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const parseError = getParseError(sourceFile);

  if (parseError) {
    return parseError;
  }

  if (
    sourceFile.statements.length === 0 ||
    sourceFile.statements.some(
      (statement) => !ts.isImportDeclaration(statement)
    )
  ) {
    return 'must contain only import declarations';
  }

  return null;
}

function getJsxAttributeNames(source: string) {
  const sourceFile = ts.createSourceFile(
    'component-page-metadata-props.tsx',
    `<Component ${source} />`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const parseError = getParseError(sourceFile);

  if (parseError) {
    return { error: parseError, names: [] as string[] };
  }

  const statement = sourceFile.statements[0];
  const expression = ts.isExpressionStatement(statement)
    ? statement.expression
    : null;

  if (!expression || !ts.isJsxSelfClosingElement(expression)) {
    return {
      error: 'must be valid JSX prop fragments',
      names: [] as string[],
    };
  }

  const names: string[] = [];

  for (const property of expression.attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) {
      return {
        error: 'must not use JSX spread attributes',
        names,
      };
    }

    if (!ts.isIdentifier(property.name)) {
      return {
        error: 'must use identifier prop names',
        names,
      };
    }

    names.push(property.name.text);
  }

  return { error: null, names };
}

function normalizePropFragments(props: readonly string[]) {
  return props.flatMap((prop) =>
    prop
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

function validatePropFragments(params: {
  field: string;
  fragments: readonly string[];
  allowEmpty?: boolean;
}) {
  const errors: string[] = [];
  const fragments = normalizePropFragments(params.fragments);

  if (!params.allowEmpty) {
    params.fragments.forEach((fragment, index) => {
      if (!fragment.trim()) {
        errors.push(`${params.field}[${index}] must not be empty`);
      }
    });
  }

  if (fragments.length === 0) {
    return errors;
  }

  const { error, names } = getJsxAttributeNames(fragments.join('\n'));

  if (error) {
    errors.push(`${params.field} has invalid JSX prop syntax: ${error}`);
    return errors;
  }

  const seenNames = new Set<string>();

  for (const name of names) {
    if (seenNames.has(name)) {
      errors.push(`${params.field} contains duplicate prop "${name}"`);
    }

    seenNames.add(name);
  }

  return errors;
}

function validateExpression(params: { field: string; source: string }) {
  if (!params.source.trim()) {
    return `${params.field} must not be empty`;
  }

  const { error } = getJsxAttributeNames(`value={${params.source}}`);

  return error
    ? `${params.field} has invalid TypeScript/JSX expression syntax: ${error}`
    : null;
}

function containsGeneratedComponentRoot(source: string, componentName: string) {
  const marker = `<${componentName}`;
  let index = source.indexOf(marker);

  while (index !== -1) {
    const nextCharacter = source[index + marker.length];

    if (
      nextCharacter === '>' ||
      nextCharacter === '/' ||
      (nextCharacter !== undefined && nextCharacter.trim() === '')
    ) {
      return true;
    }

    index = source.indexOf(marker, index + marker.length);
  }

  return false;
}

function validateJsxChildren(params: {
  componentName: string;
  field: string;
  source: string;
}) {
  const sourceFile = ts.createSourceFile(
    'component-page-metadata-children.tsx',
    `<Component>${params.source}</Component>`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const parseError = getParseError(sourceFile);

  if (parseError) {
    return `${params.field} has invalid JSX child syntax: ${parseError}`;
  }

  if (containsGeneratedComponentRoot(params.source, params.componentName)) {
    return `${params.field} must contain inner child markup, not a second <${params.componentName}> root`;
  }

  return null;
}

function isBarePropFragment(fragment: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(fragment);
}

function validateSetupSyntax(source: string) {
  const result = ts.transpileModule(
    `function ComponentExamplePreview() {\n${source}\n}`,
    {
      compilerOptions: {
        jsx: ts.JsxEmit.Preserve,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: 'component-page-example-setup.tsx',
      reportDiagnostics: true,
    }
  );

  const diagnostic = result.diagnostics?.find(
    (item) => item.category === ts.DiagnosticCategory.Error
  );

  return diagnostic
    ? ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    : null;
}

const canonicalSlugSemantics =
  'expected an exact canonical public component slug from apps/website/src/component-catalog/registry/componentPresentation.ts, using lowercase kebab-case where applicable';

export function validateRelatedComponentSlugs(params: {
  componentName: string;
  related: readonly string[] | undefined;
}) {
  const errors: string[] = [];
  const related = params.related ?? [];
  const sourceSlug = slugify(params.componentName);
  const seen = new Set<string>();
  const canonicalComponentSlugSet = new Set(canonicalComponentSlugs);

  for (const [index, relatedSlug] of related.entries()) {
    const field = `related[${index}]`;
    const prefix = `${params.componentName} ${field} "${relatedSlug}"`;

    if (
      CANONICAL_RELATED_COMPONENT_CONSTRAINTS.relatedMustNotReferenceSelf &&
      relatedSlug === sourceSlug
    ) {
      errors.push(
        `${prefix} is invalid: related components must not reference the source component "${sourceSlug}"`
      );
    }

    if (
      CANONICAL_RELATED_COMPONENT_CONSTRAINTS.relatedMustBeUnique &&
      seen.has(relatedSlug)
    ) {
      errors.push(
        `${prefix} is invalid: duplicate related component slug "${relatedSlug}"`
      );
    }

    seen.add(relatedSlug);

    if (
      CANONICAL_RELATED_COMPONENT_CONSTRAINTS.relatedMustUseCanonicalSlug &&
      !canonicalComponentSlugSet.has(relatedSlug)
    ) {
      errors.push(
        `${prefix} is invalid: unknown or non-canonical related component slug; ${canonicalSlugSemantics}`
      );
    }
  }

  return errors;
}

export function validateComponentMetadata(params: {
  componentName: string;
  metadata: ComponentPageMetadata;
}) {
  const { componentName, metadata } = params;
  const errors: string[] = [];
  const exampleTitles = new Set<string>();
  const apiSections = new Set<string>();

  errors.push(
    ...validateRelatedComponentSlugs({
      componentName,
      related: metadata.related,
    })
  );

  if (
    Object.prototype.hasOwnProperty.call(
      metadata.demo?.staticProps ?? {},
      'children'
    )
  ) {
    errors.push(
      'demo.staticProps.children is not supported; use react.children/native.children for inner JSX'
    );
  }

  for (const [platform, platformMetadata] of [
    ['react', metadata.react],
    ['react-native', metadata.native],
  ] as const) {
    for (const [index, source] of (platformMetadata?.imports ?? []).entries()) {
      const importError = validateImportDeclaration(source);

      if (importError) {
        errors.push(`${platform}.imports[${index}] ${importError}`);
      }

      if (importLocallyBindsName(source, componentName)) {
        errors.push(
          `${platform}.imports[${index}] must not bind generated component "${componentName}"`
        );
      }
    }

    for (const [index, source] of (platformMetadata?.setup ?? []).entries()) {
      if (!source.trim()) {
        errors.push(`${platform}.setup[${index}] must not be empty`);
      }
    }

    const platformSetup = (platformMetadata?.setup ?? [])
      .map((statement) => statement.trim())
      .filter(Boolean);

    if (platformSetup.length > 0) {
      const setupError = validateSetupSyntax(platformSetup.join('\n'));

      if (setupError) {
        errors.push(
          `${platform}.setup has invalid TypeScript syntax: ${setupError}`
        );
      }
    }

    errors.push(
      ...validatePropFragments({
        field: `${platform}.demoProps`,
        fragments: platformMetadata?.demoProps
          ? [platformMetadata.demoProps]
          : [],
        allowEmpty: true,
      })
    );

    if (platformMetadata?.children !== undefined) {
      const childrenError = validateJsxChildren({
        componentName,
        field: `${platform}.children`,
        source: platformMetadata.children,
      });

      if (childrenError) {
        errors.push(childrenError);
      }
    }

    for (const [bindingIndex, binding] of (
      platformMetadata?.childPropBindings ?? []
    ).entries()) {
      if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(binding.target)) {
        errors.push(
          `${platform}.childPropBindings[${bindingIndex}].target must be a JSX component name`
        );
      }

      errors.push(
        ...validatePropFragments({
          field: `${platform}.childPropBindings[${bindingIndex}].props`,
          fragments: binding.props,
        })
      );
    }
  }

  for (const [name, value] of Object.entries(
    metadata.demo?.staticProps ?? {}
  )) {
    const expressionError = validateExpression({
      field: `demo.staticProps.${name}`,
      source: value,
    });

    if (expressionError) {
      errors.push(expressionError);
    }
  }

  for (const [index, example] of (metadata.examples ?? []).entries()) {
    if (exampleTitles.has(example.title)) {
      errors.push(`duplicate example title "${example.title}"`);
    }

    exampleTitles.add(example.title);

    for (const platform of example.platforms ?? []) {
      if (platform !== 'react' && platform !== 'react-native') {
        errors.push(
          `examples[${index}] has unsupported platform "${platform}"`
        );
      }
    }

    const platforms = new Set(example.platforms ?? ['react', 'react-native']);

    if (!platforms.has('react')) {
      for (const field of [
        'reactImports',
        'reactSetup',
        'reactProps',
        'reactChildren',
      ] as const) {
        if (example[field] !== undefined) {
          errors.push(
            `examples[${index}].${field} is set but the example does not target react`
          );
        }
      }
    }

    if (!platforms.has('react-native')) {
      for (const field of [
        'nativeImports',
        'nativeSetup',
        'nativeProps',
        'nativeChildren',
      ] as const) {
        if (example[field] !== undefined) {
          errors.push(
            `examples[${index}].${field} is set but the example does not target react-native`
          );
        }
      }
    }

    for (const [field, imports] of [
      ['imports', example.imports],
      ['reactImports', example.reactImports],
      ['nativeImports', example.nativeImports],
    ] as const) {
      for (const [importIndex, source] of (imports ?? []).entries()) {
        const importError = validateImportDeclaration(source);

        if (importError) {
          errors.push(
            `examples[${index}].${field}[${importIndex}] ${importError}`
          );
        }
      }
    }

    errors.push(
      ...validatePropFragments({
        field: `examples[${index}].props`,
        fragments: example.props,
      }),
      ...validatePropFragments({
        field: `examples[${index}].reactProps`,
        fragments: example.reactProps ?? [],
      }),
      ...validatePropFragments({
        field: `examples[${index}].nativeProps`,
        fragments: example.nativeProps ?? [],
      })
    );

    const sharedPropNames = getJsxAttributeNames(
      normalizePropFragments(example.props).join('\n')
    ).names;

    for (const [field, platformProps] of [
      ['reactProps', example.reactProps],
      ['nativeProps', example.nativeProps],
    ] as const) {
      const platformPropNames = getJsxAttributeNames(
        normalizePropFragments(platformProps ?? []).join('\n')
      ).names;

      for (const name of platformPropNames) {
        if (sharedPropNames.includes(name)) {
          errors.push(
            `examples[${index}].${field}.${name} conflicts with examples[${index}].props.${name}; use one owner for the generated root prop`
          );
        }
      }
    }

    for (const [field, children] of [
      ['reactChildren', example.reactChildren],
      ['nativeChildren', example.nativeChildren],
    ] as const) {
      if (children === undefined) {
        continue;
      }

      const childrenError = validateJsxChildren({
        componentName,
        field: `examples[${index}].${field}`,
        source: children,
      });

      if (childrenError) {
        errors.push(childrenError);
      }
    }

    for (const [platform, platformSetup] of [
      ['react', example.reactSetup],
      ['react-native', example.nativeSetup],
    ] as const) {
      const setup = [...(example.setup ?? []), ...(platformSetup ?? [])]
        .map((statement) => statement.trim())
        .filter(Boolean);

      if (setup.length === 0) {
        continue;
      }

      const setupError = validateSetupSyntax(setup.join('\n'));

      if (setupError) {
        errors.push(
          `examples[${index}] ${platform} setup has invalid TypeScript syntax: ${setupError}`
        );
      }
    }
  }

  for (const section of metadata.api?.sections ?? []) {
    if (apiSections.has(section.name)) {
      errors.push(`duplicate API section "${section.name}"`);
    }

    apiSections.add(section.name);
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid component page metadata for ${componentName}:\n${errors
        .map((error) => `  - ${error}`)
        .join('\n')}`
    );
  }
}

export function validateComponentMetadataAgainstApi(params: {
  componentName: string;
  metadata: ComponentPageMetadata;
  platforms: readonly Platform[];
  reactApiProps: readonly ExtractedProp[];
  nativeApiProps: readonly ExtractedProp[];
}) {
  const { componentName, metadata, platforms } = params;
  const errors: string[] = [];

  function getApiProps(platform: Platform) {
    return platform === 'react' ? params.reactApiProps : params.nativeApiProps;
  }

  function getApiProp(platform: Platform, propName: string) {
    return getApiProps(platform).find((prop) => prop.name === propName);
  }

  function hasAnyApiProp(propName: string) {
    return platforms.some((platform) =>
      Boolean(getApiProp(platform, propName))
    );
  }

  function validateAnyPlatformPropNames(params: {
    field: string;
    names: readonly string[];
  }) {
    for (const name of params.names) {
      if (!hasAnyApiProp(name)) {
        errors.push(`${params.field}.${name} is not present in any target API`);
      }
    }
  }

  function validatePlatformPropNames(params: {
    platform: Platform;
    field: string;
    names: readonly string[];
  }) {
    if (!platforms.includes(params.platform)) {
      return;
    }

    for (const name of params.names) {
      if (!getApiProp(params.platform, name)) {
        errors.push(
          `${params.field}.${name} is not present in the ${params.platform} API`
        );
      }
    }
  }

  function validatePropNames(params: {
    platform: Platform;
    field: string;
    fragments: readonly string[];
  }) {
    const fragments = normalizePropFragments(params.fragments);

    if (fragments.length === 0) {
      return;
    }

    const { names } = getJsxAttributeNames(fragments.join('\n'));

    for (const name of names) {
      const apiProp = getApiProp(params.platform, name);

      if (!apiProp) {
        const fragment = fragments.find((item) => item.startsWith(name));
        const qualifier =
          fragment && isBarePropFragment(fragment)
            ? ' bare prop fragment'
            : ' prop fragment';

        errors.push(
          `${params.field}${qualifier} "${name}" is not present in the ${params.platform} API`
        );
        continue;
      }

      if (
        fragments.some((fragment) => fragment === name) &&
        apiProp.kind !== 'boolean'
      ) {
        errors.push(
          `${params.field} bare prop fragment "${name}" uses bare JSX syntax for non-boolean prop "${name}"`
        );
      }
    }
  }

  validateAnyPlatformPropNames({
    field: 'demo.initialValues',
    names: Object.keys(metadata.demo?.initialValues ?? {}),
  });
  validateAnyPlatformPropNames({
    field: 'demo.excludeControls',
    names: [...(metadata.demo?.excludeControls ?? [])],
  });
  validateAnyPlatformPropNames({
    field: 'demo.satisfiedRequiredProps',
    names: [...(metadata.demo?.satisfiedRequiredProps ?? [])],
  });
  validateAnyPlatformPropNames({
    field: 'defaults.shared',
    names: Object.keys(metadata.defaults?.shared ?? {}),
  });
  validatePlatformPropNames({
    platform: 'react',
    field: 'defaults.react',
    names: Object.keys(metadata.defaults?.react ?? {}),
  });
  validatePlatformPropNames({
    platform: 'react-native',
    field: 'defaults.native',
    names: Object.keys(metadata.defaults?.native ?? {}),
  });

  for (const platform of platforms) {
    const platformMetadata =
      platform === 'react' ? metadata.react : metadata.native;

    validatePropNames({
      platform,
      field: `${platform}.demoProps`,
      fragments: platformMetadata?.demoProps
        ? [platformMetadata.demoProps]
        : [],
    });

    for (const name of Object.keys(metadata.demo?.staticProps ?? {})) {
      if (!getApiProp(platform, name)) {
        errors.push(
          `demo.staticProps.${name} is not present in the ${platform} API`
        );
      }
    }

    for (const [bindingIndex, binding] of (
      platformMetadata?.childPropBindings ?? []
    ).entries()) {
      validatePropNames({
        platform,
        field: `${platform}.childPropBindings[${bindingIndex}].props`,
        fragments: binding.props,
      });
    }
  }

  for (const [index, example] of (metadata.examples ?? []).entries()) {
    const targetPlatforms = example.platforms ?? platforms;

    for (const platform of targetPlatforms) {
      if (!platforms.includes(platform)) {
        errors.push(
          `examples[${index}] targets ${platform}, but ${componentName} is not available on that platform`
        );
        continue;
      }

      validatePropNames({
        platform,
        field: `examples[${index}].props`,
        fragments: example.props,
      });

      validatePropNames({
        platform,
        field:
          platform === 'react'
            ? `examples[${index}].reactProps`
            : `examples[${index}].nativeProps`,
        fragments:
          platform === 'react'
            ? (example.reactProps ?? [])
            : (example.nativeProps ?? []),
      });
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid component page metadata for ${componentName}:\n${errors
        .map((error) => `  - ${error}`)
        .join('\n')}`
    );
  }
}
