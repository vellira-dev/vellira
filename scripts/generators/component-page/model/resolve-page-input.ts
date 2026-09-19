import {
  createPackageProgram,
  existsInPackage,
  extractComponentProps,
  extractPlatformDiscriminatedUnion,
  extractPlatformPartProps,
  extractPlatformProps,
  listComponentParts,
} from '../extractors/source';
import { capitalize } from '../helpers/format';
import type { ComponentPageMetadata } from '../metadata/metadata';
import {
  loadComponentMetadata,
  loadGeneratedComponentCategory,
  loadGeneratedComponentProfile,
  mergeComponentMetadata,
  validateComponentMetadataAgainstApi,
  validateComponentMetadata,
} from '../metadata/metadata';
import type { ExtractedProp, Platform } from './types';
import {
  getGeneratedCompositionMetadata,
  getProfileMetadata,
  inferComponentProfile,
  resolveCatalogCategory,
  type ComponentProfile,
  type GeneratorComponentCategory,
} from '../profiles/profiles';
import type { ExtractedDiscriminatedUnion, ExtractedPropBranch } from './types';
import ts from 'typescript';

export function resolveComponentPageProfile(params: {
  componentName: string;
  metadataProfile?: ComponentProfile;
  requestedProfile?: ComponentProfile;
  generatedProfile?: ComponentProfile;
}): ComponentProfile {
  const legacyProfile = inferComponentProfile(params.componentName);

  return (
    params.metadataProfile ??
    (legacyProfile !== 'primitive'
      ? legacyProfile
      : (params.requestedProfile ?? params.generatedProfile ?? legacyProfile))
  );
}

export function resolveExtractedProps(params: {
  sharedProps: readonly ExtractedProp[];
  reactApiProps: readonly ExtractedProp[];
  nativeApiProps: readonly ExtractedProp[];
}) {
  if (params.sharedProps.length > 0) {
    return [...params.sharedProps];
  }

  const propsByName = new Map<string, ExtractedProp>();

  for (const prop of [...params.reactApiProps, ...params.nativeApiProps]) {
    if (!propsByName.has(prop.name)) {
      propsByName.set(prop.name, prop);
    }
  }

  return [...propsByName.values()];
}

function renderStaticStringProp(name: string, value: string) {
  return `${name}={${JSON.stringify(value)}}`;
}

type ResolvedDiscriminatorValue =
  | {
      status: 'absent';
    }
  | {
      status: 'resolved';
      value: string;
      source: string;
    }
  | {
      status: 'unresolved';
      source: string;
    };

function hasPropBinding(source: string, propName: string) {
  return new RegExp(`(^|\\s)${propName}\\s*=`).test(source);
}

function mergeStaticDemoProps(base: string, generated: string) {
  if (!generated) {
    return base;
  }

  const propName = generated.split('=')[0];

  if (hasPropBinding(base, propName)) {
    return base;
  }

  return [base, generated].filter(Boolean).join('\n');
}

function hasParseDiagnostics(sourceFile: ts.SourceFile) {
  return (
    ((sourceFile as ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] })
      .parseDiagnostics?.length ?? 0) > 0
  );
}

function getStringLiteralExpressionValue(source: string) {
  const sourceFile = ts.createSourceFile(
    'static-prop.ts',
    `const value = ${source};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  if (hasParseDiagnostics(sourceFile)) {
    return null;
  }

  const statement = sourceFile.statements[0];

  if (!ts.isVariableStatement(statement)) {
    return null;
  }

  const declaration = statement.declarationList.declarations[0];
  const initializer = declaration?.initializer;

  if (!initializer) {
    return null;
  }

  if (
    ts.isStringLiteral(initializer) ||
    ts.isNoSubstitutionTemplateLiteral(initializer)
  ) {
    return initializer.text;
  }

  return null;
}

function readStaticPropsDiscriminatorValue(params: {
  componentName: string;
  discriminator: string;
  staticProps: Record<string, string> | undefined;
  warnOnUnresolved?: boolean;
}): ResolvedDiscriminatorValue {
  const value = params.staticProps?.[params.discriminator];

  if (value === undefined) {
    return { status: 'absent' };
  }

  const resolvedValue = getStringLiteralExpressionValue(value);
  const source = `demo.staticProps.${params.discriminator}`;

  if (resolvedValue === null) {
    if (params.warnOnUnresolved ?? true) {
      console.warn(
        `⚠️ ${params.componentName} playground could not safely resolve ${source}.`
      );
    }

    return { status: 'unresolved', source };
  }

  return { status: 'resolved', value: resolvedValue, source };
}

function readDemoPropsDiscriminatorValue(params: {
  componentName: string;
  platform: Platform;
  discriminator: string;
  demoProps: string | undefined;
}): ResolvedDiscriminatorValue {
  const demoProps = params.demoProps?.trim();

  if (!demoProps || !hasPropBinding(demoProps, params.discriminator)) {
    return { status: 'absent' };
  }

  const sourceFile = ts.createSourceFile(
    'demo-props.tsx',
    `<Component ${demoProps} />`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  if (hasParseDiagnostics(sourceFile)) {
    const source = `${params.platform}.demoProps.${params.discriminator}`;

    console.warn(
      `⚠️ ${params.componentName} ${params.platform} playground could not safely resolve ${source}.`
    );

    return { status: 'unresolved', source };
  }

  const statement = sourceFile.statements[0];
  const expression = ts.isExpressionStatement(statement)
    ? statement.expression
    : null;
  const openingElement =
    expression && ts.isJsxSelfClosingElement(expression) ? expression : null;
  const attribute = openingElement?.attributes.properties.find(
    (property) =>
      ts.isJsxAttribute(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === params.discriminator
  );
  const source = `${params.platform}.demoProps.${params.discriminator}`;

  if (!attribute || !ts.isJsxAttribute(attribute) || !attribute.initializer) {
    console.warn(
      `⚠️ ${params.componentName} ${params.platform} playground could not safely resolve ${source}.`
    );

    return { status: 'unresolved', source };
  }

  if (ts.isStringLiteral(attribute.initializer)) {
    return {
      status: 'resolved',
      value: attribute.initializer.text,
      source,
    };
  }

  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression &&
    (ts.isStringLiteral(attribute.initializer.expression) ||
      ts.isNoSubstitutionTemplateLiteral(attribute.initializer.expression))
  ) {
    return {
      status: 'resolved',
      value: attribute.initializer.expression.text,
      source,
    };
  }

  console.warn(
    `⚠️ ${params.componentName} ${params.platform} playground could not safely resolve ${source}.`
  );

  return { status: 'unresolved', source };
}

function getExplicitDiscriminatorValue(params: {
  componentName: string;
  platform: Platform;
  union: ExtractedDiscriminatedUnion;
  componentConfig: ComponentPageMetadata;
}): ResolvedDiscriminatorValue {
  const branchValues = new Set(
    params.union.branches.map((branch) => branch.discriminatorValue)
  );
  const readPlatformDemoProps = () =>
    readDemoPropsDiscriminatorValue({
      componentName: params.componentName,
      platform: params.platform,
      discriminator: params.union.discriminator,
      demoProps:
        params.platform === 'react'
          ? params.componentConfig.react?.demoProps
          : params.componentConfig.native?.demoProps,
    });
  const readStaticProps = (warnOnUnresolved = true) =>
    readStaticPropsDiscriminatorValue({
      componentName: params.componentName,
      discriminator: params.union.discriminator,
      staticProps: params.componentConfig.demo?.staticProps,
      warnOnUnresolved,
    });
  const readInitialValue = (): ResolvedDiscriminatorValue => {
    const initialValue =
      params.componentConfig.demo?.initialValues?.[params.union.discriminator];

    return initialValue === undefined
      ? { status: 'absent' }
      : {
          status: 'resolved',
          value: String(initialValue),
          source: `demo.initialValues.${params.union.discriminator}`,
        };
  };

  const resolveSelectedCandidate = (
    selectedCandidate: ResolvedDiscriminatorValue,
    lowerPrecedenceReaders: Array<() => ResolvedDiscriminatorValue>
  ) => {
    if (selectedCandidate.status !== 'resolved') {
      return selectedCandidate;
    }

    if (!branchValues.has(selectedCandidate.value)) {
      return selectedCandidate;
    }

    for (const readCandidate of lowerPrecedenceReaders) {
      const candidate = readCandidate();

      if (
        candidate.status !== 'resolved' ||
        !branchValues.has(candidate.value)
      ) {
        continue;
      }

      if (candidate.value !== selectedCandidate.value) {
        console.warn(
          `⚠️ ${params.componentName} ${params.platform} playground ignored ${candidate.source}=${JSON.stringify(
            candidate.value
          )} because ${selectedCandidate.source}=${JSON.stringify(
            selectedCandidate.value
          )} has higher precedence.`
        );
      }
    }

    return selectedCandidate;
  };

  const platformDemoPropsCandidate = readPlatformDemoProps();

  if (platformDemoPropsCandidate.status !== 'absent') {
    return resolveSelectedCandidate(platformDemoPropsCandidate, [
      () => readStaticProps(false),
      readInitialValue,
    ]);
  }

  const staticPropsCandidate = readStaticProps();

  if (staticPropsCandidate.status !== 'absent') {
    return resolveSelectedCandidate(staticPropsCandidate, [readInitialValue]);
  }

  const initialValueCandidate = readInitialValue();

  if (initialValueCandidate.status !== 'absent') {
    return resolveSelectedCandidate(initialValueCandidate, []);
  }

  return { status: 'absent' };
}

function selectDiscriminatedUnionBranch(params: {
  componentName: string;
  platform: Platform;
  union: ExtractedDiscriminatedUnion;
  explicitValue: ResolvedDiscriminatorValue;
}) {
  const { componentName, explicitValue, platform, union } = params;

  if (explicitValue.status === 'unresolved') {
    return null;
  }

  if (explicitValue.status === 'resolved') {
    const { value } = explicitValue;
    const configuredBranch = union.branches.find(
      (branch) => branch.discriminatorValue === value
    );

    if (!configuredBranch) {
      console.warn(
        `⚠️ ${componentName} ${platform} playground ${explicitValue.source} requested ${union.discriminator}=${JSON.stringify(
          value
        )}, but no matching discriminated-union branch exists.`
      );

      return null;
    }

    return configuredBranch;
  }

  return (
    union.branches.find((branch) => !branch.discriminatorRequired) ??
    union.branches[0] ??
    null
  );
}

function getSelectedBranchStaticProps(params: {
  discriminator: string;
  branch: ExtractedPropBranch | null;
}) {
  const { branch, discriminator } = params;

  if (!discriminator || !branch?.discriminatorRequired) {
    return '';
  }

  return renderStaticStringProp(discriminator, branch.discriminatorValue);
}

function getPlaygroundApiPropsForBranch(params: {
  union: ExtractedDiscriminatedUnion | null;
  branch: ExtractedPropBranch | null;
  props: readonly ExtractedProp[];
}) {
  if (!params.union) {
    return params.props;
  }

  return params.branch?.props ?? [];
}

function haveCompatiblePlaygroundTypes(
  left: ExtractedProp,
  right: ExtractedProp
) {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind !== 'select' || right.kind !== 'select') {
    return true;
  }

  return (
    left.options.length === right.options.length &&
    left.options.every((option, index) => option === right.options[index])
  );
}

function getIncompatibleCrossPlatformPropNames(params: {
  componentName: string;
  reactProps: readonly ExtractedProp[];
  nativeProps: readonly ExtractedProp[];
}) {
  const nativePropsByName = new Map(
    params.nativeProps.map((prop) => [prop.name, prop])
  );
  const incompatibleNames: string[] = [];

  for (const reactProp of params.reactProps) {
    const nativeProp = nativePropsByName.get(reactProp.name);

    if (nativeProp && !haveCompatiblePlaygroundTypes(reactProp, nativeProp)) {
      incompatibleNames.push(reactProp.name);
    }
  }

  if (incompatibleNames.length > 0) {
    console.warn(
      `⚠️ ${params.componentName} playground omitted cross-platform props with incompatible selected-branch types: ${incompatibleNames.join(
        ', '
      )}`
    );
  }

  return new Set(incompatibleNames);
}

export async function resolvePageInput(params: {
  root: string;
  catalogComponentsRoot: string;
  componentName: string;
  requestedProfile?: ComponentProfile;
  requestedCategory?: GeneratorComponentCategory;
  requireRelatedDecision?: boolean;
}) {
  const { root, catalogComponentsRoot, componentName } = params;

  const componentMetadata = await loadComponentMetadata({
    catalogComponentsRoot,
    componentName,
  });

  const platforms: Platform[] = [];

  if (existsInPackage({ root, packageName: 'react', componentName })) {
    platforms.push('react');
  }

  if (existsInPackage({ root, packageName: 'react-native', componentName })) {
    platforms.push('react-native');
  }

  const reactApiProps = platforms.includes('react')
    ? extractPlatformProps({ root, componentName, platform: 'react' })
    : [];

  const nativeApiProps = platforms.includes('react-native')
    ? extractPlatformProps({ root, componentName, platform: 'react-native' })
    : [];

  const generatedComponentProfile = loadGeneratedComponentProfile({
    root,
    componentName,
  });

  const generatedComponentCategory = loadGeneratedComponentCategory({
    root,
    componentName,
  });

  const inferredComponentProfile = resolveComponentPageProfile({
    componentName,
    metadataProfile: componentMetadata.profile,
    requestedProfile: params.requestedProfile,
    generatedProfile: generatedComponentProfile,
  });

  const parts = Array.from(
    new Set(
      platforms.flatMap((platform) =>
        listComponentParts({
          root,
          platform,
          componentName,
        })
      )
    )
  ).sort((left, right) => left.localeCompare(right));

  const partProps =
    inferredComponentProfile === 'compound' && parts.length > 0
      ? (Object.fromEntries(
          platforms.map((platform) => {
            const program = createPackageProgram({ root, platform });

            return [
              platform,
              Object.fromEntries(
                parts.map((partName) => [
                  partName,
                  extractPlatformPartProps({
                    root,
                    componentName,
                    platform,
                    partName,
                    program,
                  }),
                ])
              ),
            ];
          })
        ) as Partial<
          Record<Platform, Record<string, readonly ExtractedProp[]>>
        >)
      : undefined;

  const generatedComposition = getGeneratedCompositionMetadata({
    profile: inferredComponentProfile,
    componentName,
    parts,
    partProps,
    platforms: platforms.filter((platform) =>
      platform === 'react'
        ? !componentMetadata.react?.children
        : !componentMetadata.native?.children
    ),
  });

  const componentConfig = mergeComponentMetadata(
    mergeComponentMetadata(
      getProfileMetadata(inferredComponentProfile, {
        reactApiProps,
        nativeApiProps,
      }),
      generatedComposition
    ),
    componentMetadata
  );

  validateComponentMetadata({
    componentName,
    metadata: componentConfig,
    requireRelatedDecision: params.requireRelatedDecision,
  });

  const componentProfile = componentConfig.profile ?? inferredComponentProfile;

  const catalogCategory = resolveCatalogCategory({
    profile: componentProfile,
    requestedCategory: params.requestedCategory,
    generatedCategory: generatedComponentCategory,
  });

  validateComponentMetadataAgainstApi({
    componentName,
    metadata: componentConfig,
    platforms,
    reactApiProps,
    nativeApiProps,
  });

  const reactProgram = platforms.includes('react')
    ? createPackageProgram({ root, platform: 'react' })
    : null;
  const nativeProgram = platforms.includes('react-native')
    ? createPackageProgram({ root, platform: 'react-native' })
    : null;

  const reactDiscriminatedUnion = reactProgram
    ? extractPlatformDiscriminatedUnion({
        root,
        componentName,
        platform: 'react',
        program: reactProgram,
      })
    : null;
  const nativeDiscriminatedUnion = nativeProgram
    ? extractPlatformDiscriminatedUnion({
        root,
        componentName,
        platform: 'react-native',
        program: nativeProgram,
      })
    : null;
  const reactSelectedBranch = reactDiscriminatedUnion
    ? selectDiscriminatedUnionBranch({
        componentName,
        platform: 'react',
        union: reactDiscriminatedUnion,
        explicitValue: getExplicitDiscriminatorValue({
          componentName,
          platform: 'react',
          union: reactDiscriminatedUnion,
          componentConfig,
        }),
      })
    : null;
  const nativeSelectedBranch = nativeDiscriminatedUnion
    ? selectDiscriminatedUnionBranch({
        componentName,
        platform: 'react-native',
        union: nativeDiscriminatedUnion,
        explicitValue: getExplicitDiscriminatorValue({
          componentName,
          platform: 'react-native',
          union: nativeDiscriminatedUnion,
          componentConfig,
        }),
      })
    : null;
  const reactPlaygroundApiProps = getPlaygroundApiPropsForBranch({
    union: reactDiscriminatedUnion,
    branch: reactSelectedBranch,
    props: reactApiProps,
  });
  const nativePlaygroundApiProps = getPlaygroundApiPropsForBranch({
    union: nativeDiscriminatedUnion,
    branch: nativeSelectedBranch,
    props: nativeApiProps,
  });

  function getGeneratedDiscriminatorProp(params: {
    platform: Platform;
    union: ExtractedDiscriminatedUnion | null;
    branch: ExtractedPropBranch | null;
  }) {
    const { branch, platform, union } = params;

    if (!union) {
      return '';
    }

    const platformDemoProps =
      platform === 'react'
        ? (componentConfig.react?.demoProps ?? '')
        : (componentConfig.native?.demoProps ?? '');

    if (
      hasPropBinding(platformDemoProps, union.discriminator) ||
      componentConfig.demo?.staticProps?.[union.discriminator] !== undefined
    ) {
      return '';
    }

    return getSelectedBranchStaticProps({
      discriminator: union.discriminator,
      branch,
    });
  }

  function getDemoProps(platform: Platform) {
    if (platform === 'react') {
      return mergeStaticDemoProps(
        componentConfig.react?.demoProps ?? '',
        hasDiscriminatedUnion
          ? getGeneratedDiscriminatorProp({
              platform: 'react',
              union: reactDiscriminatedUnion,
              branch: reactSelectedBranch,
            })
          : ''
      );
    }

    return mergeStaticDemoProps(
      componentConfig.native?.demoProps ?? '',
      hasDiscriminatedUnion
        ? getGeneratedDiscriminatorProp({
            platform: 'react-native',
            union: nativeDiscriminatedUnion,
            branch: nativeSelectedBranch,
          })
        : ''
    );
  }

  const sharedProps = extractComponentProps({ root, componentName });
  const extractedProps = resolveExtractedProps({
    sharedProps,
    reactApiProps,
    nativeApiProps,
  });

  const excludedControls = new Set(componentConfig.demo?.excludeControls ?? []);
  const excludedDiscriminators = new Set(
    [
      reactDiscriminatedUnion?.discriminator,
      nativeDiscriminatedUnion?.discriminator,
    ].filter((name): name is string => Boolean(name))
  );

  const hasDiscriminatedUnion =
    sharedProps.length === 0 &&
    Boolean(reactDiscriminatedUnion || nativeDiscriminatedUnion);
  const effectiveReactPlaygroundApiProps = hasDiscriminatedUnion
    ? reactPlaygroundApiProps
    : reactApiProps;
  const effectiveNativePlaygroundApiProps = hasDiscriminatedUnion
    ? nativePlaygroundApiProps
    : nativeApiProps;
  const incompatibleCrossPlatformPropNames = hasDiscriminatedUnion
    ? getIncompatibleCrossPlatformPropNames({
        componentName,
        reactProps: effectiveReactPlaygroundApiProps,
        nativeProps: effectiveNativePlaygroundApiProps,
      })
    : new Set<string>();
  const playgroundSourceProps = hasDiscriminatedUnion
    ? resolveExtractedProps({
        sharedProps: [],
        reactApiProps: effectiveReactPlaygroundApiProps,
        nativeApiProps: effectiveNativePlaygroundApiProps,
      })
    : extractedProps;

  const playgroundProps = playgroundSourceProps.filter(
    (prop) =>
      prop.kind !== 'other' &&
      !prop.name.startsWith('on') &&
      !prop.name.startsWith('default') &&
      !excludedControls.has(prop.name) &&
      !excludedDiscriminators.has(prop.name) &&
      !incompatibleCrossPlatformPropNames.has(prop.name)
  );

  const requiredComplexProps = extractedProps.filter(
    (prop) => prop.required && prop.kind === 'other'
  );

  const satisfiedRequiredProps = new Set(
    componentConfig.demo?.satisfiedRequiredProps ?? []
  );

  const missingRequiredComplexProps = requiredComplexProps.filter(
    (prop) =>
      !componentConfig.demo?.staticProps?.[prop.name] &&
      !satisfiedRequiredProps.has(prop.name)
  );

  if (missingRequiredComplexProps.length > 0) {
    console.warn(
      `⚠️ ${componentName} requires demo values for complex props: ${missingRequiredComplexProps
        .map((prop) => prop.name)
        .join(', ')}`
    );
  }

  const apiPropNames = new Set(
    [...reactApiProps, ...nativeApiProps].map((prop) => prop.name)
  );

  function getChangeHandlerName(propName: string) {
    const handlerName = `on${capitalize(propName)}Change`;

    return apiPropNames.has(handlerName) ? handlerName : null;
  }

  return {
    componentConfig,
    componentProfile,
    catalogCategory,
    parts,
    extractedProps,
    playgroundProps,
    platforms,
    reactApiProps,
    nativeApiProps,
    reactPlaygroundApiProps: effectiveReactPlaygroundApiProps,
    nativePlaygroundApiProps: effectiveNativePlaygroundApiProps,
    getDemoProps,
    getChangeHandlerName,
  };
}
